# Prepared queries

Use `sparql.placeholder()` for values that change between executions. Calling
`prepare()` snapshots the builder and caches normalization and query generation.
Each `execute(values)` sends a new request through the database session and uses
the builder's normal result decoder, logger and error handling.

```ts
import { SparqlDatabase, sparql, triples, castString } from 'sparkql';

const db = SparqlDatabase.create({ connection: 'https://example.com/sparql' });
const name = castString(db.variable('name'));
const query = db
  .select({ name })
  .where(
    triples(
      db.variable('person'),
      db.iri('http://xmlns.com/foaf/0.1/name'),
      sparql.placeholder<'name', string>('name')
    )
  )
  .limit(sparql.placeholder<'limit', number>('limit'))
  .prepare();

const text = query.toSPARQL({ name: 'Ada', limit: 10 });
const rows = await query.execute({ name: 'Ada', limit: 10 });
const otherRows = await query.execute({ name: 'Alan', limit: 20 });
```

Preparation is client-side; SPARQL endpoints receive a complete query string.
Standard SELECT, ASK, CONSTRUCT, DESCRIBE and UPDATE builders support `prepare()`,
including WITH/INSERT/DELETE chains. Build-only databases support preparation and
`toSPARQL(values)`; execution requires a session. Dialect query modules extending
`ModuleQueryBuilder` do not acquire preparation automatically.

Values can appear in triple subjects and objects, expressions, VALUES columns,
and LIMIT/OFFSET. They are RDF values, never raw SPARQL. Strings become literals,
URLs become IRIs, and database-specific `TermFormats` run on the supplied value
at execution time. Explicit AST terms, language literals and typed literals are
also supported. Forbidden IRI characters, including `>`, are percent-encoded;
other literal escaping uses Traqula's term generator. Variables are not accepted
as bound RDF values. LIMIT and OFFSET require non-negative safe integer numbers.

The first type argument names the placeholder and the second specifies its value
type. Omitting the value type permits any input at compile time; runtime term
formatting still validates it. Required names are inferred through triples,
basic pattern composition, comparison/arithmetic expressions and fluent clauses.
As with other inferred builder types, annotating an intermediate value with a
broader input type discards its specific placeholder names; missing values are
still checked at runtime.

Missing names (including inherited properties) throw before any session request.
Extra properties are ignored at runtime; TypeScript rejects unknown properties
on object literals when placeholder names are inferred. Reusing a name binds the
same value everywhere, formatting it once per call. A builder with unresolved
placeholders must be prepared before generation or execution. Changing the
original builder after preparation does not change its prepared query; call
`prepare()` again to take a new snapshot. Results are never cached.
