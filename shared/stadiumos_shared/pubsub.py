"""Thin Pub/Sub helpers. Every agent uses these — no raw client code in agent files."""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from concurrent.futures import TimeoutError as FuturesTimeoutError

import structlog
from google.cloud import pubsub_v1
from pydantic import BaseModel

log = structlog.get_logger(__name__)

_PROJECT = os.environ["GCP_PROJECT_ID"]
_publisher: pubsub_v1.PublisherClient | None = None
_subscriber: pubsub_v1.SubscriberClient | None = None


def _pub() -> pubsub_v1.PublisherClient:
    global _publisher
    if _publisher is None:
        _publisher = pubsub_v1.PublisherClient()
    return _publisher


def _sub() -> pubsub_v1.SubscriberClient:
    global _subscriber
    if _subscriber is None:
        _subscriber = pubsub_v1.SubscriberClient()
    return _subscriber


def topic_path(topic: str) -> str:
    return _pub().topic_path(_PROJECT, topic)


def subscription_path(subscription: str) -> str:
    return _sub().subscription_path(_PROJECT, subscription)


def publish(topic: str, payload: BaseModel, **attributes: str) -> str:
    """Publish a Pydantic event to a topic. Returns the message ID."""
    data = payload.model_dump_json().encode("utf-8")
    future = _pub().publish(topic_path(topic), data, **attributes)
    msg_id = future.result(timeout=10)
    log.info("published", topic=topic, msg_id=msg_id, kind=type(payload).__name__)
    return msg_id


def subscribe(
    subscription: str,
    handler: Callable[[bytes, dict[str, str]], None],
    *,
    block_seconds: float | None = None,
) -> None:
    """Pull messages from a subscription. Handler gets (data_bytes, attributes).

    Set block_seconds for tests; pass None to run until interrupted.
    """

    def _wrapped(message: pubsub_v1.subscriber.message.Message) -> None:
        try:
            handler(message.data, dict(message.attributes))
            message.ack()
        except Exception:
            log.exception("handler_failed", subscription=subscription)
            message.nack()

    streaming = _sub().subscribe(subscription_path(subscription), callback=_wrapped)
    log.info("subscribed", subscription=subscription)
    try:
        streaming.result(timeout=block_seconds)
    except FuturesTimeoutError:
        streaming.cancel()


def decode[T: BaseModel](data: bytes, model: type[T]) -> T:
    return model.model_validate(json.loads(data))
