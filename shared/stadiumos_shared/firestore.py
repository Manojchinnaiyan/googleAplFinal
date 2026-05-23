"""Firestore helpers. State + audit log live here; the dashboard reads them live."""

from __future__ import annotations

import os

import structlog
from google.cloud import firestore

from stadiumos_shared.events import AgentDecision

log = structlog.get_logger(__name__)

_client: firestore.Client | None = None


def db() -> firestore.Client:
    global _client
    if _client is None:
        _client = firestore.Client(project=os.environ["GCP_PROJECT_ID"])
    return _client


def write_decision(decision: AgentDecision) -> str:
    """Append a decision to the audit log. The dashboard listens to this collection."""
    doc_ref = db().collection("decisions").document()
    doc_ref.set(decision.model_dump(mode="json"))
    log.info("decision_logged", agent=decision.agent, doc_id=doc_ref.id)
    return doc_ref.id


def update_zone_state(zone: str, fields: dict) -> None:
    """Patch a zone's live state document (read by the digital-twin dashboard)."""
    db().collection("zones").document(zone).set(fields, merge=True)
