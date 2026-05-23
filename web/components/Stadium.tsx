"use client";

import { ALL_ZONES, type Zone } from "@/lib/types";

const CENTER = 220;
const SEGMENT_OUTER = 175;
const SEGMENT_INNER = 100;
const ARROW_RADIUS = 130;
const LABEL_RADIUS = 198;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function zoneColor(z: Zone | undefined): string {
  if (!z) return "var(--occ-empty)";
  // Actionable state trumps raw occupancy — a zone with an active dispatch or
  // lockdown is critical even if its occupancy reading is stale/missing,
  // otherwise the SVG ends up green while the badge screams AT RISK.
  if (z.lockdown?.active || z.active_dispatch) return "var(--occ-critical)";
  if (z.active_route_plan) return "var(--occ-high)";
  if ((z.pressure_index ?? 0) >= 0.85) return "var(--occ-critical)";
  if ((z.pressure_index ?? 0) >= 0.6) return "var(--occ-high)";
  const o = z.occupancy;
  if (o === undefined || o === null) return "var(--occ-empty)";
  if (o < 0.5) return "var(--occ-low)";
  if (o < 0.75) return "var(--occ-mid)";
  if (o < 0.9) return "var(--occ-high)";
  return "var(--occ-critical)";
}

function polar(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

function arcPath(startAngle: number, endAngle: number): string {
  const [x1o, y1o] = polar(startAngle, SEGMENT_OUTER);
  const [x2o, y2o] = polar(endAngle, SEGMENT_OUTER);
  const [x2i, y2i] = polar(endAngle, SEGMENT_INNER);
  const [x1i, y1i] = polar(startAngle, SEGMENT_INNER);
  return [
    `M ${x1o} ${y1o}`,
    `A ${SEGMENT_OUTER} ${SEGMENT_OUTER} 0 0 1 ${x2o} ${y2o}`,
    `L ${x2i} ${y2i}`,
    `A ${SEGMENT_INNER} ${SEGMENT_INNER} 0 0 0 ${x1i} ${y1i}`,
    "Z",
  ].join(" ");
}

export function Stadium({ zones }: { zones: Zone[] }) {
  const byId = new Map(zones.map((z) => [z.zone, z]));

  return (
    <svg
      viewBox="0 0 440 440"
      className="w-full max-w-[560px] mx-auto select-none"
      role="img"
      aria-label="Stadium digital twin"
    >
      <defs>
        <radialGradient id="pitch" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="ring-shadow" cx="50%" cy="50%" r="60%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </radialGradient>
        <marker
          id="arrow-head"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--arrow)" />
        </marker>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={SEGMENT_OUTER + 12} fill="url(#ring-shadow)" />

      {/* Pitch */}
      <circle cx={CENTER} cy={CENTER} r={SEGMENT_INNER - 8} fill="url(#pitch)" />
      <ellipse cx={CENTER} cy={CENTER} rx={48} ry={20} fill="none" stroke="#bbf7d0" strokeOpacity={0.55} strokeWidth={1.5} />
      <line x1={CENTER} y1={CENTER - 30} x2={CENTER} y2={CENTER + 30} stroke="#fde68a" strokeOpacity={0.7} strokeWidth={3} />
      <circle cx={CENTER} cy={CENTER} r={4} fill="#fde68a" opacity={0.8} />

      {/* Stand segments + state badges */}
      {ALL_ZONES.map((zoneId, i) => {
        const startAngle = i * 45 - 22.5;
        const endAngle = startAngle + 45;
        const z = byId.get(zoneId);
        const fill = zoneColor(z);
        const pressure = z?.pressure_index ?? 0;
        const dangerous = pressure >= 0.6;
        const atRisk = !!z?.active_route_plan;
        const receiving = !!z?.receiving_redirect_from;
        const dispatched = !!z?.active_dispatch;
        const badge = atRisk
          ? { text: "AT RISK", color: "#ef4444" }
          : dispatched
            ? { text: "DISPATCH", color: "#f59e0b" }
            : receiving
              ? { text: "REDIRECT IN", color: "#0ea5e9" }
              : null;
        const [bx, by] = polar(i * 45, (SEGMENT_OUTER + SEGMENT_INNER) / 2 + 6);

        return (
          <g key={`seg-${zoneId}`}>
            <path
              d={arcPath(startAngle, endAngle)}
              fill={fill}
              stroke="var(--bg)"
              strokeWidth={2}
              opacity={z?.occupancy === undefined ? 0.55 : 1}
              className={dangerous ? "danger-pulse" : undefined}
            />
            {badge && (
              <text
                x={bx}
                y={by}
                fontSize={7.5}
                fontWeight={800}
                letterSpacing={0.6}
                textAnchor="middle"
                fill={badge.color}
                dominantBaseline="middle"
                style={{ paintOrder: "stroke", stroke: "var(--bg)", strokeWidth: 2.5 }}
              >
                {badge.text}
              </text>
            )}
          </g>
        );
      })}

      {/* Redirect arrows */}
      {ALL_ZONES.flatMap((zoneId, i) => {
        const z = byId.get(zoneId);
        const plan = z?.active_route_plan;
        if (!plan?.redirect_to_zones?.length) return [];
        const [fx, fy] = polar(i * 45, ARROW_RADIUS);
        return plan.redirect_to_zones.map((target) => {
          const j = ALL_ZONES.indexOf(target as (typeof ALL_ZONES)[number]);
          if (j < 0) return null;
          const [tx, ty] = polar(j * 45, ARROW_RADIUS);
          // Curve via a control point near the pitch.
          const cx = (fx + tx) / 2 + (CENTER - (fx + tx) / 2) * 0.4;
          const cy = (fy + ty) / 2 + (CENTER - (fy + ty) / 2) * 0.4;
          return (
            <path
              key={`arrow-${zoneId}->${target}`}
              d={`M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`}
              fill="none"
              stroke="var(--arrow)"
              strokeWidth={3}
              strokeDasharray="6 5"
              strokeLinecap="round"
              markerEnd="url(#arrow-head)"
              className="danger-pulse"
            />
          );
        });
      })}

      {/* Compass-rose labels INSIDE the outer segment edge so they never clip.
          We use 2-letter compass codes (N, NE, E, …) — the full zone name is
          available in the activity feed and tooltips. */}
      {ALL_ZONES.map((zoneId, i) => {
        const z = byId.get(zoneId);
        const angle = i * 45;
        const [lx, ly] = polar(angle, LABEL_RADIUS);
        const occ = z?.occupancy;
        const occText = occ !== undefined ? `${Math.round(occ * 100)}%` : "—";
        return (
          <g key={`label-${zoneId}`}>
            <title>{zoneId}</title>
            <text
              x={lx}
              y={ly - 5}
              fontSize={11}
              fontWeight={700}
              letterSpacing={0.5}
              textAnchor="middle"
              fill="var(--fg)"
              dominantBaseline="middle"
            >
              {COMPASS[i]}
            </text>
            <text
              x={lx}
              y={ly + 9}
              fontSize={9}
              textAnchor="middle"
              fill="var(--muted)"
              fontFamily="var(--font-geist-mono)"
              dominantBaseline="middle"
            >
              {occText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
