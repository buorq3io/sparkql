# sparkql

A TypeScript query builder for SPARQL with type-safe operations and intuitive API.

## Installation

```bash
pnpm add sparkql
```

## Features

- **Type-safe** - Full TypeScript support with type inference
- **Fluent API** - Chainable query builder interface
- **Query Types** - Support for SELECT, ASK, CONSTRUCT, DESCRIBE, and UPDATE queries
- **Prefix Management** - Easy prefix definition and IRI handling
- **Aggregates** - Built-in aggregate functions (COUNT, SUM, AVG, etc.)
- **Transformations** - Type-safe data transformations
- **SPARQL Client** - Built-in HTTP client for executing queries
- **Path Expressions** - Property path support
- **Functions** - Comprehensive SPARQL function support
- **Custom dialects** - [Type-safe graph pattern extensions](docs/dialects.md), plus built-in LET/LATERAL, MOD/IDIV, and collation support through `sparkql/arq`

## ARQ

Use the ARQ entry point for LET, LATERAL, MOD, IDIV, and locale-aware sorting:

```typescript
import { SparqlDatabase, letBinding, lateral } from 'sparkql/arq';

const db = SparqlDatabase.create();
const value = db.variable('value');
const query = db.select({ value }).where(lateral(letBinding(42, value)));

console.log(query.toSPARQL());
```

The ARQ entry point also exports `mod(left, right)`, `idiv(left, right)`, and
`collation(locale, expression)`, along with the standard query helpers:

```typescript
import { mod, idiv, collation, desc } from 'sparkql/arq';

const remainder = mod(value, 3);
const quotient = idiv(value, 3);
const sorted = db.select().where().orderBy(desc(collation('fi', value)));
```

See the [dialect guide](docs/dialects.md) for configuration and custom extensions.

## Quick Start

```typescript
import { SparqlDatabase, triple } from 'sparkql';

const prefixes = {
  foaf: {
    uri: 'http://xmlns.com/foaf/0.1/',
      fields: []
  },
  rdf: {
    uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    fields: []
  }
}

// Create a database instance with prefixes
const db = SparqlDatabase.create({
  prefixes: prefixes,
  endpointUrl: 'https://your-sparql-endpoint.com/sparql'
});

// Create variable and IRI managers
const [v, n] = db.create([], prefixes);

// Build and execute a SELECT query
const results = await db
  .select({
    name: v.name,
    age: v.age
  })
  .where(
    triple(v.person, n.foaf.name, v.name),
    triple(v.person, n.foaf.age, v.age)
  )
  .limit(10);

console.log(results); // Type-safe results
```

## Building Queries

### SELECT Queries

```typescript
import { triple, asc } from 'sparkql';

const query = db
  .select({
    name: v.name,
    email: v.email
  })
  .where(
    triple(v.person, n.foaf.name, v.name),
    triple(v.person, n.foaf.mbox, v.email)
  )
  .orderBy(asc(v.name))
  .limit(100);

// Get SPARQL string
const sparql = query.toSPARQL();

// Execute query
const results = await query;
```

### ASK Queries

```typescript
import { triple } from 'sparkql';

const exists = await db
  .ask()
  .where(
    triple(v.s, n.rdf.type, n.foaf.Person)
  );

console.log(exists); // boolean
```

### CONSTRUCT Queries

```typescript
import { triple } from 'sparkql';

const triples = await db
  .construct(
    triple(v.person, n.rdf.type, n.foaf.Person)
  )
  .where(
    triple(v.person, n.foaf.name, v.name)
  );
```

### UPDATE Queries

```typescript
import { triple } from 'sparkql';

await db
  .update()
  .insert(
    triple(db.iri('ex:person1'), n.foaf.name, db.literal('John Doe'))
  );
```

## Per-instance input types

Configure custom input formats when creating a database. TypeScript infers the
accepted values for that instance's `iri`, `literal`, and `blank` methods from the
formatters' type guards.

```typescript
import { SparqlDatabase, triples } from 'sparkql';

class Money {
  constructor(readonly amount: number) {}
}

const db = SparqlDatabase.create({
  formats: {
    literal: [{
      test: (value): value is Money => value instanceof Money,
      format: (value: Money, factory) => factory.literal(String(value.amount)),
    }],
  },
});

const balance = db.literal(new Money(42));
const pattern = triples(
  db.iri('https://example.com/alice'),
  db.iri('https://example.com/balance'),
  balance,
);
const query = db.ask().where(pattern);

const other = SparqlDatabase.create();
// TypeScript error: Money is not an input type for this instance.
// other.literal(new Money(42));
```

Use `formats.iri`, `formats.literal`, and `formats.blank` to add formats for each
term kind. Convert custom values with the configured database's term methods,
then use the resulting terms in any query, expression, path, or update helper.
Standalone helpers accept the built-in inputs and standard terms.

Custom formatters run in array order before built-in conversions. Existing terms
pass through unchanged. IRI strings, blank labels, and omitted blank labels retain
their native constructor behavior. Formatter factories construct primitive terms
without reapplying custom formats. Built-in inputs (URLs, strings, regular
expressions, numbers, bigints, booleans, dates, and empty blank tuples) remain
available. Both `base()` and `prefix()` preserve an instance's formats and types.

This replaces global format registries and `LiteralFormatMap`,
`NamedNodeFormatMap`, and `BlankFormatMap` module augmentation. Move custom
registrations into `SparqlDatabase.create({ formats: ... })`; importing a module
no longer changes another database's accepted types or formatting behavior.

## Advanced Features

### Aggregates

```typescript
import { triple, as, count, avg } from 'sparkql';

const stats = await db
  .select({
    count: v.count,
    avgAge: v.avgAge
  })
  .where(
    ...triples(v.person, predicates(
        [n.rdf.type, n.foaf.Person],
        [n.foaf.age, v.age]
    ))
  )
  .groupBy()
  .having(
    as(count(v.person), v.count),
    as(avg(v.age), v.avgAge)
  );
```

### Optional Patterns

```typescript
import { triple, optional } from 'sparkql';

const results = await db
  .select({
    name: v.name,
    email: v.email
  })
  .where(
    triple(v.person, n.foaf.name, v.name),
    optional(
      triple(v.person, n.foaf.mbox, v.email)
    )
  );
```

### Filters

```typescript
import { triple, filter, gt } from 'sparkql';

const filtered = await db
  .select({
    name: v.name,
    age: v.age
  })
  .where(
    triple(v.person, n.foaf.name, v.name),
    triple(v.person, n.foaf.age, v.age),
    filter(gt(v.age, 18))
  );
```

## Roadmap

_Will be updated as the library matures..._

## Contributing

Contributions are welcome! Please feel free to submit a pull request.
