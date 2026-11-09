# 01: UPDATE execution has no update URL

Kind: bug. Size: S. Read [README.md](README.md) first.

## Goal

Make awaited UPDATE builders reach the endpoint. Today every one fails locally.

## Read first

- `drizzle-orm/src/node-postgres/driver.ts` L19-100 (`construct`, `drizzle`):
  the connection options accepted at construction and how they reach the
  client. Notice that drizzle accepts either a ready `client` or `connection`
  config. Brief 04 adopts that shape; for this fix, only take the idea of
  forwarding connection settings to the client in one place.

## sparkql today (verified)

- `src/database/executable.ts:20` builds
  `new SparqlClient({ endpointUrl: this.endpointUrl })` for every execution.
- `sparql-http-client` (v3.1.0, `SimpleClient.js` `postUrlencoded`) sends updates to
  `this.updateUrl` and never falls back to `endpointUrl`.
- Result: `await db.insertData(...)` (any update builder, including
  `with()`/`$end()` chains in `src/database/with.ts` and transfers) throws
  `TypeError: Invalid URL` (`ERR_INVALID_URL`) before any request is made.
  Reproduce with: `new SparqlClient({ endpointUrl: 'http://localhost:1/q' }).query.update('CLEAR ALL')`.
- `SparqlDatabaseOptions` (`src/database/base.ts`) exposes only `endpointUrl`.

## Design direction

- Add `updateUrl?: string` to `SparqlDatabaseOptions`, carried through
  `PrivateSparqlDatabaseOptions`, `base()`, `prefix()`, `QueryModuleContext`
  and every builder constructor that receives `endpointUrl`.
- Default `updateUrl` to `endpointUrl` (many stores, e.g. GraphDB and Stardog,
  accept both on one URL; Fuseki and others split `/query` and `/update`).
- Pass both URLs to `SparqlClient` in `ExecutableQuery`. Keep the change
  minimal: brief 04 replaces this plumbing with a session object, so avoid
  building abstractions here.
- The "endpoint URL must be defined" guard should check the URL the query will
  actually use (update builders need an update URL).

## Done when

- A test proves an awaited update builder POSTs to the update URL. Stub
  `fetch`, or start a local `http.createServer`, and assert method, URL and
  `update=` body. A test proves the default falls back to `endpointUrl`.
- The same holds for a `with(...).insert(...).where(...)` chain and a transfer
  (`copy`), which run through different builders.
- README documents `updateUrl` next to `endpointUrl`.
