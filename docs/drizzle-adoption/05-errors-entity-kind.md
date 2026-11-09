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
