# Ticketing Agent

Reacts to anomalous gate events (duplicate scans, invalid tickets, low
throughput). Routine `scan_ok` events are filtered out in the `/pubsub`
handler so this agent only ever runs when something actually needs
attention.

## Reads
- `gate.event` via the `ticketing-gate-event-handler` push subscription.

## Writes
- `agent.decision` for every anomaly logged or staffing request issued.
- `emergency.trigger` when ticket abuse looks organised (calls `escalate_to_security`).
- Firestore `ticket_anomalies` (append-only audit log).
- Firestore `gates/<gate_id>.pending_action` for staffing requests.

## Tools
- `log_anomaly(kind, gate_id, ticket_id, severity, details)` — record + alert.
- `request_gate_staffing(gate_id, action, reason)` — `add_staff`, `rotate_staff`,
  `close_gate`, or `reopen_gate`.
- `escalate_to_security(gate_id, ticket_id, reason)` — fires `emergency.trigger`.

## Local development

```bash
pip install -e shared -e agents/ticketing

export $(grep -v '^#' .env.example | xargs)
uvicorn ticketing_agent.main:app --reload --port 8084 --app-dir agents/ticketing

curl -X POST localhost:8084/invoke -H "Content-Type: application/json" -d '{
  "task": "scan_dup at gate_3 for ticket T-4421; first scan was at gate_5"
}'
```

## Deploy

```bash
gcloud builds submit --config agents/ticketing/cloudbuild.yaml .

gcloud run deploy ticketing-agent \
  --image asia-south1-docker.pkg.dev/$GCP_PROJECT_ID/stadiumos/ticketing:latest \
  --region asia-south1 \
  --service-account stadiumos-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$GCP_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1" \
  --allow-unauthenticated
```
