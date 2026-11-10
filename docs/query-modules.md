# Top-level query modules

Dialects can register additional database methods through `queries`. Each method
creates a builder with its own input configuration, canonical AST, generator and
result decoder. The standard database's query union does not need to change.
Query forms stay scoped to their dialect and survive `base()` and `prefix()`.

## ARQ JSON

```ts
import { SparqlDatabase, triples } from 'sparkql/arq';

const db = SparqlDatabase.create({ connection: 'http://localhost:3030/ds/query' });
const name = db.variable('name');
const query = db
  .json({ name, source: 'catalog', active: true })
  .where(triples(db.variable('person'), db.iri('https://example.org/name'), name))
  .limit(10);

const ast = query.getSPARQL(); // JsonQueryAST
const results = await query;
// Array<{ source: string; active: boolean; name?: string | number | boolean | null }>
```

JSON template members accept variables and literal inputs, matching ARQ's
[JSON grammar](https://jena.apache.org/documentation/query/generate-json-from-sparql.html).
Compute expressions in WHERE using BIND or LET and project their variables.
An empty JSON template is rejected. Keys and literal values are escaped by the
generator.

Results are decoded from `application/json`, rather than the SPARQL bindings
format. Constant fields retain their primitive types. Variable fields are
optional because ARQ omits unbound members. Their values are JSON scalars,
reflecting ARQ's conversion of RDF terms. JavaScript variable transforms from
SELECT do not describe ARQ's JSON conversion and are not applied here; neither
are datatype codecs, since ARQ's JSON output does not carry datatypes.

## ARQ quad construction

```ts
import { SparqlDatabase, triples, quads } from 'sparkql/arq';

const db = SparqlDatabase.create({ connection: 'http://localhost:3030/ds/query' });
const s = db.variable('s');
const p = db.iri('https://example.org/name');
const name = db.variable('name');

const query = db
  .constructQuads(
    triples(s, p, name),
    quads(db.iri('https://example.org/catalog'), triples(s, p, name))
  )
  .where(triples(s, p, name));

const result = await query; // RDF/JS Quad[]
```

`constructQuads()` emits `CONSTRUCT` with a dataset template; `CONSTRUCT QUAD`
is not a new keyword. Default and named graph templates can be mixed. Execution
requests N-Quads and preserves each returned quad's graph, including the default
graph. The builder emits the complete form with WHERE. For the abbreviated
`CONSTRUCT WHERE` semantics, pass the same basic dataset patterns as both template
and WHERE patterns; filters and complex patterns are not templates.
See [Jena quad construction](https://jena.apache.org/documentation/query/construct-quad.html).

Both ARQ builders support FROM, FROM NAMED, WHERE, GROUP BY, HAVING, ORDER BY,
LIMIT, OFFSET, and trailing VALUES through shared standard clause handling.
Their WHERE clauses support the existing ARQ LET and LATERAL patterns.

## Stardog PATHS

```ts
import { SparqlDatabase, oneOrMore } from 'sparkql/stardog';

const db = SparqlDatabase.create({ connection: 'http://localhost:5820/myDb/query' });
const start = db.variable('start');
const end = db.variable('end');

const query = db
  .paths()
  .all()
  .start(start, db.iri('https://example.org/alice'))
  .end(end)
  .via(oneOrMore(db.iri('https://example.org/knows')))
  .maxLength(5)
  .limit(10);

const paths = await query; // PathResult[]
for (const path of paths) {
  for (const edge of path.edges) {
    console.log(edge.start, edge.end); // RDF/JS terms, possibly undefined
  }
}
```

The builder supports SHORTEST (default), ALL, CYCLIC, FROM/FROM NAMED, START,
END, VIA, MAX LENGTH, OFFSET, and LIMIT. Endpoint constraints can be IRIs or
`group(...)` patterns. VIA accepts a variable, property path, or one or more graph
patterns. START and END must be variables. START, END and VIA must be supplied
before the type exposes generation and execution. Missing clauses are also
rejected at runtime. Lengths and pagination must be non-negative safe integers.

Execution requests `application/sparql-results+json`. Stardog represents each
edge as a binding set and separates paths with empty binding sets. The decoder
returns `{ edges: [...] }` for each path and preserves RDF term datatypes and
language tags. Binding names depend on the query, so edge fields are represented
as a record of possibly absent RDF/JS terms. This decoder supports URI, blank-node,
and literal bindings; unsupported term encodings are rejected.

PATHS exposes its own clauses and cannot be embedded directly as a subquery.
See [Stardog's syntax and result semantics](https://docs.stardog.com/query-stardog/path-queries).

## Registering a query form

`QueryModule<Config, Ast, Result, Dialect>` describes normalization, generation and
execution. Extend `ModuleQueryBuilder` to get typed `getSPARQL()`, `toSPARQL()` and
PromiseLike execution. Each `await` (or `execute()`) sends one request; results
are not cached. Its configuration and module context are protected for use by
custom fluent methods.

```ts
import {
  SparqlDatabase,
  sparql11Dialect,
  defineDialect,
  ModuleQueryBuilder,
  type QueryModule,
  type QueryModuleContext,
} from 'sparkql';

interface ExplainAST {
  type: 'query';
  subType: 'explain';
  source: string;
}
const explainModule: QueryModule<string, ExplainAST, unknown> = {
  normalize: source => ({ type: 'query', subType: 'explain', source }),
  generate: ast => `EXPLAIN ${ast.source}`,
  execute: async (sparql, session) => {
    const response = await session.raw(sparql, { accept: 'application/json' });
    if (!response.ok) throw new Error(`Query failed: ${response.status}`);
    return response.json();
  },
};
class ExplainBuilder extends ModuleQueryBuilder<
  string,
  ExplainAST,
  unknown,
  typeof sparql11Dialect
> {
  constructor(source: string, context: QueryModuleContext<typeof sparql11Dialect>) {
    super(source, explainModule, context);
  }
}
const queries = {
  explain: (context: QueryModuleContext<typeof sparql11Dialect>) => (source: string) =>
    new ExplainBuilder(source, context),
};
const dialect = defineDialect<never, never, typeof queries>({
  ...sparql11Dialect,
  queries,
});
const db = SparqlDatabase.create({ dialect });
db.explain('SELECT * WHERE { ?s ?p ?o }').toSPARQL();
```

This illustrates registration; the example's EXPLAIN syntax and result format
must match the target endpoint. A real module should expose typed query inputs
and validate its response instead of accepting arbitrary source text.

The context provides prefix/base definitions, term factories, the session,
the dialect, and `normalizer()`. Standard builders receive the same object. The normalizer exposes pattern, expression,
quad and property-path normalization plus the standard SELECT query body.
`emptySelect(context.context)` creates a body configuration for forms that reuse
standard clauses. `PatternModuleQueryBuilder` reuses those clauses for custom
forms with WHERE, as the ARQ modules demonstrate.

### Talking to the session

A module never sees a URL or an HTTP client. `execute(sparql, session, ast)`
receives the database's `SparqlSession` and asks for the result _format_ it
needs:

| Method                               | Returns                                          | Use for                |
| ------------------------------------ | ------------------------------------------------ | ---------------------- |
| `session.bindings(sparql)`           | `SparqlBindings[]`: variable name to RDF/JS term | solution sequences     |
| `session.boolean(sparql)`            | `boolean`                                        | yes/no answers         |
| `session.quads(sparql, { accept? })` | RDF/JS `Quad[]`                                  | graphs and datasets    |
| `session.update(sparql)`             | nothing                                          | SPARQL Update requests |
| `session.raw(sparql, { accept })`    | a fetch `Response`                               | any other format       |

Prefer a decoded method when the result fits one: ARQ's `constructQuads()`
calls `quads()` with `accept: 'application/n-quads'`. Use `raw()` for formats
sparkql does not model: ARQ `json()` and Stardog `paths()` call it through
`requestQueryJson(session, sparql, accept)`, which rejects non-2xx responses
with a `SparqlResponseError` (`status`, `statusText`, `body`) and parses the
JSON body. `raw()` itself returns the response whatever its
status, so check `response.ok` when you call it directly.

`execute` only runs when the database has a session; on a build-only database
the builder rejects before reaching the module. Anything `execute` throws, from
the session or from your own result validation, reaches the caller as a
`SparkqlQueryError` with the generated SPARQL as `query` and your error as
`cause`, so throw plain errors and leave the wrapping to the builder. A
`SparkqlQueryError` you let through (from running another builder) is not
wrapped again. The default HTTP session sends
`raw()` and `quads()` with a custom `accept` as a direct POST
(`application/sparql-query` body). A custom session decides for itself how to
honour `accept`; one that cannot produce the requested format should reject.

Generate using your own copied Traqula builder and a root rule accepting the
module's AST. `QueryModule.generate()` handles that root; the dialect's existing
generator continues to handle standard queries and its pattern extensions.
The module's executor chooses the transport/result format and validates the
response. Registration rejects names that collide with existing database members
and the reserved `then` name. No global type augmentation is needed.

Custom top-level AST nodes are not automatically graph patterns or subqueries.
A module must explicitly model any nested query form its language supports.
The current built-in modules expose no such nested forms.
