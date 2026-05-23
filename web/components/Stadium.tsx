"use client";

import { ALL_ZONES, type Zone } from "@/lib/types";

// Polar layout: zone i sits at angle (i * 45° - 90°), so index 0 is at 12 o'clock.
const CENTER = 200;
const RADIUS = 130;
const SEGMENT_OUTER = 175;
const SEGMENT_INNER = 95;

function occupancyColor(o: number | undefined): string {
  if (o === undefined || o === null) return "#1f2937"; // zinc-800
  if (o < 0.5) return "#10b981"; // green
  if (o < 0.75) return "#f59e0b"; // amber
  if (o < 0.9) return "#f97316"; // orange
  return "#ef4444"; // red
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
    `Z`,
  ].join(" ");
}

function shortLabel(zone: string): string {
  return zone.replace("_stand", "").replace("_", " ").toUpperCase();
}

export function Stadium({ zones }: { zones: Zone[] }) {
  const byId = new Map(zones.map((z) => [z.zone, z]));

  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[520px] mx-auto">
      <defs>
        <radialGradient id="pitch" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#065f46" />
        </radialGradient>
      </defs>

      {/* Pitch */}
      <circle cx={CENTER} cy={CENTER} r={SEGMENT_INNER - 5} fill="url(#pitch)" opacity={0.85} />
      <rect
        x={CENTER - 10}
        y={CENTER - 35}
        width={20}
        height={70}
        fill="#fde68a"
        opacity={0.6}
      />

      {/* Stand segments */}
      {ALL_ZONES.map((zoneId, i) => {
        const startAngle = i * 45 - 22.5;
        const endAngle = startAngle + 45;
        const z = byId.get(zoneId);
        const color = occupancyColor(z?.occupancy);
        const pressure = z?.pressure_index ?? 0;
        const dangerous = pressure >= 0.6;
        const [lx, ly] = polar(startAngle + 22.5, (SEGMENT_OUTER + SEGMENT_INNER) / 2);

        return (
          <g key={zoneId}>
            <path
              d={arcPath(startAngle, endAngle)}
              fill={color}
              stroke="#0a0a0a"
              strokeWidth={2}
              opacity={dangerous ? 0.95 : 0.85}
              className={dangerous ? "animate-pulse" : ""}
            />
            <text
              x={lx}
              y={ly}
              fontSize={10}
              fontWeight={700}
              textAnchor="middle"
              fill="#0a0a0a"
              dominantBaseline="middle"
            >
              {shortLabel(zoneId)}
            </text>
            <text
              x={lx}
              y={ly + 12}
              fontSize={9}
              textAnchor="middle"
              fill="#0a0a0a"
              opacity={0.75}
            >
              {z?.occupancy !== undefined ? `${Math.round(z.occupancy * 100)}%` : "—"}
            </text>
          </g>
        );
      })}

      {/* Redirect arrows */}
      {ALL_ZONES.flatMap((zoneId, i) => {
        const z = byId.get(zoneId);
        const plan = z?.active_route_plan;
        if (!plan?.redirect_to_zones?.length) return [];
        const [fx, fy] = polar(i * 45, RADIUS);
        return plan.redirect_to_zones.map((target) => {
          const j = ALL_ZONES.indexOf(target as (typeof ALL_ZONES)[number]);
          if (j < 0) return null;
          const [tx, ty] = polar(j * 45, RADIUS);
          return (
            <g key={`${zoneId}->${target}`}>
              <line
                x1={fx}
                y1={fy}
                x2={tx}
                y2={ty}
                stroke="#38bdf8"
                strokeWidth={3}
                strokeDasharray="6 4"
                markerEnd="url(#arrow)"
                className="animate-pulse"
              />
            </g>
          );
        });
      })}

      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
        </marker>
      </defs>
    </svg>
  );
}
