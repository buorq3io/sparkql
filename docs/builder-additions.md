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

## Typed subqueries

Call `.as()` on a SELECT to get a group pattern with its projected variables as
properties. These references retain the inner transforms and optional presence.
Projected expressions become variable references, so the outer SELECT does not
repeat their calculation.

```ts
import { castNumber, SparqlDatabase, triples } from 'sparkql';

const db = SparqlDatabase.create({ connection: 'https://example.org/sparql' });
const amount = db.variable('amount');
const sub = db
  .select({ price: castNumber(amount) })
  .where(triples(db.variable('item'), db.iri('https://example.org/price'), amount))
  .as();
const rows: { price: number }[] = await db.select({ price: sub.price }).where(sub);
```

SPARQL variables keep their original names. Matching inner and outer names join;
use different names for independent bindings. JavaScript result keys do not rename
SPARQL variables. Names that conflict with pattern members (`type`, `subType`,
`patterns`, `loc`, inherited object members) or `then` cause `.as()` to throw.
`getSelectedFields()` exposes variable references separately for those selections;
use `$asSubQuery()` for the pattern. A wildcard SELECT exposes no typed fields.
