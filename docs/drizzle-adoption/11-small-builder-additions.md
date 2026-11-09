# 11: Small builder additions

Kind: feature. Size: M. Read [README.md](README.md) first.

Three independent additions. Each is its own commit; ship any subset.

## A. `db.$count(...)`

### Read first

- `drizzle-orm/src/pg-core/query-builders/count.ts` (`PgCountBuilder`, L7): a
  count is an `SQL<number>`, so the same object works awaited _and_ embedded in
  another query's selection.
- `drizzle-orm/src/pg-core/async/count.ts` (`PgAsyncCountBuilder`, L13,
  `execute` L30) and `drizzle-orm/src/pg-core/async/db.ts` `$count` (L151).
- `drizzle-orm/type-tests/pg/count.ts`.

### Direction

`db.$count(...patterns)` builds `SELECT (COUNT(*) AS ?count) WHERE { ... }`,
awaits to `number`, and accepts an optional `distinct` variable
(`COUNT(DISTINCT ?x)`). Reuse the aggregates in `src/functions/aggregate.ts`.
Embedding the count as a subquery expression is optional; SPARQL has no scalar
subqueries, so it would need a sub-SELECT + variable.

### Done when

Awaiting returns a `number` (decoded from `xsd:integer`), generated SPARQL is
tested, and the method exists on ARQ and Stardog databases.

## B. Typed subqueries with `.as()`

### Read first

- `drizzle-orm/src/pg-core/query-builders/select.ts` `as()` (L1145) and
  `getSelectedFields()`: a subquery exposes its projected fields, via
  `drizzle-orm/src/selection-proxy.ts` (`SelectionProxyHandler`, L8).
- `drizzle-orm/src/subquery.ts` (`Subquery`, `WithSubquery`) and
  `drizzle-orm/type-tests/pg/subquery.ts`.

### sparkql today

`SelectQueryBuilderBase.$asSubQuery()` (`src/database/select.ts`) returns
`group(this.config)`: usable as a pattern, but the projected variables and
their types and transforms are not exposed to the outer query.

### Direction

`.as()` (or an improved `$asSubQuery()`) returns a pattern that also exposes its
projected variables with their types, transforms and presence, so
`outer.select({ name: sub.name })` keeps the inner `castX` typing. Variables
are already global in SPARQL scope, so no aliasing proxy is needed; decide how
name clashes between inner and outer variables are reported.

### Done when

Type-level and runtime tests show an inner `castNumber` projected through the
outer select returns `number`.

## C. `.comment()` and query hints

### Read first

- `drizzle-orm/src/sql/sql.ts` `sql.comment` (L902) and `sqlCommenter`
  (L910-970): encoding and sanitising comment input.
- `drizzle-orm/src/pg-core/query-builders/select.ts` `comment()` (L1078) and
  `drizzle-orm/tests/sqlcommenter.test.ts`.
- `changelogs/drizzle-orm/1.0.0-beta.19.md` (why: tagging queries for
  database-side traffic control; not supported on prepared statements).

### Direction

SPARQL comments (`# ...`) are a natural carrier, and several stores read
hints from them (Stardog `#pragma`). Implement `.comment(string | Record<string, string>)`
on the query builders, with sanitisation that guarantees one line (no newline
can end the comment early and inject SPARQL). Vendor-specific hints belong to
the dialect: let a dialect contribute typed hint helpers (e.g. a Stardog
`pragma(...)`) rather than hard-coding them. Check how Traqula's generator
emits comments before choosing where the text goes.

### Done when

Comments appear in `toSPARQL()`, newline/injection attempts are neutralised
(tested), and the output still parses with `@traqula/parser-sparql-1-1`.
