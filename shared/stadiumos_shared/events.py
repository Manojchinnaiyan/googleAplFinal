"""Event schemas for the StadiumOS bus. Every Pub/Sub message is one of these."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CrowdDensity(BaseModel):
    """Emitted by the Crowd Vision agent per zone, per sample."""

    zone: str
    occupancy: float = Field(ge=0.0, le=1.0, description="0..1 fraction of capacity")
    head_count: int = Field(ge=0)
    velocity_mps: float = Field(description="Mean crowd velocity, signed (negative = inward)")
    pressure_index: float = Field(ge=0.0, description="density * |velocity gradient|")
    source_camera: str
    ts: datetime = Field(default_factory=_now)


class GateEvent(BaseModel):
    gate_id: str
    event: Literal["scan_ok", "scan_dup", "scan_invalid", "throughput"]
    ticket_id: str | None = None
    throughput_per_min: int | None = None
    ts: datetime = Field(default_factory=_now)


class EmergencyTrigger(BaseModel):
    kind: Literal["medical", "fire", "security", "stampede_risk", "weather"]
    zone: str
    severity: Literal["low", "medium", "high", "critical"]
    details: str
    detected_by: str
    ts: datetime = Field(default_factory=_now)


class WeatherUpdate(BaseModel):
    condition: Literal["clear", "cloudy", "rain", "heavy_rain", "storm"]
    temp_c: float
    rain_prob_pct: float = Field(ge=0.0, le=100.0)
    minutes_until_change: int | None = None
    ts: datetime = Field(default_factory=_now)


class AgentDecision(BaseModel):
    """The audit trail. Every meaningful agent action publishes one of these."""

    agent: str
    input_summary: str
    reasoning: str
    output: dict[str, Any]
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    correlation_id: str | None = None
    ts: datetime = Field(default_factory=_now)
