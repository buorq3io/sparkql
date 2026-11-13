# Integration tests

These specs run sparkql queries against real triple stores in Docker and compare
the results with expected values. Every engine loads the same committed dataset,
[`data/sample.ttl`](data/sample.ttl), so one expectation covers every engine.
Where an engine knowingly differs, the spec records the difference.

```sh
pnpm db:up               # start every open source engine (first run pulls images)
pnpm test:integration    # wait for the engines, load the data, run the specs
pnpm db:down             # stop the engines and delete their data
```

The unit suite (`pnpm test`) skips this directory.

## Engines

| Engine     | Dialects             | Query endpoint (host)                                      |
| ---------- | -------------------- | ---------------------------------------------------------- |
| fuseki     | SPARQL 1.1, ARQ      | `http://localhost:13030/ds/query`                          |
| virtuoso   | SPARQL 1.1, Virtuoso | `http://localhost:18890/sparql`                            |
| graphdb    | SPARQL 1.1, GraphDB  | `http://localhost:17200/repositories/sparkql`              |
| rdf4j      | SPARQL 1.1, RDF4J    | `http://localhost:18080/rdf4j-server/repositories/sparkql` |
| oxigraph   | SPARQL 1.1, Oxigraph | `http://localhost:17878/query`                             |
| qlever     | SPARQL 1.1           | `http://localhost:17001/`                                  |
| blazegraph | SPARQL 1.1           | `http://localhost:19999/bigdata/namespace/kb/sparql`       |
| stardog    | SPARQL 1.1, Stardog  | `http://localhost:15820/sparkql/query`                     |

Stardog needs a license key and is off by default. To run it, put the key at
`docker/stardog-license-key.bin` (gitignored), then run:

```sh
COMPOSE_PROFILES=stardog pnpm db:up stardog
SPARKQL_ENGINES=stardog pnpm test:integration
```

RDF4J also gets a second repository, `sparkql-lucene`, which wraps its store in
a LuceneSail for the text search specs. The loader fills both with the same data.

GraphDB is pinned to 10.x because GraphDB 11 requires a license key even for
the free edition.

### Choosing engines

- With `SPARKQL_ENGINES` unset, the specs run on every engine without a license
  whose container is running. Running containers must come up; stopped ones
  are skipped with a warning. So `pnpm db:up fuseki && pnpm test:integration`
  tests only Fuseki.
- `SPARKQL_ENGINES=fuseki,qlever` requires exactly those engines and fails if
  one does not answer.
- `SPARKQL_ENGINE_TIMEOUT` sets, in seconds, how long to wait for each engine
  to answer (default 180).
- `SPARKQL_ENGINE_HOST` points at engines on another host (default `localhost`).

CI ([`.github/workflows/integration.yml`](../../.github/workflows/integration.yml))
runs one job per open source engine.

## How it works

- [`compose.yaml`](compose.yaml) only starts the servers. QLever is the
  exception: it also builds its index from the dataset at startup.
- [`setup.ts`](setup.ts) is the Vitest global setup. It waits for each engine,
  then calls the engine's `load()`, which creates the repository if needed and
  resets the store to exactly `sample.ttl`. Loading over HTTP each run means a
  stack that is already running needs no restart, even after the data changes.
- [`engines.ts`](engines.ts) lists every engine with its connection options,
  readiness probe, loader, and the dialects it evaluates.
- [`harness.ts`](harness.ts) runs a `describe` block once per matching engine
  (`describeEngines`) and simplifies results so expectations stay short:
  - IRIs become `ex:alice`.
  - Numbers become JS numbers, so `xsd:int` and `xsd:integer`, or `1.60` and
    `1.6`, compare equal.
  - Strings become `"Alice"`, and language strings become `"Le Phare"@fr`.
  - Booleans become JS booleans.
  - Other typed literals become `"1990-04-12"^^xsd:date`.
- Spec files run one at a time, because the update specs write to the shared
  stores. They write only to the scratch graph `urn:sparkql:test:scratch`.

## Writing specs

```ts
describeEngines('SELECT', 'sparql11', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);

  test('…', async () => {
    const result = await db.select({ name: v.name }).where(/* … */).orderBy(v.name);
    expect(rows(result)).toEqual([{ name: '"Alice"' } /* … */]);
  });
});
```

- Use `rows()` for ordered results and `unorderedRows()` without `ORDER BY`.
  Use `triplesOf()` for CONSTRUCT.
- If an engine departs from the standard result, use
  `expectedOn(engine, standard, { virtuoso: … })` and add a comment saying why.
  Change the expectation itself only when the spec was wrong.
- Write only to the scratch graph, and drop it in `afterEach`.

## Adding an engine or a dialect

1. Add a service to `compose.yaml` and choose a free host port in the 1xxxx
   range. Put a license-bound engine behind a compose profile.
2. Add the engine to `engines` in `engines.ts`. Give its `connection`, its
   `ready()` probe and its `load()`. Set `licensed: true` if it needs a key.
3. Add the engine to the CI matrix unless it needs a license.
4. For a new dialect, add it to `DialectName`, list it in the engine's
   `dialects`, and write a spec that calls `describeEngines('…', '<dialect>', …)`
   with the dialect's `SparqlDatabase` entry point.
