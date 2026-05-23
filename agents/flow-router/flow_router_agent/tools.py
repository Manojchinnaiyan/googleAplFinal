"""Tools the Flow Router agent can call."""

from __future__ import annotations

from stadiumos_shared import AgentDecision
from stadiumos_shared.firestore import db, update_zone_state, write_decision
from stadiumos_shared.pubsub import publish

from flow_router_agent.stadium import GATES, ZONES, zone_neighbours


def query_stadium_graph(zone: str) -> dict:
    """Return the static layout around a zone: its gates, neighbour zones, current live state.

    Args:
        zone: Zone identifier (must be one of the known zones, see ZONES).

    Returns:
        Dict with the zone's gates, throughput, neighbours, and the latest occupancy
        snapshot from Firestore if available.
    """
    if zone not in ZONES:
        return {"error": f"unknown zone: {zone}", "valid": list(ZONES.keys())}

    info = ZONES[zone]
    neighbours = zone_neighbours(zone)
    live_doc = db().collection("zones").document(zone).get()
    live = live_doc.to_dict() if live_doc.exists else {}

    return {
        "zone": zone,
        "capacity": info["capacity"],
        "gates": info["gates"],
        "gate_throughput_per_min": {g: GATES[g]["throughput_per_min"] for g in info["gates"]},
        "neighbours": neighbours,
        "live": live,
    }


def assign_route(
    from_zone: str,
    redirect_to_zones: list[str],
    close_gates: list[str],
    open_gates: list[str],
    reasoning: str,
) -> dict:
    """Issue a routing decision: where to send fans, which gates to close / open.

    Args:
        from_zone: The zone we're redirecting fans away from.
        redirect_to_zones: Zones to send the overflow toward (must be neighbours of from_zone).
        close_gates: Gates to throttle / close. Empty list if none.
        open_gates: Gates to fully open or boost throughput. Empty list if none.
        reasoning: One-sentence explanation for the dashboard / audit.

    Returns:
        Dict confirming the route was published.
    """
    if from_zone not in ZONES:
        return {"error": f"unknown from_zone: {from_zone}"}

    route = {
        "from_zone": from_zone,
        "redirect_to_zones": redirect_to_zones,
        "close_gates": close_gates,
        "open_gates": open_gates,
    }

    # Patch the source zone with the active routing plan — the dashboard arrows come from here.
    update_zone_state(from_zone, {"active_route_plan": route})
    for target in redirect_to_zones:
        update_zone_state(target, {"receiving_redirect_from": from_zone})

    decision = AgentDecision(
        agent="flow-router",
        input_summary=f"reroute {from_zone}",
        reasoning=reasoning,
        output=route,
        confidence=0.9,
    )
    write_decision(decision)
    msg_id = publish("agent.decision", decision)

    return {"published": True, "msg_id": msg_id, "route": route}
