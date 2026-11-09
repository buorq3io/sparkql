# Drizzle adoption workstreams

Improvements to sparkql drawn from drizzle-orm's v1 line. Each numbered file is a
self-contained **brief** for one agent. Read this index, then only your own brief.

## Ground rules for every brief

1. **Read the drizzle source before designing.** Every brief opens with a
   _Read first_ list. Open each file at the pinned commit and read the cited
   symbols in full. That step is done when you can explain, in your own words, how
   drizzle solves the problem and which parts of the brief's _Design direction_
   came from it. The briefs summarise drizzle; the source is the truth, and the
   summary is lossy.
2. **Adapt, then copy.** Drizzle targets SQL drivers. sparkql targets SPARQL
   endpoints, Traqula ASTs and RDF terms. Each brief says what translates and
   what does not; keep sparkql's existing names, generics (`D extends
   AnySparqlDialect`), and dialect seams unless the brief says otherwise.
3. **Leave the build green.** `check`, `typecheck` and `test` from
   `package.json` pass before and after your change (baseline: 54 tests, all
   offline; lint reports warnings only).
4. **Stay in your lane.** Touch the files your brief names. When you need a
   change owned by another brief, note it in your hand-off rather than doing it.

## Drizzle source

Use the `beta` branch, pinned to the commit these briefs were written against
(`1.0.0-rc.5`, the last release candidate before v1):

```
COMMIT=5d71fc408add08bd207f4753f4554578ec9e0640
```

Clone it outside the sparkql repo (your scratchpad), at exactly that commit, so
the line numbers below match:

```sh
git init drizzle && cd drizzle
git remote add origin https://github.com/drizzle-team/drizzle-orm.git
git fetch --depth 1 origin 5d71fc408add08bd207f4753f4554578ec9e0640
git checkout FETCH_HEAD
```

Paths in the briefs are relative to that checkout (`drizzle-orm/src/...`).
`Lnn` means line `nn` at the pinned commit. The browser equivalent is
`https://github.com/drizzle-team/drizzle-orm/blob/5d71fc408add08bd207f4753f4554578ec9e0640/<path>#Lnn`.
Do not use the `main` branch: it predates the v1 rewrite.

The release notes in `changelogs/drizzle-orm/1.0.0-*.md` explain the reasoning
behind many v1 changes; briefs cite the relevant ones.

## sparkql orientation

| Area | Files |
| --- | --- |
| Database entry point and factories | `src/database/base.ts` |
| Execution (await, HTTP client) | `src/database/executable.ts` |
| AST normalisation (input to Traqula AST) | `src/database/sparql-query.ts` |
| Fluent clause methods, `$dynamic` | `src/database/query.ts` |
| Query forms | `src/database/{select,ask,construct,describe,update,with,transfer}.ts` |
| Dialects and top-level query modules | `src/database/{dialect,query-module,pattern-query-module}.ts`, `docs/dialects.md`, `docs/query-modules.md` |
| Vendor entry points | `src/arq/`, `src/stardog/`, `src/{index,arq,stardog}.{mts,cts}` |
| Input types, term formatters | `src/helpers/{types,term-formats,formatters,utilities}.ts` |
| Term managers (variables, IRIs, blanks) | `src/structures/` |
| SPARQL functions and aggregates | `src/functions/` |

## Workstreams

| # | Brief | Kind | Size | Depends on |
| --- | --- | --- | --- | --- |
| 01 | [UPDATE execution has no update URL](01-update-endpoint-bug.md) | bug | S | none |
| 02 | [Real dual CJS/ESM package](02-packaging.md) | bug + tooling | M | none |
| 03 | [README and docs drift](03-docs-drift.md) | docs | S | none |
| 04 | [Session / driver layer](04-session-layer.md) | architecture | L | 01 |
| 05 | [Query errors and entity kinds](05-errors-entity-kind.md) | feature | M | 04 |
| 06 | [Logger and tracing hooks](06-logger-tracing.md) | feature | S | 04 |
| 07 | [Placeholders and prepared queries](07-prepared-placeholders.md) | feature | L | 04 |
| 08 | [Raw `sparql` template tag](08-raw-sparql-tag.md) | feature | M | none |
| 09 | [Datatype codecs for results](09-datatype-codecs.md) | feature | M | none |
| 10 | [Schema and relational queries](10-schema-relational-queries.md) | feature | XL | 09 (soft) |
| 11 | [Small builder additions](11-small-builder-additions.md) | feature | M | none |
| 12 | [Type-test suite and export-conflict test](12-test-tooling.md) | tooling | M | none |

**Merge order and conflicts.** 01 → 04 → {05, 06, 07}: all four rewrite
`src/database/executable.ts` and the `create()` options in
`src/database/base.ts`, so run them in that order (05, 06 and 07 can then run in
parallel if they rebase onto each other). Every other brief can start now.
02 and 12 both add test infrastructure; they do not share files. 10 is the
largest; it reuses 09's decoders when available and has its own fallback.
