// Mirrors the Pydantic models in shared/stadiumos_shared/events.py.

export type Zone = {
  zone: string;
  occupancy?: number;
  head_count?: number;
  velocity_mps?: number;
  pressure_index?: number;
  source_camera?: string;
  ts?: string;
  active_route_plan?: {
    from_zone: string;
    redirect_to_zones: string[];
    close_gates: string[];
    open_gates: string[];
  };
  receiving_redirect_from?: string;
  active_dispatch?: {
    kind: string;
    zone: string;
    units: number;
    severity: string;
    eta_seconds: number;
  };
  lockdown?: { active: boolean; reason: string };
};

export type Decision = {
  id: string;
  agent: string;
  input_summary: string;
  reasoning: string;
  output: Record<string, unknown>;
  confidence?: number;
  ts: string;
};

export type StateResponse = {
  zones: Zone[];
  decisions: Decision[];
};

export type AgentHealth = {
  name: string;
  label: string;
  url: string | null;
  online: boolean;
  latency_ms: number | null;
};

export type AgentsResponse = {
  deployed: number;
  online: number;
  agents: AgentHealth[];
};

export const ALL_ZONES = [
  "north_stand",
  "north_east_stand",
  "east_stand",
  "south_east_stand",
  "south_stand",
  "south_west_stand",
  "west_stand",
  "north_west_stand",
] as const;

export type ZoneId = (typeof ALL_ZONES)[number];
