# Commander Agent

The orchestrator. Receives events from the bus, decides which specialist to
invoke, and logs every decision to the audit trail.

## Reads
- `agent.decision` — outputs from specialist agents
- `emergency.trigger` — highest priority
- `crowd.density` — for situational awareness
- `weather.update`

## Writes
- `agent.decision` — its own decisions (audit log + dashboard render)
- `emergency.trigger` — when it escalates internally

## Tools (callable by the LLM)
- `delegate_task(specialist, task, zone)` — dispatch a task to another agent
- `query_zone_state(zone)` — read a zone's live state from Firestore
- `escalate_emergency(kind, zone, severity, details)` — fire the emergency pipeline

## Local development
From the repo root:
```bash
python -m venv .venv && source .venv/bin/activate
pip install -e shared -e agents/commander

# .env values
export $(grep -v '^#' .env.example | xargs)

uvicorn commander_agent.main:app --reload --port 8080 --app-dir agents/commander
```

Smoke test:
```bash
curl localhost:8080/health
curl -X POST localhost:8080/invoke -H "Content-Type: application/json" \
  -d '{"message":"North Stand is at 87% occupancy with inward velocity 1.2 m/s. What do you do?"}'
```

## Deploy
From the repo root:
```bash
gcloud builds submit --config agents/commander/cloudbuild.yaml .
gcloud run deploy commander-agent \
  --image asia-south1-docker.pkg.dev/$GCP_PROJECT_ID/stadiumos/commander:latest \
  --region asia-south1 \
  --service-account stadiumos-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$GCP_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1" \
  --no-allow-unauthenticated
```
