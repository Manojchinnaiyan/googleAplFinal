terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Existing resources we created via gcloud — referenced, not managed.
data "google_service_account" "runtime" {
  account_id = "stadiumos-runtime"
}

data "google_artifact_registry_repository" "agents" {
  location      = var.region
  repository_id = "stadiumos"
}
