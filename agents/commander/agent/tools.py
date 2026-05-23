"""Tools the Commander can invoke."""

from __future__ import annotations

from stadiumos_shared import AgentDecision, EmergencyTrigger
from stadiumos_shared.firestore import db, write_decision
from stadiumos_shared.pubsub import publish

KNOWN_SPECIALISTS = ("crowd-vision", "flow-router", "emergency", "comms", "weather")


def delegate_task(specialist: str, task: str, zone: str = "") -> dict:
    """Send a task to a specialist agent.

    Args:
        specialist: One of crowd-vision, flow-router, emergency, comms, weather.
        task: Natural-language description of what the specialist should do.
        zone: Optional stadium zone (e.g. 'north_stand'). Empty string if not zone-specific.

    Returns:
        A dict confirming the delegation. The audit log records this decision.
    """
    if specialist not in KNOWN_SPECIALISTS:
        return {
            "error": f"unknown specialist: {specialist}",
            "valid": list(KNOWN_SPECIALISTS),
        }

    decision = AgentDecision(
        agent="commander",
        input_summary=f"delegate to {specialist}",
        reasoning=f"Commander routing task to {specialist}",
        output={"specialist": specialist, "task": task, "zone": zone or None},
    )
    write_decision(decision)
    publish("agent.decision", decision, target=specialist)
    return {"delegated_to": specialist, "task": task, "zone": zone or None}


def query_zone_state(zone: str) -> dict:
    """Read the latest known state of a stadium zone from Firestore.

    Args:
        zone: Zone identifier (e.g. 'north_stand', 'gate_4').

    Returns:
        A dict of the zone's last-known fields, or {'state': 'unknown'} if not seen yet.
    """
    doc = db().collection("zones").document(zone).get()
    if not doc.exists:
        return {"zone": zone, "state": "unknown"}
    return {"zone": zone, **(doc.to_dict() or {})}


def escalate_emergency(kind: str, zone: str, severity: str, details: str) -> dict:
    """Trigger the emergency pipeline. Use for time-critical situations.

    Args:
        kind: One of medical, fire, security, stampede_risk, weather.
        zone: Affected stadium zone.
        severity: One of low, medium, high, critical.
        details: Free-text description of what's happening.

    Returns:
        Dict with the emitted message ID.
    """
    event = EmergencyTrigger(
        kind=kind,  # type: ignore[arg-type]
        zone=zone,
        severity=severity,  # type: ignore[arg-type]
        details=details,
        detected_by="commander",
    )
    msg_id = publish("emergency.trigger", event)

    decision = AgentDecision(
        agent="commander",
        input_summary=f"emergency: {kind} in {zone}",
        reasoning=f"escalating {kind} at severity {severity}",
        output={"event": event.model_dump(mode="json"), "msg_id": msg_id},
        confidence=1.0,
    )
    write_decision(decision)
    return {"escalated": True, "kind": kind, "zone": zone, "severity": severity, "msg_id": msg_id}
