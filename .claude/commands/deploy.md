---
description: Build and deploy a single agent (Cloud Run) or the whole stack
---

Deploy StadiumOS components to GCP.

If the user passed an agent name (e.g. `/deploy crowd-vision`):
1. `cd agents/<name>` and build the Docker image with Cloud Build.
2. Deploy to Cloud Run in `asia-south1`.
3. Verify the service URL responds with `200` on `/health`.
4. Tail logs for 30s to confirm the agent subscribed to its Pub/Sub topics.

If no arg, deploy everything:
1. `terraform apply` from `/infra` to ensure topics/IAM/Firestore are current.
2. Deploy each `agents/*` folder to Cloud Run in parallel.
3. Deploy `/web` (Next.js dashboard) to Cloud Run.
4. Print the final dashboard URL + Pub/Sub topic list.

Before deploying, confirm the active gcloud project matches the expected hackathon project.
Never deploy if there are uncommitted changes — surface them and ask first.
