# sparkql

A TypeScript query builder for SPARQL with type-safe operations and intuitive API.

**This library is currently in alpha and should not be used in production.** The API is subject to change and may
contain bugs or incomplete features.

## Installation

```bash
npm install sparkql@alpha
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
