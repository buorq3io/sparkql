# Extending SPARQL with dialects

A database defaults to SPARQL 1.1. Configure a dialect to accept additional graph
patterns, such as ARQ's LET and LATERAL, without widening every database in the
application or augmenting global types.

## Built-in ARQ support

Import `sparkql/arq` to use LET, LATERAL, MOD, IDIV, and collation directly. Its `SparqlDatabase.create()`
automatically configures the ARQ dialect and accepts the same manager, endpoint,
and term-format options as the standard database. The entry point also exports
the standard query helpers, `letBinding()`, `lateral()`, `mod()`, `idiv()`,
`collation()`, and `arqDialect`.
No generator setup or extra dependency installation is needed.

```ts
import { SparqlDatabase, optional, letBinding, lateral } from 'sparkql/arq';
import { SparqlDatabase as StandardDatabase } from 'sparkql';

const db = SparqlDatabase.create();
const value = db.variable('value');

const query = db.select({ value }).where(optional(lateral(letBinding(42, value))));

console.log(query.toSPARQL());
// SELECT ?value WHERE { OPTIONAL { LATERAL { LET (?value := 42) } } }
// Literal spelling and whitespace are controlled by the generator.

// Custom nodes retain their normalized types in query.getSPARQL().
// SELECT result inference and fluent method restrictions are preserved.

const standard = StandardDatabase.create();
// @ts-expect-error: this database has no ARQ extensions
standard.select().where(letBinding(42, value));
```

The shipped ARQ support covers LET and LATERAL graph patterns, numeric MOD and
IDIV expressions, and locale-aware collation. These helpers use existing
expression types and require no new expression node kinds. You can also import `arqDialect` from `sparkql/arq` and pass it explicitly to the standard
`SparqlDatabase.create({ dialect: arqDialect })` factory. Its implementation is in
[src/arq/dialect.ts](../src/arq/dialect.ts) and can serve as a reference for custom
dialects.

### Arithmetic and locale-aware sorting

```ts
import { SparqlDatabase, as, mod, idiv, collation, desc } from 'sparkql/arq';

const db = SparqlDatabase.create();
const value = db.variable('value');
const label = db.variable('label');

const query = db
  .select({
    remainder: as(mod(value, 3), db.variable('remainder')),
    quotient: as(idiv(value, 3), db.variable('quotient')),
    label,
  })
  .where()
  .orderBy(desc(collation('fi', label)));
```

`mod(left, right)` emits `MOD(left, right)` and `idiv(left, right)` emits
`IDIV(left, right)`, both accepted by the
[Jena ARQ grammar](https://github.com/apache/jena/blob/main/jena-arq/Grammar/arq.jj).
They accept two expressions and compose with existing arithmetic, filters,
aggregates, bindings, LET, and solution modifiers. Selected results infer `number`
and use the same numeric result conversion as the standard arithmetic helpers.
ARQ evaluates the operations, including division-by-zero errors and truncation
toward zero for IDIV; Sparkql does not evaluate them in JavaScript.

`collation(locale, expression)` emits
`<http://jena.apache.org/ARQ/function#collation>(locale, expression)` without
requiring a prefix declaration. Use it directly in `orderBy()` or wrap it with
`asc()`/`desc()`. Both arguments accept expressions, including variables; a string
locale is normalized as a literal. The helper creates Jena's sorting key and
returns an RDF literal if projected, with no JavaScript sorting or conversion.
Locale handling and fallback follow the endpoint's JVM, as described in
[Jena's collation documentation](https://jena.apache.org/documentation/query/collation.html).

## Amazon Neptune query hints

Import `sparkql/neptune` to add [Neptune SPARQL query hints](https://docs.aws.amazon.com/neptune/latest/userguide/sparql-query-hints.html).
Its `SparqlDatabase.create()` configures `neptuneDialect`, which is also exported
for the standard factory, and the entry point re-exports the standard helpers.

`queryHint(scope, name, value)` adds the triple `hint:<scope> hint:<name> <value>`
to the enclosing group. It is written with full IRIs, so no prefix declaration is
needed. TypeScript checks each hint's scopes and values, and the helper checks
them again at runtime for JavaScript callers:

| Hint                                               | Scopes           | Value                                                       |
| -------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| `joinOrder`                                        | `Query`, `Group` | `'Ordered'`                                                 |
| `evaluationStrategy`                               | `SubQuery`       | `'BottomUp'`                                                |
| `queryTimeout`                                     | `Query`          | milliseconds, a non-negative integer                        |
| `rangeSafe`                                        | `Query`, `Prior` | boolean                                                     |
| `queryId`                                          | `Query`          | non-empty string                                            |
| `useDFE`                                           | `Query`          | boolean                                                     |
| `describeMode`                                     | `Query`          | `'ForwardOneStep'`, `'SymmetricOneStep'`, `'CBD'`, `'SCBD'` |
| `describeIterationLimit`, `describeStatementLimit` | `Query`          | non-negative integer; `0` means no limit                    |

Neptune reads a hint where it appears. Put `Query` hints in the main `WHERE`
clause, `Group` hints in the group they affect, `SubQuery` hints inside the
subquery, and `Prior` hints right after the pattern they apply to:

```ts
import { SparqlDatabase, queryHint, triples } from 'sparkql/neptune';

const db = SparqlDatabase.create();
const [s, p, o] = [db.variable('s'), db.variable('p'), db.variable('o')];

const subquery = db
  .select({ s })
  .where(queryHint('SubQuery', 'evaluationStrategy', 'BottomUp'), triples(s, p, o))
  .as();
const query = db
  .select()
  .where(
    queryHint('Query', 'queryTimeout', 5000),
    subquery,
    triples(s, p, o),
    queryHint('Prior', 'rangeSafe', true)
  );
```

Other databases reject hints in TypeScript and when the query is generated. On
another store a hint would be an ordinary triple pattern that matches nothing,
which would silently empty the results. Hints normalize to standard triple
patterns, so the dialect reuses the standard generator.

## Ontotext GraphDB

Import `sparkql/graphdb` for GraphDB's query controls. Its `SparqlDatabase.create()`
configures `graphdbDialect`, which is also exported for the standard factory, and the
entry point re-exports the standard helpers. See the
[GraphDB documentation](https://graphdb.ontotext.com/documentation/11.5/).

### Pseudo-graphs

`ontoGraphs` holds GraphDB's pseudo-graph IRIs for `.from()` and `.fromNamed()`.
GraphDB reads them as switches rather than as graphs:

| Member                  | IRI                                               | Effect in `FROM`                                                     |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `explicit`              | `http://www.ontotext.com/explicit`                | only asserted statements                                             |
| `implicit`              | `http://www.ontotext.com/implicit`                | only inferred statements                                             |
| `disableSameAs`         | `http://www.ontotext.com/disable-sameAs`          | no `owl:sameAs` expansion: one result per equivalence class          |
| `skipRedundantImplicit` | `http://www.ontotext.com/skip-redundant-implicit` | leave out inferred statements that are also asserted in that context |

`historyAt(timestamp)` returns the history pseudo-graph
`http://www.ontotext.com/at/<timestamp>`, which shows the data as it was at that
time. The timestamp is `yyyy[MM[dd[HH[mm[ss]]]]]` in the server's time zone; other
forms throw. History is only kept while GraphDB's history plugin is enabled.

```ts
import { SparqlDatabase, historyAt, ontoGraphs, triples } from 'sparkql/graphdb';

const db = SparqlDatabase.create();
const [s, p, o] = [db.variable('s'), db.variable('p'), db.variable('o')];

const asserted = db
  .select()
  .from(ontoGraphs.explicit)
  .where(triples(s, p, o));
const lastYear = db
  .select()
  .from(historyAt('20250101'))
  .where(triples(s, p, o));
```

Like any `FROM` clause, a pseudo-graph replaces the default dataset. GraphDB
documents the filters for its default graph only. Test before relying on how they
combine with ordinary `FROM` graphs.

### Query plans

`db.explain(query)` and `db.measure(query)` take a SELECT builder and send it with
`FROM onto:explain` or `FROM onto:measure` before its other dataset clauses. The
wrapped query is not changed. `explain` asks GraphDB for its plan with estimated
iterations without running the query. `measure` runs it and reports actual
iterations and timings. Both resolve to the plan text, which GraphDB returns as
literal bindings instead of the query's solutions.

```ts
import { SparqlDatabase, triples } from 'sparkql/graphdb';

const db = SparqlDatabase.create({ connection: 'http://localhost:7200/repositories/people' });
const [s, p, o] = [db.variable('s'), db.variable('p'), db.variable('o')];

const query = db
  .select({ o })
  .where(triples(s, p, o))
  .limit(10);
const plan: string = await db.explain(query);
```

GraphDB documents query plans for SELECT only, so other query forms are rejected
in TypeScript. The plan's layout is GraphDB's and is not parsed.

### `ofn:` functions

`ofn` holds GraphDB's own functions from
`http://www.ontotext.com/sparql/functions/`. Each member prints the full function
IRI, so no prefix is needed, and selects as `number`:

- math, returning `xsd:double`: `acos`, `asin`, `atan`, `atan2`, `cbrt`,
  `copySign`, `cos`, `cosh`, `e`, `exp`, `expm1`, `floorDiv`, `floorMod`,
  `getExponent`, `hypot`, `IEEEremainder`, `log`, `log10`, `log1p`, `max`, `min`,
  `nextAfter`, `nextDown`, `nextUp`, `pi`, `pow`, `rint`, `scalb`, `signum`, `sin`,
  `sinh`, `sqrt`, `tan`, `tanh`, `toDegrees`, `toRadians`, `ulp`;
- durations, returning `xsd:long`: `yearsFromDuration` … `millisFromDuration`
  (GraphDB's `years-from-duration` and so on) and `asWeeks` … `asMillis`;
- date differences, returning `xsd:long`: `weeksBetween`, `daysBetween`,
  `hoursBetween`, `minutesBetween`, `secondsBetween`, `millisBetween`.

```ts
import { SparqlDatabase, as, ofn, triples } from 'sparkql/graphdb';

const db = SparqlDatabase.create();
const [membership, start, end, days] = ['membership', 'start', 'end', 'days'].map(name =>
  db.variable(name)
);
const startDate = db.iri('https://schema.org/startDate');
const endDate = db.iri('https://schema.org/endDate');

const query = db
  .select({ days: as(ofn.daysBetween(start, end), days) })
  .where(triples(membership, startDate, start), triples(membership, endDate, end));
// Awaited: { days: number }[]
```

GraphDB's plugin predicates (full-text search, geo-spatial, RDF Rank, similarity,
connectors) and RDF-star are not modelled yet. Plugin predicates are standard
triple patterns and can be written with `triples()`.

## The dialect contract

`defineDialect<Input, Output>()` couples three responsibilities:

- `patterns.is(value)` recognizes the custom input nodes. Give each extension a
  distinct `subType`; avoid built-in subtypes. Type guards are trusted TypeScript
  contracts, so validate external, untyped data before claiming it has your type.
- `patterns.normalize(value, context)` returns the extension's canonical AST.
  Use `context.expression()` for expressions, `context.pattern()` recursively
  for nested patterns, and `context.factory` to construct canonical RDF terms.
  Input and output types can differ: a LET input can accept a number while the
  normalized AST contains a literal node.
- `generator.generate(query)` serializes the complete normalized query or update,
  including extension nodes. Its input is
  `WithDialectPatterns<AST.SparqlQuery, Output>`. A generator that only accepts
  standard AST nodes does not satisfy an extended dialect's contract.

A union of custom input/output types allows a dialect to combine multiple
extensions. The generator must support the entire output union. Custom dialects supply their own generator without mutating the standard
dialect.

## Connecting a Traqula generator

Copy sparkql's standard builder with
`GeneratorBuilder.create(sparkqlGeneratorBuilder)` before patching rules.
`sparkqlGeneratorBuilder` (exported from `sparkql`) is Traqula's
`sparql11GeneratorBuilder` plus the rules that print [raw `sparql` nodes](raw-sparql.md).
A generator built straight from Traqula's builder cannot print them. Traqula
builders are mutable; patching the shared exported builder changes other
users of it. Patch the pattern dispatch rule to handle your custom nodes and
retain its original implementation for standard nodes. New rules can be added
with `addRule()` and invoked from that dispatch rule.

The ARQ implementation uses `typePatch()` to declare the extended root query type and wraps
`queryOrUpdate(query, context)` as the dialect's `generate()` function. Existing
Traqula rule signatures describe the standard grammar; the implementation has one
localized assertion when delegating standard nodes to those existing rules.
Sparkql callers need no assertions to use the extension.

## Scope and compatibility

Dialect types follow SELECT, SELECT DISTINCT, SELECT REDUCED, ASK, CONSTRUCT,
DESCRIBE, and UPDATE builders. They survive `base()`, `prefix()`, update chaining,
and nested `group`, `optional`, `union`, `minus`, `graph`, `service`, and
`serviceSilent` helpers. Query inputs can contain extended SELECT subqueries too.

`getSPARQL()` includes the dialect's output node types at pattern positions;
`toSPARQL()` and execution use the configured generator. The default dialect
preserves existing input/output types and behavior. Unrecognized pattern nodes
still throw `SparkqlNormalizationError` at runtime, protecting JavaScript callers that bypass TypeScript.

The pattern seam extends graph patterns. Existing expression node kinds can be
used inside custom patterns through the normalization context. Dialects can also
register [top-level query modules](query-modules.md), each with its own builder,
AST and result decoder. The built-in ARQ modules add JSON and quad construction;
the Stardog entry point adds PATHS. Custom expression node kinds and update
operation kinds require separate extension interfaces.

For a one-off fragment that no dialect covers, use the
[raw `sparql` template tag](raw-sparql.md) instead of writing a dialect. Dialects
remain the recommended route for reusable vendor features.

## Design references

Drizzle keeps its dialect separate from query construction and carries generic
state through fluent query builders. Sparkql follows that separation, retaining
its existing fluent builder restrictions and result inference rather than adding
an HKT hierarchy for a fixed set of builder classes.

These references use the pinned beta commit `5d71fc408add08bd207f4753f4554578ec9e0640`.
The query builder passes its dialect to SELECT builders; `PgSelectKind` and
`PgSelectWithout` carry selection state and omit previously used fluent methods.

- [Drizzle query builder](https://github.com/drizzle-team/drizzle-orm/blob/5d71fc408add08bd207f4753f4554578ec9e0640/drizzle-orm/src/pg-core/query-builders/query-builder.ts#L109)
- [Drizzle select types](https://github.com/drizzle-team/drizzle-orm/blob/5d71fc408add08bd207f4753f4554578ec9e0640/drizzle-orm/src/pg-core/query-builders/select.types.ts#L245)
- [Traqula generator extension guide](https://comunica.github.io/traqula/documents/modifications_create-generator.html)

- [ARQ LET assignment](https://jena.apache.org/documentation/query/assignment.html)
- [ARQ LATERAL join](https://jena.apache.org/documentation/query/lateral-join.html)
