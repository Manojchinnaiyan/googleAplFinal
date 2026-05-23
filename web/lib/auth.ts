// Bearer header for outgoing inter-service calls. The same token lives in
// every agent's STADIUMOS_API_TOKEN env var; in prod we'd swap this for
// Cloud Run service-to-service ID tokens (roles/run.invoker), but a shared
// bearer is enough hardening for the hackathon demo.

export function bearerHeader(): Record<string, string> {
  const token = process.env.STADIUMOS_API_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
