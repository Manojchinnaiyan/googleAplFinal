variable "project_id" {
  type        = string
  description = "GCP project ID"
  default     = "gen-lang-client-0636377017"
}

variable "region" {
  type        = string
  description = "Primary region for all resources"
  default     = "asia-south1"
}

variable "agents" {
  type        = list(string)
  description = "Agent names — each gets a Cloud Run service and Pub/Sub push subscription"
  default = [
    "commander",
    "crowd-vision",
    "flow-router",
    "emergency",
    "comms",
  ]
}
