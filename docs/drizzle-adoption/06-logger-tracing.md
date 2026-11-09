# 06: Logger and tracing hooks

Kind: feature. Size: S. Depends on 04. Read [README.md](README.md) first.

## Goal

Users can see every SPARQL string sparkql sends, through a pluggable logger, and
optionally get OpenTelemetry spans, at zero cost when neither is configured.

## Read first

- `drizzle-orm/src/logger.ts`: `Logger { logQuery(query, params) }`,
  `DefaultLogger` with a pluggable `LogWriter`, `NoopLogger`.
- `drizzle-orm/src/node-postgres/driver.ts` L33-38: `logger: true` maps to
  `DefaultLogger`, `false`/absent to none, an object is used as-is.
- `drizzle-orm/src/tracing.ts` and `tracing-utils.ts`: `tracer.startActiveSpan`
  falls through to `fn()` when OpenTelemetry is absent; the named spans
  (`drizzle.operation`, `drizzle.buildSQL`, `drizzle.execute`,
  `drizzle.driver.execute`, `drizzle.mapResponse`). Note that the dynamic
  `import('@opentelemetry/api')` is commented out at this commit: work out how
  drizzle enables tracing today before copying the mechanism.
- `drizzle-orm/src/pg-core/async/session.ts` L54-100: the `fastPath` flag skips
  all span work when telemetry and cache are off; the logger is still called.
- `changelogs/drizzle-orm/1.0.0-beta.13.md` "Native Effect Logger integration":
  the logger interface as an integration point.

## sparkql today (verified)

- No logging or tracing anywhere in `src/`.

## Design direction

- `logger?: boolean | Logger` on `SparqlDatabase.create` options, carried in the
  builder/session context from brief 04 and kept through `base()`/`prefix()`.
- `Logger.logQuery(sparql: string, meta)`, where `meta` carries the operation
  (query form or module name) and the target URL. SPARQL has no separate params
  array, so do not copy drizzle's `params` argument verbatim.
- Log at the session boundary, once per request, after generation.
- Tracing: only if it can be done as an optional peer dependency with no import
  cost when absent. Otherwise ship the logger alone and say why in the hand-off.
  Spans worth having: build (normalise + generate), request, decode.

## Done when

- `logger: true` writes each executed query once; a custom `Logger` receives the
  exact string `toSPARQL()` returns and the operation name.
- With no logger, a test (or benchmark note) shows no extra work on the hot path.
- README documents the option.
