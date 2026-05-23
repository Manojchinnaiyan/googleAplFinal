"""FastAPI bearer-token dependency for agent-to-agent HTTP calls.

The token is read once from STADIUMOS_API_TOKEN. If the env var is unset (local
dev), the dependency is a no-op so unit tests and local uvicorn don't need
secrets. When set, every request to a protected endpoint must include
`Authorization: Bearer <token>`.

In prod the longer-term plan is Cloud Run IAM + service-to-service ID tokens
(see `runtime SA roles/run.invoker` bindings in infra/subscriptions.tf), but
a shared bearer is enough hardening for a hackathon demo and removes the
"anyone with the URL can burn your Vertex quota" attack surface.
"""

from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException, status

_TOKEN = os.getenv("STADIUMOS_API_TOKEN", "").strip()


def require_bearer(authorization: str | None = Header(default=None)) -> None:
    """FastAPI dependency: validates Authorization: Bearer <token>.

    If STADIUMOS_API_TOKEN is unset (local dev), this is a no-op.
    """
    if not _TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    presented = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(presented, _TOKEN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid bearer token",
        )


def bearer_header() -> dict[str, str]:
    """Build the Authorization header for outgoing calls. Empty dict if no token."""
    return {"Authorization": f"Bearer {_TOKEN}"} if _TOKEN else {}
