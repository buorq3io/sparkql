# 09: Datatype codecs for results

Kind: feature. Size: M. Read [README.md](README.md) first.

## Goal

Configure, once per database, how RDF terms decode into JavaScript values by
datatype, so `db.select({ born: v.born })` returns a `Date` for an
`xsd:dateTime` without a per-variable `castDate`. Pair it with the existing input
formatters so encoding and decoding are configured in one place.

## Read first

- `drizzle-orm/src/codecs.ts`: the `Codec` interface (L13): separate
  `normalize` (decode), `normalizeParam` (encode) and `cast` hooks, and the
  `CodecsCollection` (L83) resolving codecs per type name.
- `drizzle-orm/src/pg-core/codecs.ts`: `PostgresType` (L86) and `PgCodecs`
  (L927): a closed, typed set of type keys.
- `drizzle-orm/src/node-postgres/codecs.ts` (`nodePgCodecs`, L22): per-driver
  defaults that refine the generic set, and keys like `'numeric:number'` vs
  `'numeric:bigint'` (one type, alternative JS representations).
- `drizzle-orm/src/pg-core/dialect.ts` L92-100 and L285: where the collection
  is created from config and applied.
- `changelogs/drizzle-orm/1.0.0-rc.1.md` (codec system introduced, and why: the
  same type arrived differently from different drivers and contexts) and
  `1.0.0-rc.5.md` (codec reshuffles: what they had to undo).

## sparkql today (verified)

- Unannotated projected variables return RDF/JS terms
  (`DefaultQueryReturnType` in `src/helpers/types.ts`).
- Typing is per expression: `castNumber(v.x)`, `castDate(v.x)`,
  etc., and functions with fixed result types (e.g. `bound` →
  `transformBoolean`) attach a `transform`; see
  `src/structures/expression.ts` L132-235 and `src/functions/`.
  `SelectQueryBuilderBase` applies the transforms
  (`src/database/select.ts` `makeQuery`).
- Input-side formatters are configurable per database (`formats` option,
  `src/helpers/term-formats.ts` `TermFormats`, `defaultTermFormats`), keyed by
  term kind (iri / literal / blank), not by datatype.

## Design direction

- **Codec table keyed by datatype IRI** (plus pseudo-keys for
  `rdf:langString`, IRIs and blank nodes). A codec decodes a term to a JS value
  and, optionally, encodes a JS value to a term. The decoder applies at runtime
  from the term's actual datatype.
- **Precedence:** an explicit per-expression `transform` (`castX`, `as`,
  function result types) wins over the codec table; the codec table wins over
  returning the raw term. Opting in should not change existing results for users
  who pass no codecs; state any default you enable.
- **Static types:** runtime decoding by datatype cannot be known statically for
  a bare variable. Keep `castX`/typed variables as the way to get precise static
  types; codecs improve runtime values. Consider `castX` reading from the table
  so one definition drives both. Brief 10 will declare datatypes per property and
  needs exactly this: a decoder looked up from a declared datatype, with a static
  type attached.
- **Ship a default set** (`xsd:integer`/`decimal`/`double`, `xsd:boolean`,
  `xsd:dateTime`/`date`, `rdf:langString` → `{ value, language }`), with the
  number-vs-bigint choice made explicit, as drizzle's `'numeric:bigint'` does.
- Also apply codecs to the ARQ `json` module only if ARQ's JSON output
  preserves datatypes; `docs/query-modules.md` says it does not, so likely leave
  it out and say so.

## Done when

- With a codec table configured, a SELECT returning integers, decimals,
  booleans, dates, lang strings and IRIs decodes each by datatype, and an
  explicit `castX` still wins.
- Without codecs configured, existing tests pass unchanged.
- The codec table survives `base()`/`prefix()` and works in ARQ/Stardog databases.
- A docs section shows configuring codecs and the precedence rule.
