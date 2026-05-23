# Push subscriptions that wire event topics to specific agents.
# Each subscription POSTs the event to the agent's /pubsub endpoint, signed
# with an OIDC token so the agent can verify it really came from Pub/Sub.

data "google_cloud_run_v2_service" "commander" {
  name     = "commander-agent"
  location = var.region
}

data "google_cloud_run_v2_service" "emergency" {
  name     = "emergency-agent"
  location = var.region
}

data "google_project" "this" {}

# Pub/Sub's own service identity needs to be allowed to mint OIDC tokens
# for the runtime SA we use to sign push requests.
resource "google_service_account_iam_member" "pubsub_token_creator" {
  service_account_id = data.google_service_account.runtime.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Even though commander-agent is currently --allow-unauthenticated, grant
# run.invoker to the runtime SA so this keeps working when we tighten auth.
resource "google_cloud_run_v2_service_iam_member" "commander_invoker" {
  name     = data.google_cloud_run_v2_service.commander.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${data.google_service_account.runtime.email}"
}

# crowd.density events from Crowd Vision -> Commander's /pubsub handler.
resource "google_pubsub_subscription" "commander_crowd_density" {
  name  = "commander-crowd-density"
  topic = google_pubsub_topic.bus["crowd.density"].name

  push_config {
    push_endpoint = "${data.google_cloud_run_v2_service.commander.uri}/pubsub"

    oidc_token {
      service_account_email = data.google_service_account.runtime.email
      audience              = data.google_cloud_run_v2_service.commander.uri
    }

    attributes = {
      x-goog-version = "v1"
    }
  }

  ack_deadline_seconds       = 60
  message_retention_duration = "600s"

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  # Pub/Sub itself needs to be able to publish to the DLQ.
  depends_on = [google_service_account_iam_member.pubsub_token_creator]
}

# emergency.trigger events -> Commander (so it sees emergencies from any source).
resource "google_pubsub_subscription" "commander_emergency" {
  name  = "commander-emergency"
  topic = google_pubsub_topic.bus["emergency.trigger"].name

  push_config {
    push_endpoint = "${data.google_cloud_run_v2_service.commander.uri}/pubsub"

    oidc_token {
      service_account_email = data.google_service_account.runtime.email
      audience              = data.google_cloud_run_v2_service.commander.uri
    }
  }

  ack_deadline_seconds       = 60
  message_retention_duration = "600s"

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  depends_on = [google_service_account_iam_member.pubsub_token_creator]
}

# Pub/Sub also needs publisher rights on the dead-letter topic for any
# subscription that uses dead_letter_policy.
resource "google_pubsub_topic_iam_member" "dlq_publisher" {
  topic  = google_pubsub_topic.dlq.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Allow the runtime SA to invoke the Emergency service via push subscription.
resource "google_cloud_run_v2_service_iam_member" "emergency_invoker" {
  name     = data.google_cloud_run_v2_service.emergency.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${data.google_service_account.runtime.email}"
}

# emergency.trigger -> Emergency agent (independent from Commander's subscription;
# both agents react to the same event in parallel).
resource "google_pubsub_subscription" "emergency_handler" {
  name  = "emergency-trigger-handler"
  topic = google_pubsub_topic.bus["emergency.trigger"].name

  push_config {
    push_endpoint = "${data.google_cloud_run_v2_service.emergency.uri}/pubsub"

    oidc_token {
      service_account_email = data.google_service_account.runtime.email
      audience              = data.google_cloud_run_v2_service.emergency.uri
    }
  }

  ack_deadline_seconds       = 60
  message_retention_duration = "600s"

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = 5
  }

  depends_on = [google_service_account_iam_member.pubsub_token_creator]
}
