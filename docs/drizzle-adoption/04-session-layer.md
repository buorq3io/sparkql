# 04: Session / driver layer

Kind: architecture. Size: L. Depends on 01. Read [README.md](README.md) first.

## Goal

Separate _building_ a query from _running_ it. Builders produce a SPARQL string
and a result decoder; a **session** owns the transport. Users configure the
transport once (`client` or `connection`), can plug in a non-HTTP engine, and
can build queries with no transport at all.

## Read first

Read in this order; it follows a query from builder to wire.

1. `drizzle-orm/src/pg-core/query-builders/select.ts`: `PgSelectBase` holds
   config and builds SQL (`getSQL` L1135, `toSQL` L1142) but cannot run. Note
   that its constructor takes **one config object** (`session`, `dialect`,
   `fields`, `withList`, …), not positional arguments.
2. `drizzle-orm/src/pg-core/async/select.ts`: `PgAsyncSelectBase` adds
   `_prepare()` (L101), `prepare()`, `execute()`, and `QueryPromise` via
   `applyMixins`. The HKT (`PgAsyncSelectHKT`, L42) lets the shared builder
   return the async subclass from fluent methods.
3. `drizzle-orm/src/query-promise.ts`: `then` calls `execute()` on every
   await; nothing is memoised.
4. `drizzle-orm/src/pg-core/session.ts`: the abstract `PgSession`
   (`prepareQuery`, `execute`, `arrays`, `objects`) and `PgBasePreparedQuery`.
5. `drizzle-orm/src/pg-core/async/session.ts`: `PgAsyncPreparedQuery.execute`
   (L59) with its fast path, and `BasePgAsyncSession`. Skim the cache and
   transaction parts; they are out of scope.
6. `drizzle-orm/src/node-postgres/session.ts` (`NodePgSession.prepareQuery`
   L66, the `executor` closure at L80) and
   `drizzle-orm/src/node-postgres/driver.ts` (`construct` L19, `drizzle` L60,
   `drizzle.mock` L111): the per-driver adapter, the `string | {client} |
   {connection}` overloads, and `$client`.
7. `drizzle-orm/src/utils.ts` `DrizzleConfig` (L649): the shared
   construction options that briefs 05 and 06 will extend.
8. `changelogs/drizzle-orm/1.0.0-rc.1.md` ("Simplified postgres sessions")
   and `1.0.0-rc.4.md` ("replaced per-driver PreparedQuery instances with
   executors passed via sessions"): why v1 moved to executor closures instead
   of per-driver prepared-query classes.

## sparkql today (verified)

- `src/database/executable.ts`: `ExecutableQuery` is the base of every
  builder. It constructs a `sparql-http-client` `SparqlClient` per execution,
  and memoises the first result in `_promise`. So
  `const q = db.ask().where(...); await q; await q;` sends one request and
  returns a stale answer to the second await.
- Each builder implements `makeQuery(client)` against `sparql-http-client`'s
  stream API (`client.query.select`, `.ask`, `.construct`, `.update`;
  `requestQueryJson` uses `client.postDirect`). That type is imported as
  `SparqlClient` from `src/helpers/types.ts:580`.
- Builders take positional constructor args, e.g. `SelectQueryBuilderBase` in
  `src/database/select.ts`:
  `(variables, context, factoryFunctions, distinct, reduced, endpointUrl, dialect)`;
  `base.ts` calls it with `undefined, undefined`.
- `QueryModuleContext` (`src/database/query-module.ts`) already bundles
  `context`, `factory`, `dialect`, `endpointUrl`, `normalizer`: it is
  effectively the single config object drizzle passes.
- No way to set auth, headers, custom `fetch`, timeouts, or to reuse a client.

## Design direction

- **Session interface.** Define a `SparqlSession` with one method per result
  _format_, not per builder, e.g. `bindings(sparql)`, `boolean(sparql)`,
  `quads(sparql)`, `update(sparql)`, `raw(sparql, { accept })`. Query modules
  (`src/arq/queries.ts`, `src/stardog/paths.ts`) currently call
  `client.postDirect` through `requestQueryJson`; route them through `raw`.
- **Default HTTP session** wraps `sparql-http-client` and accepts its options
  (`endpointUrl`, `updateUrl` from brief 01, `headers`, `user`, `password`,
  `fetch`). Keep `sparql-http-client` types out of the public builder API so
  other sessions do not need it.
- **Construction.** Mirror drizzle's overloads on `SparqlDatabase.create`:
  `connection` (options for the default session) or `client`/`session` (a
  ready instance). Keep `endpointUrl` working as shorthand for one release, or
  state the breaking change. Expose the underlying client as `$client`.
  `base()` and `prefix()` must keep the session.
- **No session = build-only.** Without a session, `toSPARQL()`/`getSPARQL()`
  work and awaiting throws one clear error. This is drizzle's `drizzle.mock()`
  idea expressed through the existing factory.
- **Builder context object.** Replace positional constructor args with one
  context object (extend or rename `QueryModuleContext`), so standard builders
  and query modules receive the same thing. Briefs 05–07 add fields to it.
- **Execution semantics.** Decide deliberately whether await re-runs the query
  (drizzle) or stays memoised (sparkql today). Recommendation: re-run on each
  await, as drizzle does; brief 07's `prepare()` becomes the explicit reuse
  path. Record the decision in the hand-off; it is user-visible.
- **Out of scope:** drizzle's HKT builder variants. Only adopt them if you add a
  second executor flavour (sync or Effect); sparkql has one.

## Done when

- No file under `src/database/` other than the default session imports
  `sparql-http-client`.
- A test runs SELECT, ASK, CONSTRUCT, DESCRIBE, UPDATE and one dialect module
  (ARQ `json`) against an in-memory fake session, with no network.
- A test proves a custom `headers`/`fetch` reaches the HTTP request.
- Build-only databases build every query form and throw a clear error on await.
- `docs/query-modules.md` explains how a module talks to the session.
- README shows the `connection` and `client` forms.

## Implementation notes

What drizzle does, and what was taken from it:

- `PgSelectBase` builds SQL and cannot run; `PgAsyncSelectBase` adds
  `execute()` and gets `then` from `QueryPromise`, which calls `execute()` on
  every await. The session (`PgSession.prepareQuery`) owns the driver, and since
  rc.1/rc.4 a driver contributes only an `executor` closure rather than its own
  prepared-query class. `drizzle()` accepts `string | { connection } |
  { client }`, and `drizzle.mock()` builds a database around an empty client.
- sparkql has one executor flavour, so there is no build/async class split and
  no HKT. `ExecutableQuery` (`src/database/executable.ts`) stays the single base;
  it now holds a `SparqlSession | undefined` and its public `execute()` is the
  one place every query form passes through.
- Drizzle's session has one entry point per row _shape_ (`arrays`, `objects`,
  raw `execute`). The SPARQL equivalent is one per result _format_:
  `SparqlSession` (`src/database/session.ts`) has `bindings`, `boolean`, `quads`,
  `update` and `raw`. Builders keep their decoders; sessions return RDF/JS terms
  and quads.

Decisions (the first three are user-visible):

- **Await re-runs the query.** `_promise` memoisation is gone; each `await` or
  `execute()` sends a request. Brief 07's `prepare()` is the reuse path.
  `scripts/check-package.mjs` asserted the old behaviour and now expects two
  requests per builder. `WithQueryBuilderBase.$end()` became idempotent, because
  re-running a WITH chain would otherwise append its operation twice.
- **`QueryModule.execute(sparql, session, ast)`** receives a `SparqlSession`
  instead of a `sparql-http-client` client. Third-party modules that called
  `client.postDirect` must switch to `session.raw` (see `docs/query-modules.md`).
  `requestQueryJson` takes the session too.
- **Errors.** Build-only databases reject with `This database is build-only: …`
  (replaces `Database URL should be defined …`). A connection with only
  `updateUrl` rejects reads with `This connection has no \`endpointUrl\` …`.
  Both are rejections of the awaited promise, never synchronous throws.
- **Construction.** `create()` takes one of `connection` (URL string or
  `SparqlConnectionOptions`), `client` or `session`; more than one throws.
  Top-level `endpointUrl`/`updateUrl` still work and are marked `@deprecated`:
  remove them in the next major.
- **`$client` / `$session`.** `$session` is always the session. `$client` is the
  `client` you passed (its exact type, via a fifth class generic `C`), a
  `Promise` of the client for `connection` (it is created lazily because
  `sparql-http-client` is ESM-only and must be loaded with dynamic import), and
  `undefined` for custom sessions and build-only databases. `await db.$client`
  works in every case. `base()` and `prefix()` now return `this`, so the client
  type and query-module methods survive them.
- **Context object.** `QueryModuleContext` kept its name; `endpointUrl` and
  `updateUrl` were replaced by `session`. Every standard builder constructor is
  now `(context, formSpecificArgument?)`, and `QueryNormalizer` is
  `(input, context)`. `SparqlQueryBuilderBase` keeps it as `builderContext` for
  nested builders (`update` → `with`).
- **Custom `fetch`.** `sparql-http-client` pipes response bodies as Node
  streams, so a standard `fetch` (web streams) breaks SELECT and CONSTRUCT when
  passed to it directly. `HttpSparqlSession` wraps the `connection.fetch` so the
  body is a Node stream. A user-supplied `client` is used untouched.
- **HTTP methods are unchanged:** SELECT/ASK/CONSTRUCT/DESCRIBE use GET, updates
  a URL-encoded POST, `raw()` and `quads()` with a custom `accept` a direct POST.

For later briefs:

- **05 (errors):** wrap in `ExecutableQuery.execute()`; it has the builder (so
  `toSPARQL()`) and catches every form and session. `raw()` returns non-2xx
  responses unwrapped and `requestQueryJson` turns them into a plain `Error`;
  HTTP failures of the other methods are `sparql-http-client` errors with a
  numeric `status`. `SparqlDatabase.$client` and `resolveSession` use
  `instanceof HttpSparqlSession` / `isSparqlSession` (duck-typed); the
  `instanceof` is safe today only because the instance is created by the same
  module copy.
- **06 (logger):** same choke point. Add the logger to `QueryModuleContext` in
  the `SparqlDatabase` constructor and pass it through `PrivateSparqlDatabaseOptions`
  so `base()`/`prefix()` keep it, as `session` does.
- **07 (prepared):** a prepared query can capture `toSPARQL()` once and call the
  session method directly; builders' decoders live in `makeQuery(session)`.
- **02 (packaging):** the public declarations reference `sparql-http-client`
  types (`SparqlHttpClient`, previously `SparqlClient` in `helpers/types.ts`),
  so `@types/sparql-http-client` moved from `devDependencies` to
  `dependencies`. Consumers now get a typed `$client` without installing it.
- `ConstructQueryBuilderBase` and `DescribeQueryBuilderBase` are still declared
  to resolve to `QuadsInput[]` although the values are RDF/JS quads (as before
  this change). Brief 09 or 10 should correct the result type.

Validation: `typecheck`, 73 tests (54 at brief time, 62 before this change) and
`test:package` (CJS and ESM) pass. `check` reports the same two formatting
errors as before, in `08-raw-sparql-tag.md` and this directory's `README.md`;
changed files are clean. New coverage is in `test/session.spec.ts`.
