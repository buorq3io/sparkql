import SparqlHttpClientImpl from 'sparql-http-client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../src/arq/index.js';
import {
  DefaultLogger,
  defineDialect,
  type Logger,
  ModuleQueryBuilder,
  type QueryLogMeta,
  type QueryModuleContext,
  SparqlDatabase,
  type SparqlSession,
  sparql11Dialect,
  triples,
} from '../src/index.js';
import { SparqlDatabase as StardogDatabase } from '../src/stardog/index.js';

function fixture() {
  const requests: string[] = [];
  const record = (sparql: string) => requests.push(sparql);
  const session: SparqlSession = {
    bindings: async sparql => {
      record(sparql);
      return [];
    },
    boolean: async sparql => {
      record(sparql);
      return true;
    },
    quads: async sparql => {
      record(sparql);
      return [];
    },
    update: async sparql => {
      record(sparql);
    },
    raw: async sparql => {
      record(sparql);
      return new Response(sparql.includes('PATHS') ? '{"results":{"bindings":[]}}' : '[]');
    },
  };
  const logs: { sparql: string; meta: QueryLogMeta }[] = [];
  const logger: Logger = { logQuery: (sparql, meta) => logs.push({ sparql, meta }) };
  return { session, requests, logs, logger };
}

afterEach(() => vi.restoreAllMocks());

describe('query logging', () => {
  test('logger: true prints once per execution, including repeated awaits', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { session, requests } = fixture();
    const query = SparqlDatabase.create({ session, logger: true }).ask().where();
    const sparql = query.toSPARQL();
    expect(consoleLog).not.toHaveBeenCalled();
    await query;
    await query;
    await query.execute();
    expect(requests).toEqual([sparql, sparql, sparql]);
    expect(consoleLog.mock.calls).toEqual(Array(3).fill([`Query (ask): ${sparql}`]));
  });

  test('custom logger receives exact SPARQL and operation for standard forms and derived databases', async () => {
    const { session, requests, logs, logger } = fixture();
    const original = SparqlDatabase.create({ session, logger });
    const db = original.base('https://example.org/').prefix({ ex: 'https://example.org/' });
    expect(db.$session).toBe(session);
    const s = db.iri('https://example.org/s');
    const pattern = triples(s, s, db.variable('o'));
    const queries = [
      original.ask().where(),
      db.select().where(pattern),
      db.ask().where(pattern),
      db.construct(pattern).where(pattern),
      db.describe(s),
      db.clearAll(),
      db.with(s).insert(pattern).where().$end(),
      db.copy(s).toDefault(),
    ];
    for (const query of queries) {
      const sparql = query.toSPARQL();
      const count = requests.length;
      await query;
      expect(requests.slice(count)).toEqual([sparql]);
      expect(logs[count].sparql).toBe(sparql);
    }
    expect(logs.map(log => log.meta)).toEqual(
      ['ask', 'select', 'ask', 'construct', 'describe', 'update', 'update', 'update'].map(
        operation => ({ operation, targetUrl: undefined })
      )
    );
  });

  test('logs raw and quads requests from dialect modules under their factory names', async () => {
    const { session, requests, logs, logger } = fixture();
    const arq = ArqDatabase.create({ session, logger }).prefix({ ex: 'https://example.org/' });
    const stardog = StardogDatabase.create({ session, logger });
    const queries = [
      arq.json({ answer: 42 }).where(),
      arq.constructQuads().where(),
      stardog
        .paths()
        .start(stardog.variable('s'))
        .end(stardog.variable('o'))
        .via(stardog.iri('https://example.org/p')),
    ];
    for (const query of queries) await query;
    expect(logs.map(log => log.sparql)).toEqual(requests);
    expect(logs.map(log => log.meta.operation)).toEqual(['json', 'constructQuads', 'paths']);
  });

  test('uses query and update target URLs without loading the HTTP client to obtain metadata', async () => {
    const { logs, logger } = fixture();
    const db = SparqlDatabase.create({
      logger,
      connection: {
        endpointUrl: 'https://example.org/query',
        updateUrl: 'https://example.org/update',
        fetch: async (_input, init) =>
          init?.method === 'POST'
            ? new Response(null, { status: 204 })
            : new Response(JSON.stringify({ head: {}, boolean: true }), {
                headers: { 'content-type': 'application/sparql-results+json' },
              }),
      },
    });
    await db.ask().where();
    await db.clearAll();
    expect(logs.map(log => log.meta)).toEqual([
      { operation: 'ask', targetUrl: 'https://example.org/query' },
      { operation: 'update', targetUrl: 'https://example.org/update' },
    ]);

    const fallback = SparqlDatabase.create({ connection: 'https://example.org/both' });
    expect(fallback.$session?.getRequestUrl?.('update')).toBe('https://example.org/both');
    const client = new SparqlHttpClientImpl({ endpointUrl: 'https://example.org/client' });
    const supplied = SparqlDatabase.create({ client });
    expect(supplied.$client).toBe(client);
    expect(supplied.$session?.getRequestUrl?.('query')).toBe(client.endpointUrl);
    expect(supplied.$session?.getRequestUrl?.('update')).toBe(client.updateUrl);
  });

  test.each([undefined, false] as const)(
    'disabled logger (%s) skips metadata work and console output',
    async logger => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { session, requests } = fixture();
      session.getRequestUrl = () => {
        throw new Error('metadata must not be computed');
      };
      const query = SparqlDatabase.create({ session, logger }).ask().where();
      Object.defineProperty(query, 'operationName', {
        get() {
          throw new Error('operation must not be computed');
        },
      });
      await query;
      expect(requests).toHaveLength(1);
      expect(consoleLog).not.toHaveBeenCalled();
    }
  );

  test('does not log build-only or invalid queries, and logs failed requests once', async () => {
    const { session, logs, logger } = fixture();
    await expect(SparqlDatabase.create({ logger }).ask().where()).rejects.toThrow('build-only');
    const db = SparqlDatabase.create({ session, logger });
    const invalid = db.ask().where();
    vi.spyOn(invalid, 'toSPARQL').mockImplementation(() => {
      throw new Error('invalid input');
    });
    await expect(invalid).rejects.toThrow('invalid input');
    expect(logs).toEqual([]);
    session.boolean = async () => {
      throw new Error('offline');
    };
    await expect(db.ask().where()).rejects.toThrow('offline');
    expect(logs).toHaveLength(1);
  });

  test('logs once per request when a third-party module issues multiple requests', async () => {
    class TwiceBuilder extends ModuleQueryBuilder<null, null, boolean, typeof sparql11Dialect> {
      constructor(context: QueryModuleContext<typeof sparql11Dialect>) {
        super(
          null,
          {
            normalize: () => null,
            generate: () => 'ASK {}',
            execute: async (sparql, session) => {
              await session.boolean(sparql);
              return session.boolean(sparql);
            },
          },
          context
        );
      }
    }
    const { session, requests, logs, logger } = fixture();
    session.getRequestUrl = () => 'https://example.org/custom';
    const queries = {
      twice: (context: QueryModuleContext<typeof sparql11Dialect>) => () =>
        new TwiceBuilder(context),
    };
    const dialect = defineDialect<never, never, typeof queries>({ ...sparql11Dialect, queries });
    await SparqlDatabase.create({ session, logger, dialect }).twice();
    expect(requests).toEqual(['ASK {}', 'ASK {}']);
    expect(logs).toEqual(
      Array(2).fill({
        sparql: 'ASK {}',
        meta: { operation: 'twice', targetUrl: 'https://example.org/custom' },
      })
    );
  });

  test('a throwing logger prevents the request', async () => {
    const { session, requests } = fixture();
    const logger: Logger = {
      logQuery: () => {
        throw new Error('logger failed');
      },
    };
    await expect(SparqlDatabase.create({ session, logger }).ask().where()).rejects.toThrow(
      'logger failed'
    );
    expect(requests).toEqual([]);
  });

  test('default logger supports an application log writer', () => {
    const write = vi.fn();
    new DefaultLogger({ writer: { write } }).logQuery('ASK {}', {
      operation: 'ask',
      targetUrl: 'https://example.org/query',
    });
    expect(write).toHaveBeenCalledExactlyOnceWith(
      'Query (ask @ https://example.org/query): ASK {}'
    );
  });
});
