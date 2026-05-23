"""FastAPI server hosting the Flow Router agent."""

from __future__ import annotations

import os

import structlog
from fastapi import FastAPI, HTTPException
from google.adk.agents.run_config import RunConfig
from google.adk.runners import InMemoryRunner
from google.genai import types

from flow_router_agent.agent import flow_router

log = structlog.get_logger(__name__)
app = FastAPI(title="StadiumOS Flow Router")
runner = InMemoryRunner(agent=flow_router, app_name="flow_router")
RUN_CONFIG = RunConfig(max_llm_calls=5)


@app.get("/")
def root() -> dict:
    return {
        "agent": "flow-router",
        "role": "computes safe crowd redirections across the stadium graph",
        "endpoints": {
            "GET /health": "liveness probe",
            "POST /invoke": "execute a routing task; body: {task, zone}",
        },
        "publishes_to": ["agent.decision"],
        "updates_firestore": ["zones/<zone>.active_route_plan"],
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "agent": "flow-router"}


@app.post("/invoke")
async def invoke(payload: dict) -> dict:
    """Receive a routing task (typically from the Commander) and execute it."""
    task = payload.get("task") or payload.get("message")
    if not task:
        raise HTTPException(400, "task or message required")
    zone = payload.get("zone")

    prompt = f"Routing task: {task}"
    if zone:
        prompt += f"\nAffected zone: {zone}"

    session = await runner.session_service.create_session(
        app_name="flow_router", user_id="invoke"
    )
    content = types.Content(role="user", parts=[types.Part(text=prompt)])

    text_out: list[str] = []
    async for event in runner.run_async(
        user_id="invoke",
        session_id=session.id,
        new_message=content,
        run_config=RUN_CONFIG,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    text_out.append(part.text)

    return {"zone": zone, "summary": "".join(text_out)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
