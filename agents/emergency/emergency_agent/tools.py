"""Tools the Emergency agent can call."""

from __future__ import annotations

from stadiumos_shared import AgentDecision
from stadiumos_shared.firestore import update_zone_state, write_decision
from stadiumos_shared.pubsub import publish

# Available responder units per discipline (hardcoded for the hackathon — would
# come from a Firestore roster in production).
ROSTER: dict[str, int] = {
    "medical": 6,
    "fire": 4,
    "security": 12,
}


def dispatch_responder(kind: str, zone: str, units: int, severity: str, eta_seconds: int) -> dict:
    """Dispatch responder units to a zone.

    Args:
        kind: One of medical, fire, security.
        zone: Affected stadium zone (e.g. 'east_stand').
        units: How many units to send. Must be > 0 and <= the roster size.
        severity: One of low, medium, high, critical.
        eta_seconds: Estimated arrival in seconds.

    Returns:
        Dict confirming the dispatch.
    """
    if kind not in ROSTER:
        return {"error": f"unknown responder kind: {kind}", "valid": list(ROSTER)}
    max_units = ROSTER[kind]
    if units < 1 or units > max_units:
        return {"error": f"units must be 1..{max_units} for {kind}"}

    dispatch = {
        "kind": kind,
        "zone": zone,
        "units": units,
        "severity": severity,
        "eta_seconds": eta_seconds,
    }
    update_zone_state(zone, {"active_dispatch": dispatch})

    decision = AgentDecision(
        agent="emergency",
        input_summary=f"{kind} dispatch to {zone}",
        reasoning=(
            f"Sending {units} {kind} units ({severity}) to {zone}, "
            f"ETA {eta_seconds}s"
        ),
        output=dispatch,
        confidence=1.0,
    )
    write_decision(decision)
    msg_id = publish("agent.decision", decision)

    return {"dispatched": True, "msg_id": msg_id, **dispatch}


def lockdown_zone(zone: str, reason: str) -> dict:
    """Temporarily lock down a zone — no entry, controlled exit only.

    Args:
        zone: Zone to lock down.
        reason: One-sentence justification for the audit trail.

    Returns:
        Dict confirming the lockdown.
    """
    update_zone_state(zone, {"lockdown": {"active": True, "reason": reason}})

    decision = AgentDecision(
        agent="emergency",
        input_summary=f"lockdown {zone}",
        reasoning=reason,
        output={"zone": zone, "lockdown": True},
        confidence=0.95,
    )
    write_decision(decision)
    msg_id = publish("agent.decision", decision)

    return {"locked_down": True, "zone": zone, "msg_id": msg_id}


def notify_authorities(kind: str, severity: str, summary: str) -> dict:
    """Escalate to outside agencies (city police / EMS / fire dept).

    Args:
        kind: medical, fire, security, stampede_risk, weather.
        severity: low, medium, high, critical.
        summary: One-sentence handoff brief for the receiving agency.

    Returns:
        Dict with the notification ID (synthetic — no real external call here).
    """
    notice = {
        "kind": kind,
        "severity": severity,
        "summary": summary,
        "agencies_notified": _agencies_for(kind),
    }

    decision = AgentDecision(
        agent="emergency",
        input_summary=f"authorities notified: {kind}",
        reasoning=summary,
        output=notice,
        confidence=1.0,
    )
    write_decision(decision)
    msg_id = publish("agent.decision", decision)

    return {"notified": True, "msg_id": msg_id, **notice}


def _agencies_for(kind: str) -> list[str]:
    if kind == "medical":
        return ["EMS", "stadium_medical"]
    if kind == "fire":
        return ["fire_dept", "stadium_fire_safety"]
    if kind == "security":
        return ["city_police", "stadium_security"]
    if kind == "stampede_risk":
        return ["city_police", "stadium_security", "EMS"]
    if kind == "weather":
        return ["stadium_ops"]
    return ["stadium_ops"]
