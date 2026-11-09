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
- **Pluggable execution** - Built-in HTTP client, or [bring your own client or session](#connecting)
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
import { SparqlDatabase, mod, idiv, collation, desc } from 'sparkql/arq';

const db = SparqlDatabase.create();
const value = db.variable('value');

const remainder = mod(value, 3);
const quotient = idiv(value, 3);
const sorted = db
  .select()
  .where()
  .orderBy(desc(collation('fi', value)));
```

See the [dialect guide](docs/dialects.md) for configuration and custom extensions.

## Top-level query extensions

ARQ databases also provide `json(projection)` and `constructQuads(...templates)`.
Import `SparqlDatabase` from `sparkql/stardog` for a typed `paths()` builder with
START, END, VIA, and path-specific modifiers. Each query form has its own AST and
result decoder. See [top-level query modules](docs/query-modules.md) for examples
and instructions for registering your own forms.

## Quick Start

```typescript
import { SparqlDatabase, triples } from 'sparkql';

const prefixes = {
  foaf: {
    uri: 'http://xmlns.com/foaf/0.1/',
    fields: [],
  },
  rdf: {
    uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    fields: [],
  },
};

// Create a database instance with prefixes
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: {
    endpointUrl: 'https://your-sparql-endpoint.com/sparql',
    updateUrl: 'https://your-sparql-endpoint.com/update', // Optional; defaults to endpointUrl
  },
});

// Create variable and IRI managers
const [v, n] = db.createManagers([], prefixes);

// Build and execute a SELECT query
const results = await db
  .select({
    name: v.name,
    age: v.age,
  })
  .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.age, v.age))
  .limit(10);

console.log(results); // Type-safe results
```

## Connecting

Builders produce SPARQL and decode results; a **session** runs the SPARQL.
Configure it once in `SparqlDatabase.create()` with one of `connection`,
`client` or `session`. `base()` and `prefix()` keep it.

### `connection`: the default HTTP session

A URL, or options for the built-in session
(which uses [`sparql-http-client`](https://github.com/rdf-ext/sparql-http-client)):

```typescript
import { SparqlDatabase } from 'sparkql';

const simple = SparqlDatabase.create({
  connection: 'https://your-sparql-endpoint.com/sparql',
});

const db = SparqlDatabase.create({
  connection: {
    endpointUrl: 'https://your-sparql-endpoint.com/sparql',
    updateUrl: 'https://your-sparql-endpoint.com/update', // Optional; defaults to endpointUrl
    headers: { 'x-api-key': 'secret' },
    user: 'admin', // HTTP basic authentication
    password: 'secret',
    // Any fetch implementation: add timeouts, retries, request signing...
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
  },
});

// The client is created on first use, so `$client` is a promise here.
const client = await db.$client;
```

### `client`: a `sparql-http-client` instance you own

```typescript
import { SparqlDatabase } from 'sparkql';
import SparqlClient from 'sparql-http-client';

const client = new SparqlClient({ endpointUrl: 'https://your-sparql-endpoint.com/sparql' });
const db = SparqlDatabase.create({ client });

db.$client === client; // true: reuse it for anything sparkql does not cover
```

### `session`: any other engine

Implement `SparqlSession` to run queries in-process, through another protocol,
or against a test double. It has one method per result format:

```typescript
import { type SparqlSession, SparqlDatabase } from 'sparkql';

const session: SparqlSession = {
  bindings: async sparql => [], // SELECT: one record of RDF/JS terms per solution
  boolean: async sparql => true, // ASK
  quads: async sparql => [], // CONSTRUCT and DESCRIBE: RDF/JS quads
  update: async sparql => {}, // SPARQL Update
  raw: async (sparql, { accept }) => new Response('{}'), // other result formats
};
const db = SparqlDatabase.create({ session });
await db.ask().where(); // true, without any network request
```

### Build-only

Without any of the three, a database builds queries and cannot run them:

```typescript
import { SparqlDatabase } from 'sparkql';

const db = SparqlDatabase.create();
const query = db.ask().where();
query.toSPARQL(); // 'ASK WHERE {\n}'
await query.then(undefined, error => console.log(error.message));
// This database is build-only: it has no session to execute queries with. ...
```

### Execution

`await query` and `query.execute()` send a request **every time**. A builder
never caches its result, so awaiting the same builder twice runs it twice.
Keep the awaited value if you need it again.

The top-level `endpointUrl` and `updateUrl` options are deprecated; they still
work in this release and are equivalent to `connection: { endpointUrl, updateUrl }`.

## Building Queries

### SELECT Queries

```typescript
import { SparqlDatabase, triples, asc } from 'sparkql';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] },
};
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: 'https://your-sparql-endpoint.com/sparql',
});
const [v, n] = db.createManagers([], prefixes);

const query = db
  .select({
    name: v.name,
    email: v.email,
  })
  .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.mbox, v.email))
  .orderBy(asc(v.name))
  .limit(100);

// Get SPARQL string
const sparql = query.toSPARQL();

// Execute query
const results = await query;
```

### ASK Queries

```typescript
import { SparqlDatabase, triples } from 'sparkql';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] },
};
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: 'https://your-sparql-endpoint.com/sparql',
});
const [v, n] = db.createManagers([], prefixes);

const exists = await db.ask().where(triples(v.s, n.rdf.type, n.foaf.Person));

console.log(exists); // boolean
```

### CONSTRUCT Queries

```typescript
import { SparqlDatabase, triples } from 'sparkql';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] },
};
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: 'https://your-sparql-endpoint.com/sparql',
});
const [v, n] = db.createManagers([], prefixes);

const constructed = await db
  .construct(triples(v.person, n.rdf.type, n.foaf.Person))
  .where(triples(v.person, n.foaf.name, v.name));
```

### UPDATE Queries

Build and execute an INSERT DATA update. The connection's `endpointUrl` handles
queries; `updateUrl` handles updates and defaults to `endpointUrl` when omitted.
For an update-only database, configuring just `updateUrl` is sufficient.

```typescript
import { SparqlDatabase, triples } from 'sparkql';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
};
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: {
    endpointUrl: 'https://your-sparql-endpoint.com/sparql',
    updateUrl: 'https://your-sparql-endpoint.com/update',
  },
});
const [, n] = db.createManagers([], prefixes);

const update = db.insertData(
  triples(db.iri('https://example.org/person1'), n.foaf.name, db.literal('John Doe'))
);
console.log(update.toSPARQL()); // INSERT DATA { ... }
await update;
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
    literal: [
      {
        test: (value): value is Money => value instanceof Money,
        format: (value: Money, factory) => factory.literal(String(value.amount)),
      },
    ],
  },
});

const balance = db.literal(new Money(42));
const pattern = triples(
  db.iri('https://example.com/alice'),
  db.iri('https://example.com/balance'),
  balance
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

Put aggregate bindings in the SELECT projection and aggregate filters in HAVING.
Without GROUP BY, the query aggregates all matching people into one row.

```typescript
import { SparqlDatabase, triples, as, count, avg, gt } from 'sparkql';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] },
};
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: 'https://your-sparql-endpoint.com/sparql',
});
const [v, n] = db.createManagers([], prefixes);

const stats = await db
  .select({
    count: as(count(v.person), v.count),
    avgAge: as(avg(v.age), v.avgAge),
  })
  .where(triples(v.person, n.rdf.type, n.foaf.Person), triples(v.person, n.foaf.age, v.age))
  .having(gt(count(v.person), 0));
```

### Optional Patterns

```typescript
import { SparqlDatabase, triples, optional } from 'sparkql';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] },
};
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: 'https://your-sparql-endpoint.com/sparql',
});
const [v, n] = db.createManagers([], prefixes);

const results = await db
  .select({
    name: v.name,
    email: v.email,
  })
  .where(triples(v.person, n.foaf.name, v.name), optional(triples(v.person, n.foaf.mbox, v.email)));
```

### Filters

```typescript
import { SparqlDatabase, triples, filter, gt } from 'sparkql';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] },
};
const db = SparqlDatabase.create({
  managerConfig: prefixes,
  connection: 'https://your-sparql-endpoint.com/sparql',
});
const [v, n] = db.createManagers([], prefixes);

const filtered = await db
  .select({
    name: v.name,
    age: v.age,
  })
  .where(
    triples(v.person, n.foaf.name, v.name),
    triples(v.person, n.foaf.age, v.age),
    filter(gt(v.age, 18))
  );
```

## Roadmap

_Will be updated as the library matures..._

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## Development

Run `pnpm check` to check lint and formatting with Biome. Use `pnpm check:fix` to apply safe fixes,
`pnpm lint` to run only the linter, or `pnpm format` to format supported files.

`pnpm test --run test/docs.spec.ts` typechecks every TypeScript example in `README.md` and
`docs/*.md` against the current source, offline. Keep each fenced example self-contained.
