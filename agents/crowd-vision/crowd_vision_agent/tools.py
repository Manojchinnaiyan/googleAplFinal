"""Tools the Crowd Vision agent can call."""

from __future__ import annotations

from stadiumos_shared import AgentDecision, CrowdDensity, EmergencyTrigger
from stadiumos_shared.firestore import update_zone_state, write_decision
from stadiumos_shared.pubsub import publish

# Auto-escalation threshold: if pressure_index >= this, also fire stampede_risk.
PRESSURE_AUTO_ESCALATE = 0.85


def report_density(
    zone: str,
    head_count: int,
    occupancy: float,
    velocity_mps: float,
    pressure_index: float,
    source_camera: str,
) -> dict:
    """Publish a crowd density reading to the bus.

    Args:
        zone: Stadium zone identifier (e.g. 'north_stand', 'gate_4_concourse').
        head_count: Number of visible people in the frame.
        occupancy: Fraction 0..1 of the visible area's capacity.
        velocity_mps: Mean velocity. Negative = inward, positive = outward, 0 = static.
        pressure_index: occupancy * |velocity_mps|. Higher = more dangerous.
        source_camera: Camera ID this frame came from.

    Returns:
        A dict confirming the publication and any auto-escalation.
    """
    event = CrowdDensity(
        zone=zone,
        head_count=head_count,
        occupancy=max(0.0, min(1.0, occupancy)),
        velocity_mps=velocity_mps,
        pressure_index=pressure_index,
        source_camera=source_camera,
    )
    msg_id = publish("crowd.density", event)

    # Keep the live state document fresh for the dashboard.
    update_zone_state(zone, event.model_dump(mode="json"))

    decision = AgentDecision(
        agent="crowd-vision",
        input_summary=f"frame from {source_camera} of {zone}",
        reasoning=(
            f"{head_count} people, {occupancy:.0%} occupancy, "
            f"velocity {velocity_mps:+.1f} m/s, pressure {pressure_index:.2f}"
        ),
        output={"event": event.model_dump(mode="json"), "msg_id": msg_id},
    )
    write_decision(decision)
    publish("agent.decision", decision)

    auto_escalated = False
    if pressure_index >= PRESSURE_AUTO_ESCALATE:
        flag_stampede_risk(
            zone=zone,
            severity="high",
            details=(
                f"Auto-escalated: pressure_index {pressure_index:.2f} >= "
                f"{PRESSURE_AUTO_ESCALATE} (occupancy {occupancy:.0%}, "
                f"velocity {velocity_mps:+.1f} m/s)"
            ),
        )
        auto_escalated = True

    return {
        "published": True,
        "msg_id": msg_id,
        "zone": zone,
        "auto_escalated": auto_escalated,
    }


def flag_stampede_risk(zone: str, severity: str, details: str) -> dict:
    """Fire an explicit stampede-risk emergency. Use for visible precursors.

    Args:
        zone: Affected zone.
        severity: One of low, medium, high, critical.
        details: What you saw in the frame (falling, bottleneck, counter-flow, etc.).

    Returns:
        Dict with the emitted message ID.
    """
    event = EmergencyTrigger(
        kind="stampede_risk",
        zone=zone,
        severity=severity,  # type: ignore[arg-type]
        details=details,
        detected_by="crowd-vision",
    )
    msg_id = publish("emergency.trigger", event)

    decision = AgentDecision(
        agent="crowd-vision",
        input_summary=f"stampede precursor in {zone}",
        reasoning=details,
        output={"event": event.model_dump(mode="json"), "msg_id": msg_id},
        confidence=0.9,
    )
    write_decision(decision)

    return {"escalated": True, "zone": zone, "severity": severity, "msg_id": msg_id}
