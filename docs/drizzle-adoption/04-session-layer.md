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
