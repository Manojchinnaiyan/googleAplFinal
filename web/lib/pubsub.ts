import { PubSub } from "@google-cloud/pubsub";

let _client: PubSub | null = null;

export function pubsub(): PubSub {
  if (!_client) {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) throw new Error("GCP_PROJECT_ID env var not set");
    _client = new PubSub({ projectId });
  }
  return _client;
}

export async function publish(topic: string, payload: object, attributes: Record<string, string> = {}): Promise<string> {
  const data = Buffer.from(JSON.stringify(payload));
  return await pubsub().topic(topic).publishMessage({ data, attributes });
}
