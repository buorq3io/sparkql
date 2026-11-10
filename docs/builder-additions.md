# Builder additions

## Count solutions

`$count(...patterns)` builds a SELECT with `COUNT(*)` and awaits to a JavaScript
`number`. Its explicit numeric transform takes precedence over database codecs.
Pass `{ distinct: variable }` as the last argument to count distinct bound values.
Like other executable builders it supports `toSPARQL()`, `execute()` and `prepare()`.
SPARQL has no scalar subquery expression, so a count builder cannot be embedded in
an outer selection.

```ts
import { SparqlDatabase, triples } from 'sparkql';

const db = SparqlDatabase.create({ connection: 'https://example.org/sparql' });
const person = db.variable('person');
const name = db.variable('name');
const names = triples(person, db.iri('https://example.org/name'), name);

const total: number = await db.$count(names);
const people: number = await db.$count(names, { distinct: person });
```
