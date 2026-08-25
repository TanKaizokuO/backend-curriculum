"""Lesson 11 — three primitives, wired once and reused everywhere.

    log_event(...)               -> one JSON line per request, for one request.
    REQUEST_COUNT / REQUEST_LATENCY / CACHE_RESULT -> what /metrics answers.
    tracer                       -> one span per request, and one child span
                                     per database round trip.

A log line answers "what happened, for this one request". A metric answers
"how often, and how slow, across every request". A trace answers "where did
the time inside one request go". Three different questions. Keep them
separate, and read each from the tool built for it, not from the others.

Every span in this lesson prints to the terminal that runs `uvicorn`, through
`ConsoleSpanExporter`. A real deploy sends spans to Jaeger or a vendor over
OTLP instead; only the exporter changes, and the rest of this file stays the
same. Console output keeps the lesson runnable with no extra container.
"""

import contextvars
import json
import logging
import sys
import time
import uuid

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

# --------------------------------------------------------------------------
# Request id — set once per request, read by every log line the request
# writes, with no parameter threaded through every function call.
# --------------------------------------------------------------------------

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


def new_request_id() -> str:
    """16 hex characters. Short enough to read in a terminal, long enough
    that two requests never collide by chance."""
    return uuid.uuid4().hex[:16]


# --------------------------------------------------------------------------
# Structured logs — one JSON object per line, and nothing else on stdout.
# A JSON line is a line `jq` and a log platform can both parse; a sentence
# built with an f-string is a line only a human can parse.
# --------------------------------------------------------------------------

logger = logging.getLogger("bookmarks")
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter("%(message)s"))
logger.handlers = [_handler]
logger.propagate = False


def log_event(**fields) -> None:
    """Write one JSON line. `fields` is the whole message.

    No text is free-form, so nothing here can be found only by remembering
    the exact wording of a sentence. `grep request_id` on one id reconstructs
    one request's whole story, across every line it wrote.
    """
    record = {"ts": round(time.time(), 3), "request_id": request_id_var.get(), **fields}
    logger.info(json.dumps(record, default=str))


# --------------------------------------------------------------------------
# Metrics — a counter answers "how often"; a histogram answers "how slow,
# and in which bucket". Both survive when nobody reads the individual log
# lines, because Prometheus scrapes them on a timer and keeps every value.
# --------------------------------------------------------------------------

REQUEST_COUNT = Counter(
    "http_requests_total",
    "HTTP requests, by method, route, and status code.",
    ["method", "route", "status"],
)

REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds, by method and route.",
    ["method", "route"],
)

CACHE_RESULT = Counter(
    "bookmark_search_cache_total",
    "Search cache lookups, by result.",
    ["result"],  # hit | miss
)

DB_QUERY_DURATION = Histogram(
    "db_query_duration_seconds",
    "Database statement duration in seconds.",
)


def metrics_response() -> tuple[bytes, str]:
    """The raw text Prometheus scrapes. Read it with `curl` before you add a
    dashboard — the dashboard only draws what this text already says."""
    return generate_latest(), CONTENT_TYPE_LATEST


# --------------------------------------------------------------------------
# Tracing — one span per request, and one child span for every database round
# trip. `db.py` emits the child spans, so a handler cannot forget one. A span
# answers "where, inside this one request, did the time go", which neither
# the log line nor the metric can answer alone.
# --------------------------------------------------------------------------

provider = TracerProvider(resource=Resource.create({"service.name": "bookmarks-api"}))
provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("bookmarks")
