"""FastAPI server hosting the Commander agent."""

from __future__ import annotations

import base64
import json
import os

import structlog
from fastapi import FastAPI, HTTPException, Request
from google.adk.agents.run_config import RunConfig
from google.adk.runners import InMemoryRunner
from google.genai import types

from agent.agent import commander

log = structlog.get_logger(__name__)
app = FastAPI(title="StadiumOS Commander")
runner = InMemoryRunner(agent=commander, app_name="commander")

# Hard cap so a hallucinated tool loop can't run away.
RUN_CONFIG = RunConfig(max_llm_calls=4)


async def _run(message: str, user_id: str = "api") -> str:
    session = await runner.session_service.create_session(
        app_name="commander", user_id=user_id
    )
    content = types.Content(role="user", parts=[types.Part(text=message)])
    text_out: list[str] = []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=content,
        run_config=RUN_CONFIG,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    text_out.append(part.text)
    return "".join(text_out)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "agent": "commander"}


@app.post("/invoke")
async def invoke(payload: dict) -> dict:
    """Direct invocation — used by the dashboard or for manual testing."""
    message = payload.get("message", "")
    if not message:
        raise HTTPException(400, "message required")
    response = await _run(message, user_id=payload.get("user_id", "api"))
    return {"response": response}


@app.post("/pubsub")
async def pubsub_push(request: Request) -> dict:
    """Receive Pub/Sub push messages (Cloud Run push subscriptions)."""
    envelope = await request.json()
    msg = envelope.get("message") or {}
    data_b64 = msg.get("data")
    if not data_b64:
        return {"status": "noop"}

    try:
        data = json.loads(base64.b64decode(data_b64).decode("utf-8"))
    except (ValueError, TypeError) as exc:
        log.warning("bad_pubsub_payload", error=str(exc))
        return {"status": "bad_payload"}

    attributes = msg.get("attributes") or {}
    topic = attributes.get("topic") or envelope.get("subscription", "unknown")

    # Ignore the Commander's own decisions to avoid feedback loops.
    if data.get("agent") == "commander":
        return {"status": "self_ignored"}

    log.info("pubsub_received", topic=topic, agent=data.get("agent"))
    prompt = (
        f"Incoming event on '{topic}':\n"
        f"{json.dumps(data, indent=2)}\n\n"
        "Decide if any action is needed. If yes, call a tool now."
    )
    response = await _run(prompt, user_id=f"pubsub:{topic}")
    return {"status": "ok", "summary": response[:500]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
