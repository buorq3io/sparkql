# 07: Placeholders and prepared queries

Kind: feature. Size: L. Depends on 04. Read [README.md](README.md) first.

## Goal

Build and generate a query once, then execute it many times with different
values: `const q = db.select(...).where(triple(v.s, n.foaf.name, sparql.placeholder('name'))).prepare(); await q.execute({ name: 'Ada' });`
Values are serialised as safe RDF terms, never spliced as raw text.

## Read first

- `drizzle-orm/src/sql/sql.ts`: `Placeholder` (L1011; note its value is
  `protected` so it does not leak into autocomplete), `sql.placeholder` (L888),
  `fillPlaceholders` (L1055, throws on a missing name), and how `Param` wraps a
  placeholder so encoders still apply (L1072).
- `drizzle-orm/src/pg-core/async/select.ts` `_prepare` (L101): everything
  expensive (selection resolution, SQL build, mapper generation) runs once and
  is cached on `config` (`config.mapper ??=`, `config.shape ??=`).
- `drizzle-orm/src/pg-core/async/session.ts` `PgAsyncPreparedQuery.execute`
  (L59): per-call work is only `fillPlaceholders` + executor + mapper.
- `drizzle-orm/src/relations.ts` `RelationsFieldFilter` (L1656): placeholders
  are accepted inside object filters too (relevant to brief 10).
- `changelogs/drizzle-orm/1.0.0-rc.4.md`: "Fixed `sql.param` passing
  `Placeholder` as expected input value to encoder function" — the
  encoder/placeholder interaction is easy to get wrong.

## sparkql today (verified)

- `getSPARQL()` re-normalises the whole input tree on every call
  (`src/database/sparql-query.ts`), and `toSPARQL()` regenerates the string with
  Traqula. Execution does both each time.
- There is no placeholder concept. Term inputs go through
  `TermFormats`/formatters (`src/helpers/term-formats.ts`) into AST terms.
- `ExecutableQuery._promise` memoises the first result (brief 04 decides
  whether that stays).

## Design direction

SPARQL has no server-side prepared statements or bind parameters, so
"prepare" here means **client-side**: cache the generated output and substitute
terms per call. Two candidate strategies; evaluate both against Traqula before
choosing, and record the choice:

- **AST substitution:** normalise once with placeholder nodes in term
  positions, then per call clone/patch those nodes with formatted terms and
  regenerate. Simple and correct, but costs a Traqula generation per call.
- **String template:** generate once with unique sentinel tokens, split the
  string on them, and join with each value's serialised term per call. Fastest;
  needs a serialiser that emits exactly what Traqula would for a term, and
  sentinels that cannot collide with user text.

Either way:

- Placeholder values go through the database's `TermFormats` (strings → literals,
  `URL` → IRIs, custom formatters), so typing and escaping match normal inputs.
- Type the placeholder's value (`sparql.placeholder<'name', string>('name')`)
  and type `execute(values)` so required names are checked.
- Missing names throw before any request, as `fillPlaceholders` does.
- Also accept placeholders in `limit()`/`offset()` (drizzle does:
  `limit(limit: number | Placeholder)`, `select.ts` L1026).
- `prepare()` returns an object with `execute(values)`, `toSPARQL(values)` and the
  decoded result type of its builder.

## Done when

- Prepared SELECT, ASK, CONSTRUCT and UPDATE execute with different values and
  send the correct, escaped SPARQL (a literal containing `"` and `\n`, an IRI
  with `>`, are tested).
- A test proves normalisation and generation run once across N executions
  (spy, or count Traqula calls).
- Missing and extra placeholder values are handled as documented, with
  type-level tests for required names.

## Implementation decision

Implemented with a string template; see [usage](../prepared-queries.md).
The pinned Drizzle sources separate placeholder filling from encoding and cache
query construction and result mapping. sparkql keeps that separation, passing
actual supplied values through the database's formatters only at execution.

Both strategies fit Traqula: AST substitution can patch a normalized tree and
call the dialect generator again, while generated full-IRI markers and the
LIMIT/OFFSET generator's verbatim output support a template. The regression suite
compares template filling with fresh normalization/generation for literals,
including escaping. AST substitution would still generate the full query on
every call, so the template strategy meets the once-only generation requirement.

Preparation clones the input, replaces each occurrence with a UUID-scoped marker,
normalizes and generates once, then splits the result once. Every marker must
occur exactly once, so a collision or a dialect that drops/duplicates markers
fails preparation. Filling joins immutable text fragments and serialized terms;
it never searches/replaces supplied text. Term serialization uses Traqula's
`varOrTerm` rule with materialized source locations, validated language/blank-node
labels, and percent-encoded forbidden IRI characters (Traqula's full-IRI rule
itself prints values verbatim). This also prevents a typed literal's source
location from selecting Traqula's raw-output shortcut.

Prepared execution shares the existing session, result mapping, logging and
query-error lifecycle. No server-side statement or result cache is introduced.
Custom top-level query modules remain responsible for their own preparation API.
