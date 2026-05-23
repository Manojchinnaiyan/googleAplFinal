locals {
  topics = [
    "crowd.density",
    "gate.event",
    "emergency.trigger",
    "agent.decision",
    "weather.update",
  ]
}

resource "google_pubsub_topic" "bus" {
  for_each = toset(local.topics)
  name     = each.key

  message_retention_duration = "86400s" # 1 day — enough for debugging the demo
}

# Dead-letter topic for failed handlers.
resource "google_pubsub_topic" "dlq" {
  name = "stadiumos.dlq"
}
