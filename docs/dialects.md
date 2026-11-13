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

## OpenLink Virtuoso

Import `sparkql/virtuoso` for Virtuoso's SPARQL extensions. Its `SparqlDatabase.create()`
configures `virtuosoDialect`, which is also exported for the standard factory, and the
entry point re-exports the standard helpers. See the
[Virtuoso SPARQL documentation](https://docs.openlinksw.com/virtuoso/rdfsparql/).

### `DEFINE` pragmas

`define(name, value)` adds a pragma such as `input:inference` or `sql:select-option`.
Place it in the outermost `WHERE` clause of a query or update: the Virtuoso generator
takes it out of the pattern and prints `DEFINE name value` before `BASE` and `PREFIX`,
where Virtuoso's grammar puts it. A pragma anywhere else, such as in a subquery, is
refused when the query is generated.

The pragma names and value types are typed in `VirtuosoPragmas`. A `URL` value prints as
an IRI, a string as a quoted string and a number as an integer. The `output:format`
pragmas are left out, because sparkql decodes standard result formats only.

```ts
import { SparqlDatabase, define, triples } from 'sparkql/virtuoso';

const db = SparqlDatabase.create();
const [s, p, o] = [db.variable('s'), db.variable('p'), db.variable('o')];

const query = db
  .select()
  .where(
    define('input:inference', 'people-rules'),
    define('input:same-as', 'yes'),
    triples(s, p, o)
  );
// DEFINE input:inference "people-rules"
// DEFINE input:same-as "yes"
// SELECT * WHERE { ?s ?p ?o . }
```

### Full-text search

`textContains(text, query, { score })` prints the `bif:contains` predicate:
`?text bif:contains "query" OPTION (score ?rank)`. The literals bound to `text`
must be in Virtuoso's full-text index. The query uses Virtuoso's text syntax:
quote words and phrases that contain spaces or other non-alphanumeric characters,
and add `*` after a word prefix of at least four characters (`'Lovel*'`; Virtuoso
rejects `'Ada*'`). Virtuoso refuses some variable names in full-text patterns
because its SQL gives them a meaning: `score`, `score_limit`, `ranges`,
`main_ranges`, `attr_ranges`, `offband`, `descending`, `start_id` and `end_id`, in
any case. `textContains` throws for them, so name the score variable `?rank` or
similar.

```ts
import { SparqlDatabase, desc, textContains, triples } from 'sparkql/virtuoso';

const db = SparqlDatabase.create();
const [s, p, o, rank] = ['s', 'p', 'o', 'rank'].map(name => db.variable(name));

const query = db
  .select({ s })
  .where(triples(s, p, o), textContains(o, '"New York" AND city', { score: rank }))
  .orderBy(desc(rank))
  .limit(10);
```

`bif.contains(text, query)` is the same test as a function, for `FILTER`.

### Transitive subqueries

`transitive(subquery, options)` prints a subquery followed by
`OPTION (TRANSITIVE, t_in (...), t_out (...), ...)`. Virtuoso repeats the subquery,
feeding each step's `out` variables back in as the next step's `in` variables. The
subquery must project every `in` and `out` variable, and `in` and `out` must have the
same length.

| Option         | Virtuoso                   | Meaning                                                 |
| -------------- | -------------------------- | ------------------------------------------------------- |
| `distinct`     | `t_distinct`               | use each binding of the inputs once                     |
| `exists`       | `t_exists`                 | generate a single path                                  |
| `noCycles`     | `t_no_cycles`              | skip paths that loop                                    |
| `cyclesOnly`   | `t_cycles_only`            | return only paths that loop                             |
| `shortestOnly` | `t_shortest_only`          | when both ends are bound, stop at the first path length |
| `min`, `max`   | `t_min (n)`, `t_max (n)`   | path length bounds; `min: 0` includes the start         |
| `direction`    | `t_direction 1/2/3`        | evaluate `forward`, `backward` or from `both` ends      |
| `stepNumber`   | `t_step ('step_no') AS ?v` | the step number on the path                             |
| `pathId`       | `t_step ('path_id') AS ?v` | an identifier of the path                               |
| `stepValues`   | `t_step (?in) AS ?v`       | the value of an input variable at each step             |

```ts
import { SparqlDatabase, eq, filter, transitive, triples } from 'sparkql/virtuoso';

const db = SparqlDatabase.create();
const [person, friend, distance] = ['person', 'friend', 'distance'].map(name => db.variable(name));
const knows = db.iri('http://xmlns.com/foaf/0.1/knows');

const step = db
  .select({ person, friend })
  .where(triples(person, knows, friend))
  .as();
const query = db
  .select({ friend, distance })
  .where(
    transitive(step, { in: [person], out: [friend], distinct: true, min: 1, stepNumber: distance }),
    filter(eq(person, db.iri('https://example.org/people/ada')))
  );
```

Bind the start or the end next to the pattern, as the `FILTER` does here, so
Virtuoso does not walk the whole graph. `t_end_flag` and `t_no_order` are not
modelled, because Virtuoso's documentation does not describe them for SPARQL.

### `bif:` and `sql:` functions

Virtuoso reserves the `bif:` prefix for SQL built-in functions and `sql:` for
Virtuoso/PL procedures owned by `DBA`. Calls print as `bif:name(...)` and
`sql:name(...)` without a prefix declaration; Virtuoso documents no IRI for them.

`bif` holds the documented geometry functions, named as Virtuoso writes them:
`st_point`, `st_intersects`, `st_within`, `st_contains`, `st_may_intersect`,
`st_distance`, `st_x`, `st_y`, `st_astext`, `st_geomfromtext`, `st_ewkt_read`,
`st_srid`, `st_setsrid`, `st_get_bounding_box`, `isgeometry` and
`haversine_deg_km`, plus `contains`. Distances and precisions are in kilometres for
latitude-longitude geometries. Tests select as booleans, distances and coordinates
as numbers and geometries as their text. `bifCall(name, args, transform?)` and
`sqlCall(name, args, transform?)` call anything else.

```ts
import { SparqlDatabase, as, bif, filter, triples } from 'sparkql/virtuoso';

const db = SparqlDatabase.create();
const [place, geometry, km] = ['place', 'geometry', 'km'].map(name => db.variable(name));
const geometryOf = db.iri('http://www.w3.org/2003/01/geo/wgs84_pos#geometry');

const centre = bif.st_point(0, 52);
const query = db
  .select({ place, km: as(bif.st_distance(geometry, centre), km) })
  .where(triples(place, geometryOf, geometry), filter(bif.st_intersects(geometry, centre, 100)));
// Awaited: { place: ..., km: number }[]
```

## Oxigraph

Import `sparkql/oxigraph` for the SPARQL 1.2 proposals Oxigraph evaluates:
[`LATERAL`](https://github.com/w3c-cg/sparql-dev/blob/main/SEP/SEP-0006/sep-0006.md)
and [`ADJUST`](https://github.com/w3c-cg/sparql-dev/blob/main/SEP/SEP-0002/sep-0002.md).
Its `SparqlDatabase.create()` configures `oxigraphDialect`, which is also exported
for the standard factory, and the entry point re-exports the standard helpers.

### LATERAL

`lateral(...patterns)` adds a `LATERAL` group. Oxigraph evaluates it once for each
solution of the patterns before it, so a subquery inside sees their bindings, as
long as it projects the shared variables:

```ts
import { SparqlDatabase, lateral, triples } from 'sparkql/oxigraph';

const db = SparqlDatabase.create();
const [person, friend, name] = ['person', 'friend', 'name'].map(name => db.variable(name));
const knows = db.iri('http://xmlns.com/foaf/0.1/knows');
const nameOf = db.iri('http://xmlns.com/foaf/0.1/name');

const oneName = db
  .select({ person, name })
  .where(triples(person, nameOf, name))
  .limit(1)
  .as();
const query = db.select({ person, name }).where(triples(person, knows, friend), lateral(oneName));
```

The group prints like ARQ's `LATERAL`, and ARQ databases accept it too. Oxigraph
has no `LET`, so the Oxigraph dialect rejects `letBinding()` from `sparkql/arq`, in
TypeScript and when the query is generated.

### ADJUST

`adjust(value, timezone)` moves an `xsd:date`, `xsd:time` or `xsd:dateTime` to
another timezone and keeps its datatype. A value with a timezone is converted; one
without gets the timezone attached. A string timezone such as `'PT2H'` or
`'-PT5H30M'` is sent as an `xsd:dayTimeDuration`; other strings throw. Any other
expression, such as a variable, is passed through. Oxigraph requires the timezone,
so the SEP's one-argument form that removes it is not offered. The result selects
as an RDF literal, since an `xsd:time` has no JavaScript `Date`.

```ts
import { SparqlDatabase, adjust, as, triples } from 'sparkql/oxigraph';

const db = SparqlDatabase.create();
const [event, start, local] = ['event', 'start', 'local'].map(name => db.variable(name));
const startDate = db.iri('https://schema.org/startDate');

const query = db
  .select({ local: as(adjust(start, 'PT2H'), local) })
  .where(triples(event, startDate, start));
// "2020-01-01T00:00:00Z" becomes "2020-01-01T02:00:00+02:00"
```

### Union default graph

Oxigraph's server takes a `union-default-graph` query parameter that makes the
default graph the union of all graphs. It is part of the protocol, not of the
query, so put it in the endpoint URL:

```ts
import { SparqlDatabase } from 'sparkql/oxigraph';

const db = SparqlDatabase.create({
  connection: {
    endpointUrl: 'http://localhost:7878/query?union-default-graph',
    updateUrl: 'http://localhost:7878/update',
  },
});
```

## Eclipse RDF4J

Import `sparkql/rdf4j` for RDF4J Server's full-text search, GeoSPARQL functions,
`rdf4j:nil` graph and query plans. Its `SparqlDatabase.create()` configures
`rdf4jDialect`, which is also exported for the standard factory, and the entry
point re-exports the standard helpers. GraphDB is built on RDF4J but has its own
entry point, `sparkql/graphdb`.

### Full-text search

`textSearch(subject, query, options?)` searches the repository's
[Lucene index](https://rdf4j.org/documentation/programming/lucene/). It prints
`subject search:matches [ search:query "..." ; ... ]` with the LuceneSail
vocabulary written as full IRIs. The query uses Lucene syntax: words, `*`
wildcards, `OR` and quoted phrases. Options:

| Option     | Effect                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| `property` | an IRI limits the search to that property; a variable receives the match's |
| `score`    | a variable that receives the score                                         |
| `snippet`  | a variable that receives the matching text, with hits in `<B>` tags        |
| `numDocs`  | at most this many matches                                                  |

```ts
import { SparqlDatabase, desc, textSearch } from 'sparkql/rdf4j';

const db = SparqlDatabase.create();
const [book, score, text] = ['book', 'score', 'text'].map(name => db.variable(name));
const label = db.iri('http://www.w3.org/2000/01/rdf-schema#label');

const query = db
  .select({ book, text })
  .where(textSearch(book, 'light*', { property: label, score, snippet: text }))
  .orderBy(desc(score));
```

Pass an array of clauses instead of one query to combine searches over several
properties, each with its own `property`, `boost` and `snippet`. The `score` is then
the combined score:

```ts
import { SparqlDatabase, textSearch } from 'sparkql/rdf4j';

const db = SparqlDatabase.create();
const [item, score] = [db.variable('item'), db.variable('score')];
const name = db.iri('https://schema.org/name');
const description = db.iri('https://schema.org/description');

const query = db.select({ item, score }).where(
  textSearch(
    item,
    [
      { query: 'lighthouse', property: name, boost: 0.8 },
      { query: 'lighthouse', property: description, boost: 0.2 },
    ],
    { score }
  )
);
```

RDF4J only evaluates the search on a repository whose store is wrapped in a
LuceneSail; other repositories return no matches. A repository configuration
for RDF4J Server looks like this:

```turtle
@prefix config: <tag:rdf4j.org,2023:config/> .
[] a config:Repository ;
  config:rep.id "books" ;
  config:rep.impl [
    config:rep.type "openrdf:SailRepository" ;
    config:sail.impl [
      config:sail.type "openrdf:LuceneSail" ;
      config:lucene.indexDir "books" ;
      config:delegate [ config:sail.type "openrdf:MemoryStore" ]
    ]
  ] .
```

The query must be a string: over HTTP, RDF4J does not evaluate a search whose
query is a variable, even one bound by `VALUES`. Other databases reject
`textSearch()` in TypeScript and when the query is generated, since on another
store the pattern would match nothing.

### GeoSPARQL functions

`geof` holds the 35 [GeoSPARQL functions](https://rdf4j.org/documentation/programming/geosparql/)
RDF4J implements: `distance` and `buffer` with a unit of measure, the geometry
operations `convexHull`, `envelope`, `boundary`, `intersection`, `union`,
`difference` and `symDifference`, `getSRID`, `relate` with a DE-9IM pattern, and
the Simple Features (`sf*`), Egenhofer (`eh*`) and RCC8 (`rcc8*`) relations. Calls
print with full IRIs. Relations select as booleans, distances as numbers and
geometries as their WKT text.

A string where a geometry is expected is sent as a `geo:wktLiteral`, since RDF4J
ignores plain strings. Units are `'metre'`, `'degree'`, `'radian'` or `'unity'`,
or an IRI; `uom` holds the four as IRIs. RDF4J reads WKT as longitude-latitude and
does not evaluate WKT that starts with a coordinate reference system IRI.

```ts
import { SparqlDatabase, as, filter, geof, lt, triples } from 'sparkql/rdf4j';

const db = SparqlDatabase.create();
const [place, wkt, metres] = ['place', 'wkt', 'metres'].map(name => db.variable(name));
const asWKT = db.iri('http://www.opengis.net/ont/geosparql#asWKT');

const distance = geof.distance(wkt, 'POINT(4.9 52.37)', 'metre');
const query = db
  .select({ place, metres: as(distance, metres) })
  .where(triples(place, asWKT, wkt), filter(lt(distance, 10000)))
  .orderBy(metres);
```

### The `rdf4j:nil` graph

RDF4J's default graph is the union of all graphs. `rdf4jNil` is RDF4J's name for
the statements outside every named graph: use it in `.from()` to query only those,
or in `graph()` to match them inside a `GRAPH` pattern.

```ts
import { SparqlDatabase, rdf4jNil, triples } from 'sparkql/rdf4j';

const db = SparqlDatabase.create();
const [s, p, o] = [db.variable('s'), db.variable('p'), db.variable('o')];
const ungrouped = db
  .select()
  .from(rdf4jNil)
  .where(triples(s, p, o));
```

### Query plans

`db.explain(query, level?)` takes a SELECT, ASK, CONSTRUCT or DESCRIBE builder and
sends it with the `explain` parameter of RDF4J's REST API. It resolves to RDF4J's
plan as text, which is not parsed:

| Level                   | Runs the query | Reports                                  |
| ----------------------- | -------------- | ---------------------------------------- |
| `'Unoptimized'`         | no             | the plan as parsed                       |
| `'Optimized'` (default) | no             | the plan RDF4J would run, with estimates |
| `'Executed'`            | yes            | plus the actual result size of each step |
| `'Timed'`               | yes            | plus the time spent in each step         |
| `'Telemetry'`           | yes            | plus call counts and other counters      |

```ts
import { SparqlDatabase, triples } from 'sparkql/rdf4j';

const db = SparqlDatabase.create({
  connection: 'http://localhost:8080/rdf4j-server/repositories/people',
});
const [s, p, o] = [db.variable('s'), db.variable('p'), db.variable('o')];

const plan: string = await db.explain(db.select().where(triples(s, p, o)), 'Executed');
```

Explain adds a URL parameter to the request, so it needs the built-in HTTP session
or a custom session whose `raw()` supports `parameters`. Other protocol
parameters, such as `infer=false` or `timeout`, can go in the endpoint URL, as in
`http://localhost:8080/rdf4j-server/repositories/people?infer=false`.

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
