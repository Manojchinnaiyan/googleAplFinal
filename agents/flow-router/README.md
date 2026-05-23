# Flow Router Agent

Receives a routing task (typically from the Commander), looks up the affected
zone in the static stadium graph, checks neighbours' live occupancy from
Firestore, and publishes a re-routing plan. The dashboard renders the arrows
from the `zones/<zone>.active_route_plan` document this agent writes.

## API

`POST /invoke`

```json
{ "task": "Reroute fans away from North Stand", "zone": "north_stand" }
```

Returns the agent's one-sentence summary; the actual plan is in Firestore +
the `agent.decision` topic.

## Stadium graph

Defined statically in `flow_router_agent/stadium.py`: 8 stands × 8 gates
arranged as a ring. Each stand shares two gates with its neighbours. ~80k
total capacity.

## Tools

- `query_stadium_graph(zone)` — returns gates, neighbours, throughput, and
  the latest live occupancy for the zone.
- `assign_route(from_zone, redirect_to_zones, close_gates, open_gates, reasoning)`
  — publishes the routing plan + writes `zones/<zone>.active_route_plan`.

## Writes

- `agent.decision` — its routing decisions
- Firestore `zones/<zone>` — `active_route_plan` on the source zone,
  `receiving_redirect_from` on each target

## Local development

From the repo root:

```bash
pip install -e shared -e agents/flow-router

export $(grep -v '^#' .env.example | xargs)
uvicorn flow_router_agent.main:app --reload --port 8082 --app-dir agents/flow-router

curl -X POST localhost:8082/invoke -H "Content-Type: application/json" -d '{
  "task": "North Stand is at 87% with inward velocity. Reduce inward flow.",
  "zone": "north_stand"
}'
```

## Deploy

```bash
gcloud builds submit --config agents/flow-router/cloudbuild.yaml .
gcloud run deploy flow-router-agent \
  --image asia-south1-docker.pkg.dev/$GCP_PROJECT_ID/stadiumos/flow-router:latest \
  --region asia-south1 \
  --service-account stadiumos-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$GCP_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1" \
  --no-allow-unauthenticated
```
