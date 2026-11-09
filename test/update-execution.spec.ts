import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { type IriManagerConfig, SparqlDatabase, triples } from '../src/index.js';

let endpoint: string;
const requests: { method: string | undefined; url: string | undefined; body: string }[] = [];
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk.toString();
  requests.push({ method: req.method, url: req.url, body });
  if (req.method === 'GET') {
    res.setHeader('content-type', 'application/sparql-results+json');
    res.end(JSON.stringify({ head: {}, boolean: true }));
  } else {
    res.writeHead(204).end();
  }
});

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test endpoint');
  endpoint = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
});
beforeEach(() => {
  requests.length = 0;
});

const builders = {
  insertData: (db: SparqlDatabase<IriManagerConfig>) =>
    db.insertData(
      triples(db.iri('https://example.org/s'), db.iri('https://example.org/p'), 'value')
    ),
  with: (db: SparqlDatabase<IriManagerConfig>) =>
    db
      .with(db.iri('https://example.org/g'))
      .insert(triples(db.iri('https://example.org/s'), db.iri('https://example.org/p'), 'value'))
      .where(),
  withEnd: (db: SparqlDatabase<IriManagerConfig>) =>
    db.with(db.iri('https://example.org/g')).insert().where().$end().clearAll(),
  copy: (db: SparqlDatabase<IriManagerConfig>) =>
    db.copy(db.iri('https://example.org/source')).to(db.iri('https://example.org/destination')),
};

describe('update execution', () => {
  test.each(Object.entries(builders))(
    '%s POSTs to the configured or default update URL',
    async (name, build) => {
      for (const separateUpdateUrl of [true, false]) {
        const connection = {
          endpointUrl: `${endpoint}/query`,
          updateUrl: separateUpdateUrl ? `${endpoint}/update` : undefined,
        };
        const db = SparqlDatabase.create({ connection })
          .base('https://example.org/')
          .prefix({ ex: 'https://example.org/' });
        const query = build(db);
        await query;
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('POST');
        expect(requests[0].url).toBe(separateUpdateUrl ? '/update' : '/query');
        const body = new URLSearchParams(requests[0].body);
        expect([...body.keys()]).toEqual(['update']);
        const expected =
          name === 'with'
            ? `BASE <https://example.org/> PREFIX ex: <https://example.org/>
             WITH <https://example.org/g> INSERT {
               <https://example.org/s> <https://example.org/p> "value" .
             } WHERE { }`
            : query.toSPARQL();
        const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
        expect(compact(body.get('update')!)).toBe(compact(expected));
        requests.length = 0;
      }
    }
  );

  test('allows updates with only an update URL and still requires a query endpoint for reads', async () => {
    const db = SparqlDatabase.create({ connection: { updateUrl: `${endpoint}/update` } });
    await db.clearAll();
    expect(requests[0]).toEqual({ method: 'POST', url: '/update', body: 'update=CLEAR+ALL' });
    await expect(db.ask()).rejects.toThrow('no `endpointUrl`');
    expect(requests).toHaveLength(1);
  });

  test('keeps reads on the query endpoint when a separate update URL is configured', async () => {
    const connection = { endpointUrl: `${endpoint}/query`, updateUrl: `${endpoint}/update` };
    const db = SparqlDatabase.create({ connection });
    expect(await db.ask().where()).toBe(true);
    expect(requests[0].method).toBe('GET');
    expect(new URL(requests[0].url!, endpoint).pathname).toBe('/query');
  });

  test('still accepts the deprecated top-level endpointUrl and updateUrl options', async () => {
    const db = SparqlDatabase.create({
      endpointUrl: `${endpoint}/query`,
      updateUrl: `${endpoint}/update`,
    });
    expect(await db.ask().where()).toBe(true);
    await db.clearAll();
    expect(requests.map(request => [request.method, request.url?.split('?')[0]])).toEqual([
      ['GET', '/query'],
      ['POST', '/update'],
    ]);
  });

  test('rejects updates on a build-only database', async () => {
    await expect(SparqlDatabase.create().clearAll()).rejects.toThrow('build-only');
    expect(requests).toHaveLength(0);
  });
});
