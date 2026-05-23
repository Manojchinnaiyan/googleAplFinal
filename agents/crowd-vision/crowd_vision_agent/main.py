"""FastAPI server hosting the Crowd Vision agent."""

from __future__ import annotations

import base64
import os

import httpx
import structlog
from fastapi import FastAPI, HTTPException
from google.adk.agents.run_config import RunConfig
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import BaseModel

from crowd_vision_agent.agent import crowd_vision

log = structlog.get_logger(__name__)
app = FastAPI(title="StadiumOS Crowd Vision")
runner = InMemoryRunner(agent=crowd_vision, app_name="crowd_vision")
RUN_CONFIG = RunConfig(max_llm_calls=4)


class AnalyzeRequest(BaseModel):
    zone: str
    source_camera: str = "demo_cam"
    image_url: str | None = None
    image_b64: str | None = None
    mime_type: str = "image/jpeg"


async def _fetch_image(req: AnalyzeRequest) -> tuple[bytes, str]:
    if req.image_b64:
        return base64.b64decode(req.image_b64), req.mime_type
    if req.image_url:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(req.image_url)
            r.raise_for_status()
            mime = r.headers.get("content-type", req.mime_type).split(";")[0]
            return r.content, mime
    raise HTTPException(400, "image_url or image_b64 required")


@app.get("/")
def root() -> dict:
    return {
        "agent": "crowd-vision",
        "role": "extracts density + stampede precursors from a stadium camera frame",
        "endpoints": {
            "GET /health": "liveness probe",
            "POST /analyze": "analyze a single frame; body: {zone, source_camera, image_url|image_b64}",
        },
        "publishes_to": ["crowd.density", "agent.decision", "emergency.trigger"],
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "agent": "crowd-vision"}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest) -> dict:
    """Run the agent against a single frame.

    Tools will publish to crowd.density (always) and emergency.trigger (if a stampede
    precursor is detected). Returns the agent's one-sentence summary.
    """
    image_bytes, mime = await _fetch_image(req)
    log.info("analyzing", zone=req.zone, camera=req.source_camera, bytes=len(image_bytes))

    prompt = (
        f"Analyze this frame from camera '{req.source_camera}' showing zone "
        f"'{req.zone}'. Extract crowd metrics and call report_density. "
        "If you see stampede precursors, also call flag_stampede_risk."
    )

    session = await runner.session_service.create_session(
        app_name="crowd_vision", user_id="analyze"
    )
    content = types.Content(
        role="user",
        parts=[
            types.Part(text=prompt),
            types.Part(inline_data=types.Blob(mime_type=mime, data=image_bytes)),
        ],
    )

    text_out: list[str] = []
    async for event in runner.run_async(
        user_id="analyze",
        session_id=session.id,
        new_message=content,
        run_config=RUN_CONFIG,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    text_out.append(part.text)

    return {"zone": req.zone, "summary": "".join(text_out)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
