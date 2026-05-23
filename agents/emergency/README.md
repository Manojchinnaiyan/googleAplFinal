# Emergency Agent

Receives `emergency.trigger` events from the bus (any source: Commander,
Crowd Vision auto-escalation, or a direct injection) and decides how to
respond.

## Reads

- `emergency.trigger` via the `emergency-trigger-handler` Pub/Sub push subscription.

## Writes

- `agent.decision` for every dispatch / lockdown / notification.
- Firestore `zones/<zone>.active_dispatch` so the dashboard can render
  responder ETAs.
- Firestore `zones/<zone>.lockdown` for closed-zone state.

## Tools

- `dispatch_responder(kind, zone, units, severity, eta_seconds)` — sends
  medical / fire / security units.
- `lockdown_zone(zone, reason)` — closes a zone temporarily.
- `notify_authorities(kind, severity, summary)` — escalates to outside
  agencies (city police / EMS / fire dept).

## Local development

```bash
pip install -e shared -e agents/emergency

export $(grep -v '^#' .env.example | xargs)
uvicorn emergency_agent.main:app --reload --port 8083 --app-dir agents/emergency

curl -X POST localhost:8083/invoke -H "Content-Type: application/json" -d '{
  "task": "A fan collapsed in East Stand section E-14. severity=high"
}'
```

## Deploy

```bash
gcloud builds submit --config agents/emergency/cloudbuild.yaml .

gcloud run deploy emergency-agent \
  --image asia-south1-docker.pkg.dev/$GCP_PROJECT_ID/stadiumos/emergency:latest \
  --region asia-south1 \
  --service-account stadiumos-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$GCP_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1" \
  --allow-unauthenticated
```
