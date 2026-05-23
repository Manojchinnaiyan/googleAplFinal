import { Firestore } from "@google-cloud/firestore";

let _client: Firestore | null = null;

export function db(): Firestore {
  if (!_client) {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error("GCP_PROJECT_ID env var not set");
    }
    _client = new Firestore({ projectId });
  }
  return _client;
}
