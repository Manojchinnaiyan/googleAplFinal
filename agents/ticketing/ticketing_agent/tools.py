"""Tools the Ticketing agent can call."""

from __future__ import annotations

from stadiumos_shared import AgentDecision, EmergencyTrigger
from stadiumos_shared.firestore import db, write_decision
from stadiumos_shared.pubsub import publish


def log_anomaly(
    kind: str,
    gate_id: str,
    ticket_id: str,
    severity: str,
    details: str,
) -> dict:
    """Record a ticketing anomaly to the audit trail.

    Args:
        kind: One of 'duplicate_scan', 'invalid_ticket', 'expired_ticket',
            'wrong_gate', 'low_throughput'.
        gate_id: Affected gate (e.g. 'gate_3').
        ticket_id: Ticket id involved. Use 'N/A' for throughput issues.
        severity: One of low, medium, high.
        details: One-sentence description of what triggered the flag.

    Returns:
        Dict confirming the anomaly was logged.
    """
    record = {
        "kind": kind,
        "gate_id": gate_id,
        "ticket_id": ticket_id,
        "severity": severity,
    }
    # Append-only log of anomalies, used by the dashboard for a per-gate view.
    db().collection("ticket_anomalies").add({**record, "details": details})

    decision = AgentDecision(
        agent="ticketing",
        input_summary=f"{kind} at {gate_id}",
        reasoning=details,
        output=record,
        confidence=0.95,
    )
    write_decision(decision)
    msg_id = publish("agent.decision", decision)

    return {"logged": True, "msg_id": msg_id, **record}


def request_gate_staffing(gate_id: str, action: str, reason: str) -> dict:
    """Ask Operations to adjust staff at a gate.

    Args:
        gate_id: Affected gate (e.g. 'gate_3').
        action: One of 'add_staff', 'rotate_staff', 'close_gate', 'reopen_gate'.
        reason: Why the change is needed.

    Returns:
        Dict confirming the staffing request.
    """
    request = {"gate_id": gate_id, "action": action, "reason": reason}

    # Patch the gate doc so the dashboard / ops can see the pending action.
    db().collection("gates").document(gate_id).set(
        {"pending_action": request}, merge=True
    )

    decision = AgentDecision(
        agent="ticketing",
        input_summary=f"staffing request: {action} at {gate_id}",
        reasoning=reason,
        output=request,
        confidence=0.9,
    )
    write_decision(decision)
    msg_id = publish("agent.decision", decision)

    return {"requested": True, "msg_id": msg_id, **request}


def escalate_to_security(gate_id: str, ticket_id: str, reason: str) -> dict:
    """Hand off to security via emergency.trigger when a ticket pattern looks abusive
    (e.g. multiple duplicate attempts, blacklisted ticket).

    Args:
        gate_id: Affected gate.
        ticket_id: Ticket id involved.
        reason: One-sentence brief for security.

    Returns:
        Dict with the emitted emergency message id.
    """
    event = EmergencyTrigger(
        kind="security",
        zone=gate_id,
        severity="medium",
        details=f"Ticketing flag for ticket {ticket_id}: {reason}",
        detected_by="ticketing",
    )
    msg_id = publish("emergency.trigger", event)

    decision = AgentDecision(
        agent="ticketing",
        input_summary=f"escalate to security: {ticket_id}",
        reasoning=reason,
        output={
            "event": event.model_dump(mode="json"),
            "ticket_id": ticket_id,
            "msg_id": msg_id,
        },
        confidence=0.95,
    )
    write_decision(decision)

    return {"escalated": True, "msg_id": msg_id, "gate_id": gate_id, "ticket_id": ticket_id}
