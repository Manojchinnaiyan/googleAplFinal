# StadiumOS Dashboard

Next.js 16 dashboard. Reads agent state directly from Firestore (server-side,
via the runtime service account) and lets you fire scenarios at the Commander
via a proxied `/api/inject` route.

## What it renders

- **Stadium digital twin** — an SVG ring of 8 stands coloured by live
  occupancy (`zones/*.occupancy` from Firestore). Cyan dashed arrows are drawn
  when a zone has an `active_route_plan`.
- **Agent activity feed** — last 25 docs from `decisions/`, newest first.
- **Inject scenario panel** — buttons that POST a prompt to the Commander.

State is polled every 1.5s (`/api/state`); the UI is plain React state, no
WebSockets or Firebase web SDK — the runtime SA reads Firestore directly so
nothing is exposed to the browser.

## Local development

```bash
cp .env.local.example .env.local      # COMMANDER_URL + GCP_PROJECT_ID
gcloud auth application-default login # required so Firestore SDK can authenticate
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

## Deploy

From the repo root:

```bash
gcloud builds submit --config web/cloudbuild.yaml .

gcloud run deploy stadiumos-dashboard \
  --image asia-south1-docker.pkg.dev/$GCP_PROJECT_ID/stadiumos/dashboard:latest \
  --region asia-south1 \
  --service-account stadiumos-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,COMMANDER_URL=https://commander-agent-406816938729.asia-south1.run.app" \
  --allow-unauthenticated
```
