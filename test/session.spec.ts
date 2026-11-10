import { DataFactory } from 'rdf-data-factory';
import SparqlHttpClientImpl from 'sparql-http-client';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../src/arq/index.js';
import {
  HttpSparqlSession,
  type SparqlBindings,
  SparqlDatabase,
  type SparqlHttpClient,
  type SparqlSession,
  triples,
} from '../src/index.js';
import { SparqlDatabase as StardogDatabase } from '../src/stardog/index.js';

const rdf = new DataFactory();
const ex = (name: string) => `https://example.org/${name}`;
const BUILD_ONLY = 'This database is build-only';

/** An in-memory session: records what it is asked to run and answers from fixtures. */
function fakeSession() {
  const calls: { method: keyof SparqlSession; sparql: string; accept?: string }[] = [];
  const quad = rdf.quad(rdf.namedNode(ex('s')), rdf.namedNode(ex('p')), rdf.literal('o'));
  const session: SparqlSession = {
    async bindings(sparql) {
      calls.push({ method: 'bindings', sparql });
      const rows: SparqlBindings[] = [
        { name: rdf.literal('Ada'), age: rdf.literal('36') },
        { name: rdf.literal('Alan') },
      ];
      return rows;
    },
    async boolean(sparql) {
      calls.push({ method: 'boolean', sparql });
      return true;
    },
    async quads(sparql, options) {
      calls.push({ method: 'quads', sparql, accept: options?.accept });
      return [quad];
    },
    async update(sparql) {
      calls.push({ method: 'update', sparql });
    },
    async raw(sparql, options) {
      calls.push({ method: 'raw', sparql, accept: options.accept });
      return new Response(JSON.stringify([{ name: 'Ada', answer: 42 }]), {
        headers: { 'content-type': options.accept },
      });
    },
  };
  return { session, calls, quad };
}

describe('custom sessions', () => {
  test('runs every query form and an ARQ module through an in-memory session', async () => {
    const { session, calls, quad } = fakeSession();
    const db = ArqDatabase.create({ session });
    const [v] = db.createManagers([], {});
    const { name, age } = v;
    const s = db.iri(ex('s'));
    const p = db.iri(ex('p'));
    const pattern = triples(db.variable('s'), p, name);

    const select = db.select({ name, age }).where(pattern);
    expect((await select).map(row => [row.name?.value, row.age?.value])).toEqual([
      ['Ada', '36'],
      ['Alan', undefined],
    ]);
    expect(await db.ask().where(pattern)).toBe(true);
    expect(await db.construct(pattern).where(pattern)).toEqual([quad]);
    expect(await db.describe(s)).toEqual([quad]);
    await db.insertData(triples(s, p, 'value'));
    await db
      .with(db.iri(ex('g')))
      .insert(triples(s, p, 'value'))
      .where(pattern);
    await db.copy(db.iri(ex('a'))).to(db.iri(ex('b')));
    expect(await db.json({ name, answer: 42 }).where(pattern)).toEqual([
      { name: 'Ada', answer: 42 },
    ]);
    expect(await db.constructQuads(pattern).where(pattern)).toEqual([quad]);

    expect(calls.map(call => call.method)).toEqual([
      'bindings',
      'boolean',
      'quads',
      'quads',
      'update',
      'update',
      'update',
      'raw',
      'quads',
    ]);
    expect(calls[0].sparql).toBe(select.toSPARQL());
    expect(calls[1].sparql).toContain('ASK');
    expect(calls[2].sparql).toContain('CONSTRUCT');
    expect(calls[2].accept).toBeUndefined();
    expect(calls[3].sparql).toContain('DESCRIBE');
    expect(calls[4].sparql).toContain('INSERT DATA');
    expect(calls[5].sparql).toContain('WITH <https://example.org/g>');
    expect(calls[6].sparql).toContain('COPY');
    expect(calls[7]).toMatchObject({ accept: 'application/json' });
    expect(calls[7].sparql).toContain('JSON {');
    expect(calls[8].accept).toBe('application/n-quads');
  });

  test('keeps the session across base() and prefix() and exposes it', async () => {
    const { session, calls } = fakeSession();
    const db = SparqlDatabase.create({ session });
    const derived = db.base(ex('')).prefix({ ex: ex('') });
    expect(db.$session).toBe(session);
    expect(derived.$session).toBe(session);
    expect(derived.$client).toBeUndefined();
    await derived.ask().where();
    expect(calls).toHaveLength(1);
    expect(calls[0].sparql).toContain('PREFIX ex:');
  });

  test('SELECT * returns every bound variable of each solution', async () => {
    const { session } = fakeSession();
    const db = SparqlDatabase.create({ session });
    const pattern = triples(db.variable('s'), db.iri(ex('p')), db.variable('name'));
    for (const query of [
      db.select().where(pattern),
      db.selectDistinct().where(pattern),
      db.selectReduced().where(pattern),
    ]) {
      const rows = await query;
      // Unbound variables are absent, as in the session's bindings.
      expect(rows).toEqual([
        { name: rdf.literal('Ada'), age: rdf.literal('36') },
        { name: rdf.literal('Alan') },
      ]);
      expect(Object.keys(rows[1])).toEqual(['name']);
      expect(rows[0].name?.value).toBe('Ada');
    }
  });

  test('sends a request on every await', async () => {
    const { session, calls } = fakeSession();
    const db = SparqlDatabase.create({ session });
    const ask = db.ask().where();
    await ask;
    await ask;
    await ask.execute();
    expect(calls.map(call => call.method)).toEqual(['boolean', 'boolean', 'boolean']);

    // Re-running a WITH chain must not append its operation to the request again.
    calls.length = 0;
    const s = db.iri(ex('s'));
    const modify = db
      .with(db.iri(ex('g')))
      .insert(triples(s, s, s))
      .where();
    await modify;
    await modify;
    expect(calls).toHaveLength(2);
    expect(calls[1].sparql).toBe(calls[0].sparql);
    expect(calls[0].sparql.match(/WITH/g)).toHaveLength(1);
  });

  test('propagates session failures', async () => {
    const { session } = fakeSession();
    session.boolean = async () => {
      throw new Error('engine offline');
    };
    session.raw = async () => new Response('nope', { status: 503, statusText: 'Unavailable' });
    await expect(SparqlDatabase.create({ session }).ask().where()).rejects.toThrow(
      'engine offline'
    );
    await expect(ArqDatabase.create({ session }).json({ x: 1 }).where()).rejects.toThrow('503');
  });

  test('rejects ambiguous or invalid transport options', () => {
    const { session } = fakeSession();
    expect(() => SparqlDatabase.create({ session, connection: ex('sparql') })).toThrow(
      'only one of'
    );
    expect(() => SparqlDatabase.create({ session, endpointUrl: ex('sparql') })).toThrow(
      'only one of'
    );
    expect(() => SparqlDatabase.create({ session: {} as SparqlSession })).toThrow('must implement');
    expect(() => SparqlDatabase.create({ connection: {} })).toThrow('endpointUrl');
  });
});

describe('build-only databases', () => {
  test('build every query form and reject with one clear error when awaited', async () => {
    const db = SparqlDatabase.create();
    const arq = ArqDatabase.create();
    const stardog = StardogDatabase.create();
    expect(db.$session).toBeUndefined();
    expect(db.$client).toBeUndefined();
    const s = db.iri(ex('s'));
    const o = db.variable('o');
    const pattern = triples(s, s, o);
    const queries = {
      select: db.select({ o }).where(pattern),
      ask: db.ask().where(pattern),
      construct: db.construct(pattern).where(pattern),
      describe: db.describe(s),
      update: db.insertData(triples(s, s, s)),
      transfer: db.copy(s).toDefault(),
      json: arq.json({ o }).where(pattern),
      constructQuads: arq.constructQuads(pattern).where(pattern),
      paths: stardog.paths().start(stardog.variable('a')).end(stardog.variable('b')).via(s),
    };
    for (const [name, query] of Object.entries(queries)) {
      expect(query.toSPARQL(), name).not.toBe('');
      expect(query.getSPARQL(), name).toBeTypeOf('object');
      await expect(query, name).rejects.toThrow(BUILD_ONLY);
      await expect(query.execute(), name).rejects.toThrow(BUILD_ONLY);
    }
    const modify = db.with(s).insert(pattern).where(pattern);
    await expect(modify).rejects.toThrow(BUILD_ONLY);
    expect(modify.$end().toSPARQL()).toContain('WITH');
  });
});

describe('default HTTP session', () => {
  const sparqlJson = { 'content-type': 'application/sparql-results+json' };
  function stubFetch(respond: (request: Request) => Response) {
    const requests: Request[] = [];
    const fetchStub: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      requests.push(request.clone());
      return respond(request);
    };
    return { requests, fetchStub };
  }

  test('sends custom headers and basic auth through a custom fetch', async () => {
    const { requests, fetchStub } = stubFetch(request =>
      request.method === 'GET' && new URL(request.url).searchParams.get('query')?.includes('ASK')
        ? new Response(JSON.stringify({ head: {}, boolean: true }), { headers: sparqlJson })
        : request.method === 'GET'
          ? new Response(
              JSON.stringify({
                head: { vars: ['o'] },
                results: { bindings: [{ o: { type: 'literal', value: 'hello' } }] },
              }),
              { headers: sparqlJson }
            )
          : new Response(null, { status: 204 })
    );
    const db = SparqlDatabase.create({
      connection: {
        endpointUrl: ex('query'),
        updateUrl: ex('update'),
        headers: { 'x-api-key': 'secret' },
        user: 'ada',
        password: 'lovelace',
        fetch: fetchStub,
      },
    });
    const [{ o }] = db.createManagers([], {});
    expect(await db.ask().where()).toBe(true);
    // A standard fetch returns web streams; results must still be decoded.
    const rows = await db.select({ o }).where(triples(db.iri(ex('s')), db.iri(ex('p')), o));
    expect(rows.map(row => row.o.value)).toEqual(['hello']);
    await db.clearAll();

    expect(requests.map(request => [request.method, new URL(request.url).pathname])).toEqual([
      ['GET', '/query'],
      ['GET', '/query'],
      ['POST', '/update'],
    ]);
    for (const request of requests) {
      expect(request.headers.get('x-api-key')).toBe('secret');
      expect(request.headers.get('authorization')).toBe(`Basic ${btoa('ada:lovelace')}`);
    }
    expect(await requests[2].text()).toBe('update=CLEAR+ALL');
  });

  test('accepts a URL string as the connection and loads its client lazily', async () => {
    const db = SparqlDatabase.create({ connection: ex('sparql') });
    expect(db.$session).toBeInstanceOf(HttpSparqlSession);
    expectTypeOf(db.$client).toEqualTypeOf<Promise<SparqlHttpClient> | undefined>();
    const client = await db.$client;
    expect(client?.endpointUrl).toBe(ex('sparql'));
    expect(client?.updateUrl).toBe(ex('sparql'));
    expect(await db.prefix({ ex: ex('') }).$client).toBe(client);
  });

  test('uses a ready client and exposes it as $client', async () => {
    const { requests, fetchStub } = stubFetch(
      () => new Response(JSON.stringify({ head: {}, boolean: false }), { headers: sparqlJson })
    );
    // sparql-http-client pipes Node streams, so its own fetch option needs a Node-style body.
    const client = new SparqlHttpClientImpl({
      endpointUrl: ex('query'),
      headers: { 'x-client': 'mine' },
      fetch: fetchStub,
    });
    const db = SparqlDatabase.create({ client });
    expectTypeOf(db.$client).toEqualTypeOf<typeof client>();
    expect(db.$client).toBe(client);
    expect(db.base(ex('')).$client).toBe(client);
    expect(ArqDatabase.create({ client }).$client).toBe(client);
    expect(await db.ask().where()).toBe(false);
    expect(requests[0].headers.get('x-client')).toBe('mine');
  });

  test('reports the missing endpoint for the request kind', async () => {
    const { requests, fetchStub } = stubFetch(() => new Response(null, { status: 204 }));
    const db = SparqlDatabase.create({ connection: { updateUrl: ex('update'), fetch: fetchStub } });
    await db.clearAll();
    expect(requests).toHaveLength(1);
    await expect(db.ask().where()).rejects.toThrow('no `endpointUrl`');
    expect(requests).toHaveLength(1);
  });
});
