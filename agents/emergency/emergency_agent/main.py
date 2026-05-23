"""FastAPI server hosting the Emergency agent."""

from __future__ import annotations

import base64
import json
import os

import structlog
from fastapi import FastAPI, HTTPException, Request
from google.adk.agents.run_config import RunConfig
from google.adk.runners import InMemoryRunner
from google.genai import types

from emergency_agent.agent import emergency

log = structlog.get_logger(__name__)
app = FastAPI(title="StadiumOS Emergency")
runner = InMemoryRunner(agent=emergency, app_name="emergency")
RUN_CONFIG = RunConfig(max_llm_calls=4)


async def _run(message: str, user_id: str = "api") -> str:
    session = await runner.session_service.create_session(
        app_name="emergency", user_id=user_id
    )
    content = types.Content(role="user", parts=[types.Part(text=message)])
    out: list[str] = []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=content,
        run_config=RUN_CONFIG,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    out.append(part.text)
    return "".join(out)


@app.get("/")
def root() -> dict:
    return {
        "agent": "emergency",
        "role": "dispatches responders + notifies external agencies for stadium emergencies",
        "endpoints": {
            "GET /health": "liveness probe",
            "POST /invoke": "drive directly with {\"task\"|\"message\": ...}",
            "POST /pubsub": "Pub/Sub push handler (emergency.trigger)",
        },
        "subscribes_to": ["emergency.trigger"],
        "publishes_to": ["agent.decision"],
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "agent": "emergency"}


@app.post("/invoke")
async def invoke(payload: dict) -> dict:
    """Manual invocation for testing."""
    task = payload.get("task") or payload.get("message")
    if not task:
        raise HTTPException(400, "task or message required")
    return {"response": await _run(task)}


@app.post("/pubsub")
async def pubsub_push(request: Request) -> dict:
    """Pub/Sub push handler for emergency.trigger events."""
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

    if data.get("agent") == "emergency":
        return {"status": "self_ignored"}

    log.info(
        "pubsub_received",
        kind=data.get("kind"),
        zone=data.get("zone"),
        severity=data.get("severity"),
    )
    prompt = (
        "Incoming emergency.trigger event:\n"
        f"{json.dumps(data, indent=2)}\n\n"
        "Respond per your rules. Take ONE round of tool calls, then summarise."
    )
    response = await _run(prompt, user_id=f"pubsub:emergency")
    return {"status": "ok", "summary": response[:500]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
