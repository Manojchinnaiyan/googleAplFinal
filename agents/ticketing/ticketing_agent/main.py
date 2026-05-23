"""FastAPI server hosting the Ticketing agent."""

from __future__ import annotations

import base64
import json
import os

import structlog
from fastapi import Depends, FastAPI, HTTPException, Request
from google.adk.agents.run_config import RunConfig
from google.adk.runners import InMemoryRunner
from google.genai import types
from stadiumos_shared import require_bearer

from ticketing_agent.agent import ticketing

log = structlog.get_logger(__name__)
app = FastAPI(title="StadiumOS Ticketing")
runner = InMemoryRunner(agent=ticketing, app_name="ticketing")
RUN_CONFIG = RunConfig(max_llm_calls=4)

# Routine OK scans are filtered here so the agent only ever sees anomalies.
INTERESTING_EVENTS = {"scan_dup", "scan_invalid", "throughput"}


async def _run(message: str, user_id: str = "api") -> str:
    session = await runner.session_service.create_session(
        app_name="ticketing", user_id=user_id
    )
    content = types.Content(role="user", parts=[types.Part(text=message)])
    out: list[str] = []
    async for ev in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=content,
        run_config=RUN_CONFIG,
    ):
        if ev.content and ev.content.parts:
            for part in ev.content.parts:
                if part.text:
                    out.append(part.text)
    return "".join(out)


@app.get("/")
def root() -> dict:
    return {
        "agent": "ticketing",
        "role": "reacts to gate-scan anomalies and throughput drops",
        "endpoints": {
            "GET /health": "liveness probe",
            "POST /invoke": "drive directly with {\"task\"|\"message\": ...}",
            "POST /pubsub": "Pub/Sub push handler (gate.event)",
        },
        "subscribes_to": ["gate.event"],
        "publishes_to": ["agent.decision", "emergency.trigger"],
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "agent": "ticketing"}


@app.post("/invoke", dependencies=[Depends(require_bearer)])
async def invoke(payload: dict) -> dict:
    task = payload.get("task") or payload.get("message")
    if not task:
        raise HTTPException(400, "task or message required")
    return {"response": await _run(task)}


@app.post("/pubsub")
async def pubsub_push(request: Request) -> dict:
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

    event_kind = data.get("event")
    if event_kind not in INTERESTING_EVENTS:
        return {"status": "filtered", "event": event_kind}

    log.info(
        "pubsub_received",
        kind=event_kind,
        gate=data.get("gate_id"),
        ticket=data.get("ticket_id"),
    )
    prompt = (
        "Incoming gate.event anomaly:\n"
        f"{json.dumps(data, indent=2)}\n\n"
        "Respond per your rules. ONE round of tool calls, then summarise."
    )
    response = await _run(prompt, user_id="pubsub:ticketing")
    return {"status": "ok", "summary": response[:500]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
