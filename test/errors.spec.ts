import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../src/arq/index.js';
import {
  HttpSparqlSession,
  is,
  MAX_ERROR_BODY_LENGTH,
  SparkqlError,
  SparkqlNormalizationError,
  SparkqlQueryError,
  SparqlDatabase,
  SparqlResponseError,
  type SparqlSession,
  triples,
} from '../src/index.js';
import { SparqlDatabase as StardogDatabase } from '../src/stardog/index.js';

const ex = (name: string) => `https://example.org/${name}`;
const SECRET = 'secret-literal';
const SERVER_ERROR = 'Parse error: unexpected token near "secret-literal"';

let endpoint: string;
const server = createServer(async (req, res) => {
  for await (const _ of req);
  res.writeHead(400, 'Bad Request', { 'content-type': 'text/plain' });
  res.end(SERVER_ERROR);
});
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test endpoint');
  endpoint = `http://127.0.0.1:${address.port}/sparql`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
});

/** Every query form, each paired with the builder whose SPARQL is sent. */
function everyForm(connection: { connection: string } | { session: SparqlSession }) {
  const db = SparqlDatabase.create(connection);
  const arq = ArqDatabase.create(connection);
  const stardog = StardogDatabase.create(connection);
  const s = db.iri(ex('s'));
  const o = db.variable('o');
  const pattern = triples(s, s, o);
  const modify = db
    .with(db.iri(ex('g')))
    .insert(triples(s, s, SECRET))
    .where(pattern);
  const forms = {
    select: db.select({ o }).where(pattern),
    ask: db.ask().where(pattern),
    construct: db.construct(pattern).where(pattern),
    describe: db.describe(s),
    update: db.insertData(triples(s, s, SECRET)),
    transfer: db.copy(s).toDefault(),
    json: arq.json({ o }).where(pattern),
    constructQuads: arq.constructQuads(pattern).where(pattern),
    paths: stardog.paths().start(stardog.variable('a')).end(stardog.variable('b')).via(s),
  };
  return [
    ...Object.entries(forms).map(([name, query]) => ({ name, query, sent: query })),
    // A WITH chain sends the update request it belongs to.
    { name: 'with', query: modify, sent: modify.$end() },
  ];
}

async function rejection(promise: PromiseLike<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the query to reject');
}

describe('SparkqlQueryError', () => {
  test('wraps a failing HTTP response from every query form', async () => {
    for (const { name, query, sent } of everyForm({ connection: endpoint })) {
      const error = await rejection(query);
      expect(error, name).toBeInstanceOf(SparkqlQueryError);
      const queryError = error as SparkqlQueryError;
      expect(queryError.query, name).toBe(sent.toSPARQL());
      expect(queryError.status, name).toBe(400);
      expect(queryError.body, name).toBe(SERVER_ERROR);
      expect(queryError.message, name).toBe('Failed SPARQL query (HTTP 400 Bad Request)');
      expect(queryError.cause, name).toBeInstanceOf(Error);
      expect(queryError.cause, name).not.toBeInstanceOf(SparkqlQueryError);
      expect((queryError.cause as { status?: number }).status, name).toBe(400);
      // `execute()` takes the same path as `await`.
      await expect(query.execute(), name).rejects.toBeInstanceOf(SparkqlQueryError);
    }
  });

  test('wraps raw() responses in a SparqlResponseError cause', async () => {
    const query = ArqDatabase.create({ connection: endpoint }).json({ x: 1 }).where();
    const error = (await rejection(query)) as SparkqlQueryError;
    expect(error.cause).toBeInstanceOf(SparqlResponseError);
    expect(error.cause).toMatchObject({
      status: 400,
      statusText: 'Bad Request',
      body: SERVER_ERROR,
    });
  });

  test('keeps exactly what a custom session threw as the cause', async () => {
    const thrown = new Error('engine offline');
    const fail = async (): Promise<never> => {
      throw thrown;
    };
    const session: SparqlSession = {
      bindings: fail,
      boolean: fail,
      quads: fail,
      update: fail,
      raw: fail,
    };
    for (const { name, query, sent } of everyForm({ session })) {
      const error = (await rejection(query)) as SparkqlQueryError;
      expect(error, name).toBeInstanceOf(SparkqlQueryError);
      expect(error.cause, name).toBe(thrown);
      expect(error.query, name).toBe(sent.toSPARQL());
      expect(error.status, name).toBeUndefined();
      expect(error.message, name).toBe('Failed SPARQL query: engine offline');
    }
  });

  test('wraps result decoding failures', async () => {
    const session = {
      raw: async () => new Response('{"not": "an array"}'),
    } as unknown as SparqlSession;
    const query = ArqDatabase.create({ session: { ...validSession(), ...session } })
      .json({ x: 1 })
      .where();
    const error = (await rejection(query)) as SparkqlQueryError;
    expect(error).toBeInstanceOf(SparkqlQueryError);
    expect(error.query).toBe(query.toSPARQL());
    expect(error.message).toBe('Failed SPARQL query: Expected an ARQ JSON array.');
  });

  test('keeps the query out of the message unless queryInErrors is set', async () => {
    const build = (queryInErrors?: boolean) => {
      const db = SparqlDatabase.create({ connection: endpoint, queryInErrors });
      return db
        .prefix({ ex: ex('') })
        .insertData(triples(db.iri(ex('s')), db.iri(ex('p')), SECRET));
    };
    const quiet = (await rejection(build())) as SparkqlQueryError;
    expect(quiet.message).not.toContain(SECRET);
    expect(quiet.query).toContain(SECRET);

    // Derived databases keep the option.
    const query = build(true);
    const verbose = (await rejection(query)) as SparkqlQueryError;
    expect(verbose.message).toBe(
      `Failed SPARQL query (HTTP 400 Bad Request)\nquery: ${query.toSPARQL()}`
    );
  });

  test('caps the response body', () => {
    const cause = Object.assign(new Error('Bad Request (500): '), {
      status: 500,
      body: 'x'.repeat(MAX_ERROR_BODY_LENGTH * 2),
    });
    const error = new SparkqlQueryError({ query: 'ASK {}', cause });
    expect(error.body).toHaveLength(MAX_ERROR_BODY_LENGTH);
    expect(error.message).toBe('Failed SPARQL query (HTTP 500)');
  });
});

function validSession(): SparqlSession {
  return {
    bindings: async () => [],
    boolean: async () => true,
    quads: async () => [],
    update: async () => {},
    raw: async () => new Response('[]'),
  };
}

describe('errors before a query is sent', () => {
  test('a build-only database rejects with a SparkqlError', async () => {
    const error = await rejection(SparqlDatabase.create().ask().where());
    expect(error).toBeInstanceOf(SparkqlError);
    expect(error).not.toBeInstanceOf(SparkqlQueryError);
  });

  test('normalisation errors name the rejected node', async () => {
    const session = validSession();
    const db = SparqlDatabase.create({ session });
    const unknown = { type: 'pattern', subType: 'mystery' };
    // @ts-expect-error Untyped callers can pass unknown nodes.
    const query = db.select().where(unknown);
    expect(() => query.toSPARQL()).toThrow(SparkqlNormalizationError);
    const error = await rejection(query);
    expect(error).toBeInstanceOf(SparkqlNormalizationError);
    expect(error).toBeInstanceOf(SparkqlError);
    expect(error).toMatchObject({
      message: 'Unsupported pattern provided (type "pattern", subType "mystery").',
      input: unknown,
      inputType: 'pattern',
      inputSubType: 'mystery',
    });

    const expression = { type: 'expression', subType: 'mystery' } as never;
    expect(() => db.select().where().having(expression).toSPARQL()).toThrow(
      'Unsupported expression provided (type "expression", subType "mystery").'
    );
  });
});

describe('multiple library instances', () => {
  async function load() {
    return {
      core: await import('../src/index.js'),
      arq: await import('../src/arq/index.js'),
    };
  }
  const ownPromise = load();
  const foreignPromise = ownPromise.then(() => {
    vi.resetModules();
    return load();
  });

  test('instances do not share classes', async () => {
    const [own, foreign] = await Promise.all([ownPromise, foreignPromise]);
    expect(foreign.core.SparkqlQueryError).not.toBe(own.core.SparkqlQueryError);
    expect(foreign.core.HttpSparqlSession).not.toBe(own.core.HttpSparqlSession);
  });

  test('instanceof and is() recognise errors thrown by another instance', async () => {
    const [own, foreign] = await Promise.all([ownPromise, foreignPromise]);
    const error = await rejection(
      foreign.arq.SparqlDatabase.create({ connection: endpoint }).json({ x: 1 }).where()
    );
    expect(Object.getPrototypeOf(error)).not.toBe(own.core.SparkqlQueryError.prototype);
    expect(error instanceof own.core.SparkqlQueryError).toBe(true);
    expect(error instanceof own.core.SparkqlError).toBe(true);
    expect(error instanceof own.core.SparkqlNormalizationError).toBe(false);
    expect(own.core.is(error, own.core.SparkqlQueryError)).toBe(true);
    expect((error as SparkqlQueryError).cause instanceof own.core.SparqlResponseError).toBe(true);

    const buildOnly = await rejection(foreign.core.SparqlDatabase.create().ask());
    expect(buildOnly instanceof own.core.SparkqlError).toBe(true);
    expect(buildOnly instanceof own.core.SparkqlQueryError).toBe(false);
    expect(new Error('plain') instanceof own.core.SparkqlError).toBe(false);
  });

  test('a session from another instance keeps its client', async () => {
    const [own, foreign] = await Promise.all([ownPromise, foreignPromise]);
    const session = new foreign.core.HttpSparqlSession({ connection: endpoint });
    expect(session instanceof own.core.HttpSparqlSession).toBe(true);
    const db = own.core.SparqlDatabase.create({ session });
    expect(db.$client).toBe(session.client);
    expect(is(session, HttpSparqlSession)).toBe(true);
  });
});
