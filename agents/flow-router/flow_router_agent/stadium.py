"""Static stadium graph used by Flow Router to reason about alternatives.

For the hackathon this is hardcoded — in prod it would come from Firestore
seeded by the ops team. Eight zones, eight gates, capacities chosen so the
math works out to ~80k total fans (typical large cricket ground).
"""

from __future__ import annotations

ZONES: dict[str, dict] = {
    "north_stand":      {"capacity": 12000, "gates": ["gate_1", "gate_2"]},
    "north_east_stand": {"capacity": 10000, "gates": ["gate_2", "gate_3"]},
    "east_stand":       {"capacity": 12000, "gates": ["gate_3", "gate_4"]},
    "south_east_stand": {"capacity": 8000,  "gates": ["gate_4", "gate_5"]},
    "south_stand":      {"capacity": 12000, "gates": ["gate_5", "gate_6"]},
    "south_west_stand": {"capacity": 8000,  "gates": ["gate_6", "gate_7"]},
    "west_stand":       {"capacity": 12000, "gates": ["gate_7", "gate_8"]},
    "north_west_stand": {"capacity": 6000,  "gates": ["gate_8", "gate_1"]},
}

# Gates form a ring around the stadium. Each gate's neighbours are the next/prev gate.
GATES: dict[str, dict] = {
    f"gate_{i}": {
        "neighbours": [f"gate_{((i - 2) % 8) + 1}", f"gate_{(i % 8) + 1}"],
        "throughput_per_min": 350,
    }
    for i in range(1, 9)
}


def zone_neighbours(zone: str) -> list[str]:
    """Return zones that share at least one gate with `zone`."""
    if zone not in ZONES:
        return []
    target_gates = set(ZONES[zone]["gates"])
    return [
        z for z, info in ZONES.items()
        if z != zone and target_gates.intersection(info["gates"])
    ]
