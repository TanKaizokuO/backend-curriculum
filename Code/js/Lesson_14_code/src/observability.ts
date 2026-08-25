/**
 * Lesson 11 — three primitives, wired once, the TypeScript twin of
 * `Code/Lesson_11_code/observability.py`.
 *
 *     requestIdStorage                    -> the request id, everywhere.
 *     logEvent(...)                       -> one JSON line per request.
 *     requestCount / requestLatency / cacheResult -> what `/metrics` answers.
 *     tracer                              -> one span per request, a child
 *                                             span per database round trip
 *                                             that matters to the story.
 *
 * A log line answers "what happened, for this one request". A metric
 * answers "how often, and how slow, across every request". A trace answers
 * "where did the time inside one request go". Three different questions,
 * kept apart on purpose.
 *
 * Every span here prints to the terminal that runs `node src/server.ts`,
 * through `ConsoleSpanExporter`. A real deploy swaps in an OTLP exporter to
 * Jaeger or a vendor; nothing else in this file changes.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { trace } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Counter, Histogram, Registry } from 'prom-client';

// --------------------------------------------------------------------------
// Request id — carried through `AsyncLocalStorage`, Node's equivalent of
// Python's `contextvars`. Every `await` inside one request still resolves
// to the same id, with no parameter threaded through every function call.
// The middleware in `server.ts` calls `.run()` directly; every other reader
// calls `.getStore()` directly.
// --------------------------------------------------------------------------

export const requestIdStorage = new AsyncLocalStorage<string>();

// --------------------------------------------------------------------------
// Structured logs — one JSON object per line, and nothing else on stdout.
// --------------------------------------------------------------------------

export function logEvent(fields: Record<string, unknown>): void {
  const record = {
    ts: Math.round(Date.now() / 10) / 100,
    request_id: requestIdStorage.getStore() ?? '-',
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

// --------------------------------------------------------------------------
// Metrics — a counter answers "how often"; a histogram answers "how slow,
// and in which bucket".
// --------------------------------------------------------------------------

export const registry = new Registry();

export const requestCount = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests, by method, route, and status code.',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const requestLatency = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by method and route.',
  labelNames: ['method', 'route'] as const,
  registers: [registry],
});

export const cacheResult = new Counter({
  name: 'bookmark_search_cache_total',
  help: 'Search cache lookups, by result.',
  labelNames: ['result'] as const, // hit | miss
  registers: [registry],
});

// --------------------------------------------------------------------------
// Tracing — one span per request, a child span per database round trip that
// matters to the story.
// --------------------------------------------------------------------------

const provider = new NodeTracerProvider({
  resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: 'bookmarks-api-ts' }),
});
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();

export const tracer = trace.getTracer('bookmarks');
