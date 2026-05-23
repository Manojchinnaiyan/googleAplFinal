---
description: Scaffold a new ADK agent under /agents
---

Create a new ADK agent. Usage: `/new-agent <name> "<one-line purpose>"`.

Scaffold under `agents/<name>/`:
- `agent.py` — ADK `Agent` with Gemini 2.5 Flash by default, tools loaded from `tools.py`.
- `tools.py` — empty tool registry with one example tool stub.
- `pyproject.toml` — depends on `google-adk`, `google-cloud-pubsub`, `google-cloud-firestore`, `shared` (local).
- `Dockerfile` — `python:3.11-slim`, installs deps, runs FastAPI server on `$PORT`.
- `main.py` — FastAPI app exposing `/health` and `/invoke`, plus a Pub/Sub push handler.
- `README.md` — what topics it subscribes/publishes, what tools it has.

Then:
1. Add the agent's Pub/Sub topic + subscription to `infra/pubsub.tf`.
2. Add it to `infra/cloud_run.tf`.
3. Register the agent in the Commander Agent's known-specialists list.
4. Remind the user to publish an `agent.decision` event from every meaningful action — that's how the dashboard sees what the agent did.
