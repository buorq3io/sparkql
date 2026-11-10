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

## Comments and dialect hints

Executable builders accept `.comment(string | Record<string, string>)`. Repeated
calls append lines in call order. Strings have line separators replaced with
spaces; record keys and values are percent-encoded and sorted. Empty comments
and empty record values are omitted. Comments precede the generated request and
are not part of `getSPARQL()`'s AST, because Traqula does not preserve comments.
They apply to the whole request; converting a SELECT to a subquery carries its
patterns and variables, not its request comments.

```ts
import { SparqlDatabase } from 'sparkql';

const db = SparqlDatabase.create();
const text = db.ask().comment({ route: '/users' }).comment('request=123').toSPARQL();
// #route='%2Fusers'
// #request=123
// ASK ...
```

Comments set before `prepare()` are captured by the prepared query. Subsequent
changes to the builder do not change that prepared request. WITH operations and
their parent update share request comments.

Stardog's dialect provides `stardogDialect.hints.pragma()`, also exported as
`pragma` from `sparkql/stardog`. It supports the preamble hints `plan.cache`
(`on` or `off`) and `paths.evaluation` (`lazy` or `eager`), validating values at
runtime as well as in TypeScript. The helper returns text for `.comment()`;
it does not send a query. Scope hints require placement inside graph patterns
and are outside this helper's scope. See the [Stardog query hint reference](https://docs.stardog.com/query-stardog/query-hints).

```ts
import { pragma, SparqlDatabase } from 'sparkql/stardog';

const db = SparqlDatabase.create();
const text = db.ask().comment(pragma('plan.cache', 'off')).toSPARQL();
// #pragma plan.cache off
// ASK ...
```
