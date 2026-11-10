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
- **Transformations** - Type-safe data transformations, plus per-database [datatype codecs](#datatype-codecs)
- **Pluggable execution** - Built-in HTTP client, or [bring your own client or session](#connecting)
- **Path Expressions** - Property path support
- **Functions** - Comprehensive SPARQL function support
- **Custom dialects** - [Type-safe graph pattern extensions](docs/dialects.md), plus built-in LET/LATERAL, MOD/IDIV, and collation support through `sparkql/arq`
- **Raw SPARQL** - A [`sparql` template tag](docs/raw-sparql.md) for one-off fragments, with interpolated values escaped as RDF terms

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

### Query logging

Set `logger: true` to print each executed SPARQL request to the console, or pass
an application logger:

```typescript
import { type Logger, SparqlDatabase } from 'sparkql';

const logger: Logger = {
  logQuery(sparql, { operation, targetUrl }) {
    console.log({ operation, targetUrl, sparql });
  },
};
const db = SparqlDatabase.create({
  connection: 'https://your-sparql-endpoint.com/sparql',
  logger, // Or `true` for the default console logger.
});
await db.ask().where();
```

The logger receives the exact generated string, a standard query form (`select`,
`ask`, `construct`, `describe`, `update`) or dialect query factory name (`json`,
`constructQuads`, `paths`), and the target URL when available. Custom sessions can
provide `getRequestUrl(kind)` for URL metadata; otherwise `targetUrl` is
`undefined`. Logging happens once per session request, before sending, including
requests that fail. Building a query with `toSPARQL()` does not log it.
`base()` and `prefix()` preserve the logger. Direct calls to `$session` or
`$client` bypass builder logging.

Omit `logger` or set it to `false` to disable logging. This path uses the original
session directly and skips logger wrappers, metadata, and formatting.
`DefaultLogger` also accepts `{ writer: LogWriter }` for a custom output sink;
`NoopLogger` is available for integrations that require a logger object. Logger
callbacks are synchronous; throwing prevents the request and rejects execution.
SPARQL includes inlined values, so logging the full string includes those values.

Built-in OpenTelemetry spans are deferred. The pinned Drizzle implementation
leaves its optional API loader disabled; probing for that dependency would add
import work even when it is absent. This release adds no telemetry dependency or
import probe. Applications can instrument their custom session or `fetch`.

### Errors

Every error sparkql throws itself extends `SparkqlError`. A query that was
generated but failed to run (a network error, an HTTP error status, an engine
error from a custom session, or a result that could not be decoded) rejects with
a `SparkqlQueryError`:

| Property | Value                                                                      |
| -------- | -------------------------------------------------------------------------- |
| `query`  | The SPARQL that was sent: the builder's `toSPARQL()`                       |
| `cause`  | What the session or decoder threw, unchanged                               |
| `status` | HTTP status of a failed response, when there is one                        |
| `body`   | Body of a failed response, up to `MAX_ERROR_BODY_LENGTH` (4096) characters |

```typescript
import { SparkqlQueryError, SparqlDatabase } from 'sparkql';

const db = SparqlDatabase.create({ connection: 'https://your-sparql-endpoint.com/sparql' });
try {
  await db.ask().where();
} catch (error) {
  if (error instanceof SparkqlQueryError) {
    console.error(error.message); // 'Failed SPARQL query (HTTP 400 Bad Request)'
    console.error(error.status, error.body, error.query);
  }
}
```

Values you pass to a builder (literals, VALUES rows) are written into the
SPARQL text, so the query can contain user data. `message` therefore leaves the
query and the response body out (endpoints often echo the query in it); read
them from the properties. Create the database with `queryInErrors: true` to
append the query to `message` as well.

Other errors are thrown before anything is sent. Builder input that cannot be
turned into SPARQL throws a `SparkqlNormalizationError` from `toSPARQL()`, and
rejects with it when awaited; its `input`, `inputType` and `inputSubType` name
the rejected node. A build-only database rejects with a plain `SparkqlError`.

`instanceof` works for these classes, and for `HttpSparqlSession`, even when
the error comes from a different copy of sparkql (the CommonJS and ESM builds,
or two versions in one dependency tree). The `is(value, Class)` helper does the
same check. Every entry point (`sparkql`, `sparkql/arq`, `sparkql/stardog`)
exports them.

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

## Datatype codecs

By default, a projected variable without a cast returns an RDF/JS term. Pass
`codecs` to decode result terms by datatype once per database instead of
casting each variable:

```typescript
import { castString, defaultCodecs, SparqlDatabase, triples, xsd } from 'sparkql';

const prefixes = {
  ex: { uri: 'https://example.org/', fields: ['born', 'label', 'count'] },
} as const;
const db = SparqlDatabase.create({
  connection: 'https://your-sparql-endpoint.com/sparql',
  codecs: {
    ...defaultCodecs({ integer: 'number', decimal: 'number' }),
    iri: { decode: term => new URL(term.value) },
  },
});
const [v, n] = db.createManagers([], prefixes);

const rows = await db
  .select({ person: v.person, born: v.born, label: v.label, count: castString(v.count) })
  .where(
    triples(v.person, n.ex.born, v.born),
    triples(v.person, n.ex.label, v.label),
    triples(v.person, n.ex.count, v.count)
  );
// rows[0].born is a Date for an xsd:dateTime, rows[0].label is { value, language }
// for a language-tagged string, rows[0].person is a URL, and rows[0].count is a
// string: castString wins over the xsd:integer codec.
```

A codec table maps datatype IRIs (`rdf:langString` for language-tagged strings)
and the pseudo-keys `iri` and `blank` to codecs. The decoder runs on each bound
value by its actual datatype; unbound values stay `undefined`, and terms without
a matching codec stay terms.

**Precedence:** an explicit transform (`castX`, `castWith`, `as` with a typed
expression, a raw `sparql` expression's `.mapWith()`, functions with a fixed
result type such as `bound` or `count`) wins
over the codec table, and the codec table wins over the raw term. Codecs only
change runtime values: a bare variable is still typed as an RDF/JS term, so use a
cast where you need a precise static type. `castWith(codecs[xsd.dateTime], v.born)`
reuses a codec's decoder as a cast, so one definition drives both.

`defaultCodecs()` decodes `xsd:string` to a string, `xsd:boolean` to a boolean
(`true`/`1`), `xsd:double`/`xsd:float` to a number (including `INF` and `NaN`),
`xsd:dateTime`/`xsd:date` to a `Date` (UTC when the value has no timezone), and
`rdf:langString` to `{ value, language }`. You choose how numbers are read:
`integer: 'number' | 'bigint'` covers `xsd:integer` and its derived types, and
`decimal: 'number' | 'string'` covers `xsd:decimal`. IRIs, blank nodes and other
datatypes stay terms unless you add codecs. Nothing is decoded without `codecs`.

A codec may also `encode`: an input formatter tried after `formats.literal` and
before the built-in conversions, so encoding and decoding live together. The
`rdf:langString` default codec accepts `{ value, language }` back as input.
Encoders widen the instance's literal input type, like `formats`. Pseudo-key
codecs only decode; use `formats.iri` and `formats.blank` for those inputs.

```typescript
import { defaultCodecs, refineCodecs, SparqlDatabase, xsd } from 'sparkql';

class Celsius {
  constructor(readonly degrees: number) {}
}
const celsius = 'https://example.org/celsius';

const db = SparqlDatabase.create({
  codecs: refineCodecs(defaultCodecs({ integer: 'bigint', decimal: 'string' }), {
    [xsd.string]: undefined, // keep plain strings as terms
    [celsius]: {
      decode: term => new Celsius(Number(term.value)),
      encode: {
        test: (value): value is Celsius => value instanceof Celsius,
        format: (value, factory) => factory.literal(String(value.degrees), factory.iri(celsius)),
      },
    },
  }),
});

db.literal(new Celsius(21)); // "21"^^<https://example.org/celsius>
db.literal({ value: 'chat', language: 'fr' }); // "chat"@fr
```

`refineCodecs` merges tables per key and per hook, later tables winning; a key set
to `undefined` is removed. Codecs survive `base()` and `prefix()` and work the
same in `sparkql/arq` and `sparkql/stardog` databases. Encoders also apply to
values interpolated into `sparql` templates. Codecs apply to SELECT results; the ARQ `json()` module returns ARQ's own JSON scalars, which carry no
datatype, so codecs do not apply there.

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

`pnpm test:types` compiles the type tests in `test/types/` (one file per feature, checked with
`expectTypeOf(...).toEqualTypeOf<...>()` and `// @ts-expect-error`; never executed).
`pnpm test:exports` fails when a barrel exports one name from two places, such as two `export *`
sources or a local export that shadows one; intended overrides are listed in `test/exports.spec.ts`.
Both also run in CI, and `test:exports` is part of `pnpm test`.
