import { readFile } from 'node:fs/promises';
import type { SparqlConnectionOptions } from '#src/index.js';

/**
 * A dialect a spec targets. `sparql11` is plain SPARQL 1.1 and runs on every
 * engine; the others only run where the extension is evaluated.
 */
export type DialectName =
  | 'sparql11'
  | 'arq'
  | 'stardog'
  | 'virtuoso'
  | 'graphdb'
  | 'oxigraph'
  | 'rdf4j'
  | 'qlever';

/** A triple store started by `compose.yaml`. */
export interface Engine {
  /** The compose service name; also what `SPARKQL_ENGINES` lists. */
  readonly name: string;
  /** Dialects whose extensions the engine evaluates; `sparql11` is implied. */
  readonly dialects: readonly DialectName[];
  /** Excluded from the default run: the container needs a license key. */
  readonly licensed?: boolean;
  /** How sparkql connects to the engine. */
  readonly connection: SparqlConnectionOptions;
  /** Resolves `true` once the server answers. */
  ready(): Promise<boolean>;
  /**
   * Resets the dataset to exactly `turtle` in the default graph: creates the
   * repository when missing and drops any other data. Safe to repeat.
   */
  load(turtle: string): Promise<void>;
}

/** The graph that specs write to; `load` empties it. */
export const scratchGraph = 'urn:sparkql:test:scratch';
/** Where Virtuoso keeps the dataset: its default graph is the union of all graphs. */
const virtuosoGraph = 'https://example.org/sparkql/graph';

const host = process.env.SPARKQL_ENGINE_HOST ?? 'localhost';
const at = (port: number, path = '') => `http://${host}:${port}${path}`;
const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

/** Sends a request and throws with the response body unless the status is 2xx or listed. */
async function send(url: string, init: RequestInit = {}, accept: number[] = []): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok && !accept.includes(response.status)) {
    const body = await response.text();
    throw new Error(`${init.method ?? 'GET'} ${url} -> ${response.status}: ${body.slice(0, 500)}`);
  }
  return response;
}

/** `true` when `url` answers with any HTTP status below 500. */
async function answers(url: string, init?: RequestInit): Promise<boolean> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(2000) });
    await response.body?.cancel();
    return response.status < 500;
  } catch {
    return false;
  }
}

const turtle = (body: string, headers: HeadersInit = {}): RequestInit => ({
  body,
  headers: { 'content-type': 'text/turtle', ...headers },
});

async function update(url: string, sparql: string, headers: HeadersInit = {}): Promise<void> {
  await send(url, {
    method: 'POST',
    body: new URLSearchParams({ update: sparql }),
    headers,
  });
}

const config = (file: string) => readFile(new URL(`./docker/${file}`, import.meta.url), 'utf8');

/** RDF4J's REST API, which GraphDB also implements. */
function rdf4jRepository(root: string, createRepository: () => Promise<void>, id = 'sparkql') {
  const repository = `${root}/repositories/${id}`;
  return {
    connection: { endpointUrl: repository, updateUrl: `${repository}/statements` },
    async load(data: string) {
      const exists = await send(`${repository}/size`, {}, [404]);
      if (exists.status === 404) await createRepository();
      // PUT on statements replaces every statement in every graph.
      await send(`${repository}/statements`, { method: 'PUT', ...turtle(data) });
    },
  };
}

const rdf4jServer = at(18080, '/rdf4j-server');
const rdf4jConfigured = (id: string, file: string) =>
  rdf4jRepository(
    rdf4jServer,
    async () => {
      await send(`${rdf4jServer}/repositories/${id}`, {
        method: 'PUT',
        ...turtle(await config(file)),
      });
    },
    id
  );
const rdf4j = rdf4jConfigured('sparkql', 'rdf4j-repository.ttl');
const rdf4jLucene = rdf4jConfigured('sparkql-lucene', 'rdf4j-lucene-repository.ttl');
/** The RDF4J repository with a Lucene full-text index, for the text search specs. */
export const rdf4jLuceneConnection: SparqlConnectionOptions = rdf4jLucene.connection;

const graphdb = rdf4jRepository(at(17200), async () => {
  const form = new FormData();
  form.set('config', new Blob([await config('graphdb-repository.ttl')]), 'config.ttl');
  await send(at(17200, '/rest/repositories'), { method: 'POST', body: form });
});

const qleverAuth = { authorization: 'Bearer sparkql' };
const stardogAuth = { user: 'admin', password: 'admin' };
const stardogHeaders = { authorization: basic(stardogAuth.user, stardogAuth.password) };

/** Every engine `compose.yaml` defines. */
export const engines: readonly Engine[] = [
  {
    name: 'fuseki',
    dialects: ['arq'],
    connection: { endpointUrl: at(13030, '/ds/query'), updateUrl: at(13030, '/ds/update') },
    ready: () => answers(at(13030, '/$/ping')),
    async load(data) {
      await update(at(13030, '/ds/update'), 'DROP ALL');
      await send(at(13030, '/ds/data?default'), { method: 'PUT', ...turtle(data) });
    },
  },
  {
    name: 'virtuoso',
    dialects: ['virtuoso'],
    connection: { endpointUrl: at(18890, '/sparql') },
    ready: () => answers(at(18890, '/sparql?query=ASK%7B%7D')),
    async load(data) {
      // Never DROP ALL: Virtuoso keeps its own system graphs in the store.
      await update(at(18890, '/sparql'), `DROP SILENT GRAPH <${scratchGraph}>`);
      const graph = encodeURIComponent(virtuosoGraph);
      await send(at(18890, `/sparql-graph-crud?graph-uri=${graph}`), {
        method: 'PUT',
        ...turtle(data),
      });
    },
  },
  {
    name: 'graphdb',
    dialects: ['graphdb'],
    connection: graphdb.connection,
    ready: () => answers(at(17200, '/rest/repositories')),
    load: graphdb.load,
  },
  {
    name: 'rdf4j',
    dialects: ['rdf4j'],
    connection: rdf4j.connection,
    ready: () => answers(at(18080, '/rdf4j-server/protocol')),
    async load(data) {
      await rdf4j.load(data);
      await rdf4jLucene.load(data);
    },
  },
  {
    name: 'oxigraph',
    dialects: ['oxigraph'],
    connection: { endpointUrl: at(17878, '/query'), updateUrl: at(17878, '/update') },
    ready: () => answers(at(17878, '/')),
    async load(data) {
      await update(at(17878, '/update'), 'DROP ALL');
      await send(at(17878, '/store?default'), { method: 'PUT', ...turtle(data) });
    },
  },
  {
    name: 'qlever',
    dialects: ['qlever'],
    connection: { endpointUrl: at(17001, '/'), headers: qleverAuth },
    ready: () => answers(at(17001, '/?query=ASK%7B%7D')),
    async load(data) {
      await update(at(17001, '/'), 'DROP ALL', qleverAuth);
      await send(at(17001, '/?default'), { method: 'PUT', ...turtle(data, qleverAuth) });
    },
  },
  {
    name: 'blazegraph',
    dialects: [],
    connection: { endpointUrl: at(19999, '/bigdata/namespace/kb/sparql') },
    ready: () => answers(at(19999, '/bigdata/status')),
    async load(data) {
      const endpoint = at(19999, '/bigdata/namespace/kb/sparql');
      await update(endpoint, 'DROP ALL');
      await send(endpoint, { method: 'POST', ...turtle(data) });
    },
  },
  {
    // Not verified in CI: it needs a license key (see compose.yaml).
    name: 'stardog',
    dialects: ['stardog'],
    licensed: true,
    connection: {
      endpointUrl: at(15820, '/sparkql/query'),
      updateUrl: at(15820, '/sparkql/update'),
      ...stardogAuth,
    },
    ready: () => answers(at(15820, '/admin/alive')),
    async load(data) {
      const databases = await send(at(15820, '/admin/databases'), { headers: stardogHeaders });
      const { databases: names } = (await databases.json()) as { databases: string[] };
      if (!names.includes('sparkql')) {
        const form = new FormData();
        form.set('root', JSON.stringify({ dbname: 'sparkql', options: {}, files: [] }));
        await send(at(15820, '/admin/databases'), {
          method: 'POST',
          body: form,
          headers: stardogHeaders,
        });
      }
      await update(at(15820, '/sparkql/update'), 'DROP ALL', stardogHeaders);
      const begin = await send(at(15820, '/sparkql/transaction/begin'), {
        method: 'POST',
        headers: stardogHeaders,
      });
      const transaction = (await begin.text()).trim();
      await send(at(15820, `/sparkql/${transaction}/add`), {
        method: 'POST',
        ...turtle(data, stardogHeaders),
      });
      await send(at(15820, `/sparkql/transaction/commit/${transaction}`), {
        method: 'POST',
        headers: stardogHeaders,
      });
    },
  },
];

/** Whether `engine` evaluates `dialect`. */
export const supports = (engine: Engine, dialect: DialectName): boolean =>
  dialect === 'sparql11' || engine.dialects.includes(dialect);
