# StadiumOS — Agentic Stadium Command Platform

Hackathon entry for **Google Cloud Build with AI — Agentic Premier League**.

## Problem
Real-time crowd, security, and logistics command for cricket stadiums. Unify ticketing,
dynamically route crowd flow, automate emergency response. Score targets: Functional (15),
Scalability/Security (10), Static Code (15), GCP Deploy (5), Agentic Depth (15).

## Architecture
Event-driven multi-agent system. Agents communicate via Pub/Sub, not direct calls.
A **Commander Agent** orchestrates specialists (Crowd Vision, Flow Router, Emergency,
Comms, Weather, Ticketing, Fan Concierge). Each specialist is independently deployable.

```
[CCTV/Tickets/Weather] → Pub/Sub → [Specialist Agents] → Pub/Sub → [Commander] → [Dashboard / Fan App / PA]
                                                                       ↓
                                                                   Firestore (state + audit log)
```

## Stack
- **Agents:** Python 3.12, Google ADK (Agent Development Kit), Vertex AI, Gemini 2.5 Pro/Flash
- **Backend events:** Cloud Pub/Sub, Cloud Run (one service per agent), Eventarc
- **State:** Firestore (live), BigQuery (analytics)
- **Dashboard:** Next.js 15 (App Router), Deck.gl for the digital twin, Tailwind
- **Fan app:** Firebase (Auth + FCM + Firestore listeners)
- **Voice:** Gemini Live API
- **Infra:** Terraform, region `asia-south1` (Mumbai). Vertex AI uses `us-central1` (Gemini 2.5 isn't in asia-south1 yet) — cross-region call, ~100ms.

## Repo Layout
```
/agents/<agent_name>/        # one folder per ADK agent (Cloud Run service)
  agent.py                   # ADK agent definition
  tools.py                   # tool functions the agent can call
  Dockerfile
  pyproject.toml
/shared/                     # shared Python: event schemas, Pub/Sub helpers
/web/                        # Next.js dashboard
/fan-app/                    # Next.js / Firebase fan-facing PWA
/infra/                      # Terraform — GCP project, Pub/Sub topics, Cloud Run, IAM
/scripts/                    # local dev helpers, seed data, demo simulators
```

## Conventions
- **Event topics:** `<domain>.<event>` — e.g. `crowd.density`, `gate.scan`, `emergency.trigger`,
  `agent.decision`. Schemas live in `/shared/events/`.
- **Agent naming:** every agent is `<name>_agent` (snake_case), Cloud Run service `<name>-agent`.
- **Every agent decision** must publish to `agent.decision` with `{agent, input, reasoning, output, ts}` —
  this is the audit trail and what the dashboard renders. Don't skip this.
- **Secrets:** Secret Manager only. Never `.env` in repo.
- **No mocks in prod paths.** Demo data lives in `/scripts/simulators/` and is run explicitly.

## Demo Critical Path
The pitch hinges on three live moments:
1. **Pre-crime stampede prediction** — density × velocity gradient triggers Commander → Router reroute.
2. **Voice command** — "How's North Stand?" via Gemini Live, agents answer in parallel.
3. **Emergency choreographer** — one button triggers Emergency + Comms + Router co-planning evac.

Anything that doesn't serve one of these three demos is post-MVP.
