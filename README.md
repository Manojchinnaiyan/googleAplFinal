# StadiumOS

Real-time agentic command platform for cricket stadium operations.
Submission for **Google Cloud — Build with AI: Agentic Premier League**.

## What it does
A swarm of specialized Gemini agents (Crowd Vision, Flow Router, Emergency, Comms,
Weather, Ticketing, Fan Concierge) coordinated by a Commander agent, communicating
over Pub/Sub. Predicts stampedes before they happen, dynamically reroutes fans,
and choreographs emergency response — all visible on a live digital-twin dashboard.

## Repo Layout
- `agents/` — one folder per ADK agent (Cloud Run service)
- `shared/` — event schemas + Pub/Sub / Firestore helpers used by every agent
- `web/` — Next.js dashboard (the digital twin)
- `fan-app/` — Firebase PWA for fans
- `infra/` — Terraform: Pub/Sub topics, IAM, Cloud Run services
- `scripts/simulators/` — local demo data generators (CCTV frames, ticket scans)

## Stack
Python 3.11 · Google ADK · Gemini 2.5 · Vertex AI · Cloud Run · Pub/Sub · Firestore
· Next.js 15 · Deck.gl · Terraform · `asia-south1`

## Quick Start
```bash
# One-time
gcloud auth application-default login
cp .env.example .env.local

# Local dev (per agent)
cd agents/<agent_name>
pip install -e ../../shared -e .
python main.py

# Deploy
cd infra && terraform apply
# then per agent:
gcloud run deploy <name>-agent --source agents/<name> --region asia-south1
```

See [CLAUDE.md](CLAUDE.md) for architecture and conventions.
