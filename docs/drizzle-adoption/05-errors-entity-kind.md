# 05: Query errors and entity kinds

Kind: feature. Size: M. Depends on 04. Read [README.md](README.md) first.

## Goal

Two linked pieces:

1. Every failure while executing a query surfaces as one error class that carries
   the generated SPARQL and the original error as `cause`.
2. Type checks on sparkql's own classes work across duplicate copies of the
   package (CJS + ESM, or two versions in a monorepo).

## Read first

- `drizzle-orm/src/errors.ts`: `DrizzleError`, `DrizzleQueryError` (query,
  optional params, `cause`), `TransactionRollbackError`; each declares a static
  `[entityKind]` and a `Symbol.hasInstance` that delegates to `is()`.
- `drizzle-orm/src/pg-core/async/session.ts` L59-160: where errors are wrapped
  (`executor(...).catch(e => { throw new DrizzleQueryError(...) })`), on both the
  fast path and the cache path.
- `changelogs/drizzle-orm/1.0.0-rc.5.md`: "Omitted query `params` from
  `DrizzleQueryError` by default, added `paramsInErrors`". Error messages that
  embed user data leak it into logs; drizzle made that opt-in.
- `drizzle-orm/src/entity.ts`: `entityKind = Symbol.for('drizzle:entityKind')`,
  `is(value, Class)` walking the prototype chain and caching kinds per
  constructor in a `WeakMap`.
- `drizzle-orm/tests/is.test.ts` and `drizzle-orm/tests/multiple-instances.test.ts`:
  how drizzle proves `is()` works across two loaded copies
  (`vi.resetModules()` then import again).

## sparkql today (verified)

- Execution errors are generic `Error`s, or whatever `sparql-http-client`
  throws. `requestQueryJson` (`src/database/query-module.ts`) throws
  `SPARQL query failed: <status> <statusText>`, without the query or response
  body.
- Normalisation errors (`Unsupported expression provided.` and others in
  `src/database/sparql-query.ts`) are plain `Error`s without the offending node.
- `src/` relies on structural guards (`type`/`subType` checks in
  `src/helpers/utilities.ts`, `guards.ts`) more than `instanceof`; check what
  `instanceof` uses remain (e.g. `URL`, `RegExp`, `Date` in
  `src/helpers/term-formats.ts` are platform classes and are fine).

## Design direction

- Add `SparkqlError` (base) and `SparkqlQueryError` (`query: string`,
  `cause`, plus HTTP `status` and a size-capped response body when the session
  has them). Throw it from the session boundary that brief 04 created, so every
  query form and dialect module is covered in one place.
- Execution-time data (VALUES rows, literals) is part of the SPARQL text
  itself, so the query string can contain user data. Follow drizzle's lesson:
  decide whether the full query goes into `message` or only into a property, and
  consider an opt-in like `paramsInErrors`. Document the choice.
- Give normalisation errors a dedicated subclass naming the input node's
  `type`/`subType`.
- Add `entityKind`/`is()` for sparkql's own classes (builders, errors, session
  base). Use `Symbol.for('sparkql:entityKind')` so copies share the key. Only
  adopt it where sparkql actually does class checks; this is not a mandate to
  annotate every class.

## Done when

- A failing HTTP response (status ≥ 400) from every query form, including an ARQ
  module, rejects with `SparkqlQueryError` whose `query` equals `toSPARQL()`
  and whose `cause` is the original error.
- A test loads the library twice (`vi.resetModules()`, as in drizzle's
  `multiple-instances.test.ts`) and `instanceof SparkqlQueryError` holds for an
  error thrown by the other copy.
- Errors are exported from every entry point and documented in README.

## Implementation notes

What drizzle does, and what was taken from it:

- `DrizzleQueryError(query, params, cause)` is thrown by the prepared query's
  `executor(...).catch(...)` on every path (fast path and each cache strategy).
  Its message always contains the SQL; since rc.5 `params` are left out unless
  `paramsInErrors` is set, because they are user data.
- `entity.ts` keys class identity on `Symbol.for('drizzle:entityKind')`, which
  every copy of the package shares. `is()` tries the native `instanceof` first,
  then compares the kind against the kinds collected along the value's
  constructor chain (cached per constructor in a `WeakMap`). Error classes
  override `Symbol.hasInstance` to call `is()`, so plain `instanceof` works across
  copies. `multiple-instances.test.ts` proves it with `vi.resetModules()`.

What sparkql does (`src/database/{entity,errors,executable}.ts`):

- **One choke point.** `ExecutableQuery.execute()` generates the SPARQL once,
  passes it to `makeQuery(session, sparql)` (builders no longer call
  `toSPARQL()` themselves) and wraps any rejection in `SparkqlQueryError`.
  That covers every standard form, transfers, WITH chains and every query module,
  for every session. Failures before anything is sent are not wrapped: the
  build-only rejection is a plain `SparkqlError`, and normalisation errors
  propagate as `SparkqlNormalizationError`. A `SparkqlQueryError` that is already
  thrown is not wrapped again. `WithQueryBuilderBase` overrides `execute()` to run
  `$end().execute()`, so its error's `query` is the update request actually sent.
- **Classes.** `SparkqlError` (base, `cause`), `SparkqlQueryError` (`query`,
  `cause`, `status`, `body`), `SparkqlNormalizationError` (`input`, `inputType`,
  `inputSubType`; message names the type/subType, or only the JS type of a value
  without them, never its content), and `SparqlResponseError` (`status`,
  `statusText`, `body`), which `requestQueryJson` now throws for a non-2xx
  `raw()` response instead of a plain `Error`.
- **`status`/`body`** are read from the cause: `status`/`body` properties
  (`SparqlResponseError`), or `sparql-http-client`'s `err.status` plus its
  message format `<statusText> (<status>): <body>`. That parse is tied to
  `sparql-http-client` 3.x (`lib/checkResponse.js`); with another format only
  `status` is filled. `body` is capped at `MAX_ERROR_BODY_LENGTH` (4096).
- **User data decision (user-visible).** SPARQL has no separate params; values
  are inlined in the text, so the query itself is the user data. `query` is
  always a property, but `message` contains it only with the new
  `queryInErrors: true` create option (drizzle's `paramsInErrors`, applied to
  the whole query). For HTTP failures the message names only the status
  (`Failed SPARQL query (HTTP 400 Bad Request)`), because endpoints echo the
  query in error bodies. Non-HTTP causes contribute their message, cut at 500
  characters. `queryInErrors` travels through `PrivateSparqlDatabaseOptions` and
  `QueryModuleContext` (which now extends `ExecutionContext { session,
  queryInErrors }`), so `base()`/`prefix()` keep it.
- **Message changes (user-visible).** `Unrecognized pattern provided.` is now
  `Unsupported pattern provided (type "…", subType "…").`; the other
  normalisation messages gained the same suffix. `requestQueryJson`'s
  `SPARQL query failed: <status> <statusText>` became `SparqlResponseError` and
  reaches callers as the `cause` of a `SparkqlQueryError`.
- **Entity kinds** only where sparkql or its users do class checks: the four
  error classes and `HttpSparqlSession` (`SparqlDatabase.$client` now uses
  `is()`, so a session from another copy still exposes its client). Builders are
  not annotated: nothing checks them by class. `is` and `entityKind` are exported.
- `entity.ts` collects kinds with an own-property check instead of drizzle's
  `in`, so a subclass without its own kind does not report its parent's kind
  twice; the result is the same set.

For later briefs:

- **06 (logger):** add the logger next to `queryInErrors` in `ExecutionContext`
  and `PrivateSparqlDatabaseOptions`; `execute()` already has `sparql` before the
  `try`, so log there and log the failure in the `catch`.
- **07 (prepared):** a prepared query can call `makeQuery(session, sparql)` with
  its captured string; reuse the same `try`/`catch` (factor it out of `execute()`)
  so prepared runs throw `SparkqlQueryError` too.

Validation: `typecheck`, 84 tests (73 before; new coverage in
`test/errors.spec.ts`, including a two-copy test with `vi.resetModules()`) and
`test:package` pass. A manual check confirmed that a rejection from the packed
CJS build is `instanceof` the ESM build's `SparkqlError`. `check` reports only
the two pre-existing formatting errors (`08-raw-sparql-tag.md`, this
directory's `README.md`).
