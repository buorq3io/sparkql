# 10: Schema and relational queries

Kind: feature. Size: XL. Soft dependency on 09. Read [README.md](README.md) first.

## Goal

Drizzle's core loop, translated to RDF: **declare a schema → infer types →
query by shape.**

```ts
const Person = rdfClass('foaf:Person', {
  name: literal(foaf.name).$type<string>().notNull(),
  age: literal(foaf.age, xsd.integer),
  knows: ref(foaf.knows).many(),
});
const relations = defineRelations({ Person }, r => ({ Person: { knows: r.many.Person() } }));
const db = SparqlDatabase.create({ relations, connection });

type P = typeof Person.$inferSelect; // { id: string; name: string; age?: number; ... }
const people = await db.query.Person.findMany({
  columns: { name: true },
  where: { age: { gt: 18 }, knows: true },
  with: { knows: { columns: { name: true }, limit: 5 } },
  orderBy: { name: 'asc' },
  limit: 10,
});
```

This is a design-heavy brief. **Deliver a design note before code** (as
`docs/drizzle-adoption/10-design.md`) covering the decisions listed below.
Implement after the design has been reviewed, or implement a vertical slice
(`findMany` + `columns` + `where` on literal properties) if told to proceed.

## Read first

Read the release notes first; they explain the API, then the source.

1. `changelogs/drizzle-orm/1.0.0-beta.1.md` (Relational Queries v2): the whole
   API and the reasons for each change from v1: one relations definition,
   `many` without `one`, object `where`/`orderBy`, `through`, predefined
   filters, filtering by relations.
2. `changelogs/drizzle-orm/1.0.0-beta.2.md` "Relational Query Parts"
   (`defineRelationsPart`), and `1.0.0-rc.5.md` breaking changes:
   `undefined` in filters throws and `EmptyFilter` replaces it; `{}` relation
   filters are skipped and `true`/`false` test presence; the `strategy` switch
   added for slow query plans.
3. `drizzle-orm/src/table.ts` (`$inferSelect`, L252) and
   `drizzle-orm/src/column-builder.ts` (`$type`, `notNull` typing around
   L147-215): how column builders accumulate type state.
4. `drizzle-orm/src/relations.ts`:
   - definition: `defineRelations` (L1901), `defineRelationsPart` (L1931),
     `buildRelations` (L263), `One` (L338), `Many` (L403), the builder classes
     (`RelationsBuilderTable` L1531, `RelationsBuilderColumn` L1565);
   - query config types: `DBQueryConfig` (L660), `DBQueryConfigWith` (L649),
     `BuildQueryResult` (L851);
   - filters: `RelationsFieldFilter` (L1656), `RelationsFilterCommons`
     (`OR`/`AND`/`NOT`/`RAW`, L1663), `RelationsFilter` (L1699),
     `relationsFilterToSQL` (L2160), `EmptyFilter` (L3013);
   - ordering: `RelationsOrder` (L1964), `relationsOrderToSQL` (L2539);
   - result assembly: `mapRelationalRow` (L989), `mapRelationalRowFromArrays`
     (L1090).
5. `drizzle-orm/src/pg-core/query-builders/query.ts`
   (`RelationalQueryBuilder.findMany`/`findFirst` L57-90,
   `PgRelationalQuery._getQuery` L136) and
   `drizzle-orm/src/pg-core/dialect.ts` `buildRelationalQuery` (L805): how a
   config object becomes one query.
6. `drizzle-orm/src/pg-core/async/db.ts` L53-90: how `db.query.<name>` is
   installed per relation entry.
7. Tests: `drizzle-orm/tests/relation.test.ts`, `rqb-builders.test.ts`,
   `drizzle-orm/type-tests/pg/rqb-known-keys.ts`, `tables-rel.ts`.

## sparkql today (verified)

- No schema concept. The closest is `IriManagerConfig`
  (`src/structures/iri.ts`): prefixes with untyped `fields` lists, used for
  strict IRI proxies (`createManagers`).
- Result types come from projected variables (`InferredSelectResult` in
  `src/database/select.ts`), with `Presence.optional` marking
  OPTIONAL-bound variables.
- Dialects can install top-level query methods on the database
  (`QueryFactories`, `WithQueryMethods` in `src/database/query-module.ts`); the
  same mechanism can install `db.query`.

## Design decisions the note must settle

- **Identity.** A class instance is an IRI (or blank node). How is the subject
  exposed (`id`)? How are blank-node subjects handled?
- **Property cardinality.** RDF properties are multi-valued by default. Decide
  how `one` vs `many` is declared, and what `one` does when the data has
  several values (first? error? `SAMPLE`?).
- **Optionality.** `notNull` ↔ required triple pattern; nullable ↔ `OPTIONAL`.
  Every nullable property in its own OPTIONAL block is the correct encoding,
  and also a performance trap; note how `strategy` in drizzle rc.5 handled slow plans.
- **Literal typing.** Datatype and language per property; decoding uses brief
  09's codecs when present, with a local fallback otherwise.
- **Nested `with` and limits.** `limit`/`orderBy` on related collections need
  subselects (or several queries). Choose single-query vs N+1-free multi-query,
  and how result rows are regrouped into nested objects (drizzle:
  `mapRelationalRowFromArrays`). Account for row explosion from multiple `many`
  relations in one query.
- **Filters.** Map the object-filter operators (`eq`, `ne`, `gt`, `in`,
  `like`→`REGEX`/`CONTAINS`, `isNull`→`!BOUND`, relation `true`/`false`→
  `EXISTS`/`NOT EXISTS`, `RAW` → brief 08's tag if merged). Adopt
  `EmptyFilter` and throw on `undefined` from the start.
- **Named graphs.** Whether a class or a query can be scoped to a graph.
- **Placeholders.** Filters accept brief 07's placeholders if merged.
- **What not to build:** migrations, schema generation, and inserts/updates from
  the schema are out of scope for the first iteration; say if the design keeps
  the door open.

## Done when (implementation)

- `$inferSelect` and `findMany`/`findFirst` result types match the runtime
  results, checked by type-level tests modelled on drizzle's
  `type-tests/pg/rqb-known-keys.ts`.
- Generated SPARQL for each feature (columns, where, orderBy, limit/offset,
  nested with, relation filters) is snapshot-tested and parses with
  `@traqula/parser-sparql-1-1` (already a dev dependency).
- Unknown keys in `columns`/`with`/`where` are type errors and runtime errors
  (drizzle rc.5: "Improved error messages on unknown fields in RQBv2 selection").
