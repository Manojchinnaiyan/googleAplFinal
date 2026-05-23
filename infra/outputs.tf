output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "runtime_sa" {
  value = data.google_service_account.runtime.email
}

output "artifact_registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.agents.repository_id}"
}

output "topics" {
  value = [for t in google_pubsub_topic.bus : t.name]
}
