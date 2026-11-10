# Raw SPARQL with the `sparql` tag

Sometimes a query needs SPARQL that sparkql's helpers do not model: a vendor
function, a query hint, or an unusual pattern. The `sparql` template tag lets you
write that fragment by hand and still use it inside a builder query.

```ts
import { SparqlDatabase, as, castNumber, filter, sparql, transformNumber, triples } from 'sparkql';

const db = SparqlDatabase.create().prefix({ hint: 'http://www.bigdata.com/queryHints#' });
const doc = db.variable('doc');
const text = db.variable('text');

const score = sparql<number>`<http://example.org/fn#score>(${doc}, ${'query text'})`;

const query = db
  .select({ score: as(score.mapWith(transformNumber), db.variable('score')), doc })
  .where(
    triples(doc, db.iri('http://example.org/text'), text),
    sparql.pattern`hint:Query hint:optimizer "None" .`,
    filter(sparql`STRLEN(${text}) > ${10}`)
  )
  .orderBy(sparql`${text}`);
```

## What is verbatim and what is not

Only text written inside the template literal reaches the query unchanged.
Interpolated values (`${...}`) are never spliced in as text. Each one goes
through the same normalization as the rest of the builder:

| Interpolated value                                                       | Emitted as                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `string`, `number`, `bigint`, `boolean`, `Date`, `RegExp`                | An escaped RDF literal, such as `"it's \"quoted\""`                 |
| `URL`                                                                    | An IRI                                                              |
| `db.variable()`, `db.iri()`, `db.literal()`, `db.blank()`                | That term                                                           |
| Builder expressions (`count(v)`, `eq(a, b)`, other `sparql` expressions) | The normalized expression                                           |
| Builder patterns (`triples(...)`, `group(...)`, dialect patterns)        | The generated pattern                                               |
| A `sparql.placeholder()`                                                 | A value bound when a [prepared query](prepared-queries.md) executes |

So `${userInput}` can contain quotes, newlines or `}` and still produces exactly
one string literal. The database's custom [term formats](../README.md#per-instance-input-types)
are applied at runtime too. In TypeScript, pass a custom input through
`db.iri()` or `db.literal()` first.

Arrays, `null` and `undefined` throw instead of being guessed at. Drizzle turns
an embedded array into a value list. That is ambiguous in SPARQL, where an RDF
list, a `VALUES` row and an `IN` list are all spelled differently. Spell out the
list with `sparql.join`:

```ts
import { SparqlDatabase, filter, sparql } from 'sparkql';

const db = SparqlDatabase.create();
const s = db.variable('s');
const allowed = sparql.join(
  [new URL('http://example.org/a'), new URL('http://example.org/b')],
  sparql`, `
);

db.select().where(filter(sparql`${s} IN (${allowed})`));
```

`sparql.raw(text)` is the explicitly **unsafe** escape hatch: it emits a plain
string with no escaping or interpolation. Never pass it untrusted input. Calling
`sparql` as a function rather than a template tag throws, so a JavaScript string
cannot reach the query by accident.

## Expressions and patterns

- `` sparql`...` `` is an **expression**. It works anywhere an expression does:
  projections through `as()`, `filter()`, `bind()`, `orderBy()`, `groupBy()`,
  `having()`, function arguments and ARQ's `letBinding()`. It is printed in
  parentheses so operator precedence cannot leak into the surrounding
  expression.
- `` sparql.pattern`...` `` is a **graph pattern**. It works anywhere a pattern
  does: `where()`, `optional()`, `union()` groups, `graph()`, `service()`, ARQ's
  `lateral()`, and inside other templates. Its text goes straight into the
  enclosing group. sparkql adds a `.` after it if the text ends open (not with
  `.` or `}`), so a builder triple that follows stays separate.
- Templates nested in templates are inlined without parentheses, like drizzle's
  nested `sql`.

Templates use cooked strings, as JavaScript template literals normally do: write
`\\` to get one backslash in the SPARQL text. When a pattern ends with a
`#` comment, end the comment with a newline.

## Result types

The type argument declares what a projected value decodes to, like drizzle's
`` sql<T>`...` ``. It is only a declaration: without a transform, the endpoint's
RDF term is returned as is. Use `.mapWith()` (or a `castX()` helper) to convert
the value at runtime:

```ts
import { SparqlDatabase, as, castNumber, sparql, transformNumber } from 'sparkql';

const db = SparqlDatabase.create();
const x = db.variable('x');

const term = sparql`STRLEN(${x})`; // decodes to an RDF term
const declared = sparql<number>`STRLEN(${x})`; // typed number, still an RDF term at runtime
const decoded = declared.mapWith(transformNumber); // typed and decoded as number
const label = sparql`STR(${x})`.mapWith(value => `#${value.value}`); // string

db.select({
  length: as(decoded, db.variable('length')),
  label: as(label, db.variable('label')),
  cast: castNumber(as(term, db.variable('cast'))),
});
```

`mapWith` returns a new expression and leaves the original unchanged.

## When to use the tag, and when to write a dialect

Use the tag for one-off SPARQL: a single vendor function, a hint, a pattern one
query needs. It generates the same output with every database (standard, ARQ,
Stardog) and needs no setup.

Write a [dialect](dialects.md) when the feature is reusable: many queries need
it, it deserves typed inputs, or its output depends on normalized arguments.
A dialect checks its inputs, keeps typed AST nodes in `getSPARQL()`, and puts the
syntax in one place. The tag offers none of that: sparkql cannot check the text,
and `getSPARQL()` shows the fragment as a `raw` node with its text and
normalized values.

Custom dialects get raw-node support by copying sparkql's generator builder
(`sparkqlGeneratorBuilder`, see [Connecting a Traqula generator](dialects.md#connecting-a-traqula-generator)).
A generator built straight from Traqula's `sparql11GeneratorBuilder` cannot
print raw nodes.
