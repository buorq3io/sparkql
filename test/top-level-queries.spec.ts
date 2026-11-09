import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, describe, expect, expectTypeOf, test } from 'vitest';
import {
  SparqlDatabase as ArqDatabase,
  quads,
  triples,
  letBinding,
  lateral,
  type JsonScalar,
  type ConstructedQuad,
} from '../src/arq/index.js';
import { SparqlDatabase as StardogDatabase, type PathResult } from '../src/stardog/index.js';
import {
  SparqlDatabase,
  defineDialect,
  sparql11Dialect,
  ModuleQueryBuilder,
  type QueryModule,
  type QueryModuleContext,
  seq,
  oneOrMore,
  group,
} from '../src/index.js';

let endpoint: string;
const requests: { query: string; accept: string | undefined }[] = [];
let respond: (req: IncomingMessage, res: ServerResponse, query: string) => void;
const server = createServer(async (req, res) => {
  let query = '';
  for await (const chunk of req) query += chunk.toString();
  requests.push({ query, accept: req.headers.accept });
  respond(req, res, query);
});
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test endpoint');
  endpoint = `http://127.0.0.1:${address.port}/query`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
});
const compact = (value: string) => value.replace(/\s+/g, ' ').trim();

// A third-party module needs no changes to Sparkql's built-in query union.
interface EchoAST {
  type: 'query';
  subType: 'echo';
  value: number;
  prefixes: number;
}
const echoModule: QueryModule<number, EchoAST, number> = {
  normalize: (value, context) => ({
    type: 'query',
    subType: 'echo',
    value,
    prefixes: context.context.length,
  }),
  generate: ast => `ECHO ${ast.value}`,
  execute: async (_sparql, _client, ast) => ast.value,
};
class EchoBuilder extends ModuleQueryBuilder<number, EchoAST, number, typeof sparql11Dialect> {
  constructor(value: number, context: QueryModuleContext<typeof sparql11Dialect>) {
    super(value, echoModule, context);
  }
}
const echoQueries = {
  echo: (context: QueryModuleContext<typeof sparql11Dialect>) => (value: number) =>
    new EchoBuilder(value, context),
};
const echoDialect = defineDialect<never, never, typeof echoQueries>({
  ...sparql11Dialect,
  queries: echoQueries,
});

describe('top-level query modules', () => {
  test('registers third-party builders and preserves them across context changes', async () => {
    const db = SparqlDatabase.create({ dialect: echoDialect, endpointUrl: endpoint })
      .base('https://example.org/')
      .prefix({ ex: 'https://example.org/' });
    const query = db.echo(17);
    expect(query.getSPARQL()).toEqual({ type: 'query', subType: 'echo', value: 17, prefixes: 2 });
    expect(query.toSPARQL()).toBe('ECHO 17');
    expectTypeOf(query.getSPARQL()).toEqualTypeOf<EchoAST>();
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<number>();
    expect(await query).toBe(17);
    expect(() =>
      SparqlDatabase.create({
        dialect: { ...sparql11Dialect, queries: { select: echoQueries.echo } },
      })
    ).toThrow('conflicts');
  });

  test('generates ARQ JSON with escaped keys, constants and extended patterns', () => {
    const db = ArqDatabase.create().prefix({ ex: 'https://example.org/' });
    const variable = db.variable('value');
    const query = db
      .json({ 'key"\\\n': variable, answer: 42, active: true, text: 'hello' })
      .from(new URL('https://example.org/data'))
      .where(lateral(letBinding(42, variable)))
      .orderBy(variable)
      .limit(2)
      .offset(1);
    const text = compact(query.toSPARQL());
    expect(text).toContain('JSON { "key\\"\\\\\\n" : ?value');
    expect(text).toContain('LATERAL');
    expect(text).toContain('FROM <https://example.org/data>');
    expect(text).toContain('ORDER BY');
    expect(text).toContain('LIMIT 2');
    expect(text).toContain('OFFSET 1');
    expect(query.getSPARQL().subType).toBe('json');
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<
      ({ answer: number; active: boolean; text: string } & { 'key"\\\n'?: JsonScalar })[]
    >();
    expect(() => db.json({}).toSPARQL()).toThrow('at least one');
  });

  test('decodes ARQ JSON, keeps missing variables optional, and executes once', async () => {
    const db = ArqDatabase.create({ endpointUrl: endpoint });
    const query = db.json({ name: db.variable('name'), answer: 42 }).where();
    respond = (_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify([{ name: 'Ada', answer: 42 }, { answer: 42 }]));
    };
    const before = requests.length;
    const [first, second] = await Promise.all([query, query]);
    expect(first).toEqual([{ name: 'Ada', answer: 42 }, { answer: 42 }]);
    expect(second).toBe(first);
    expect(requests.length - before).toBe(1);
    expect(requests[requests.length - 1]?.accept).toBe('application/json');
    respond = (_req, res) => {
      res.end(JSON.stringify({ results: { bindings: [] } }));
    };
    await expect(db.json({ name: db.variable('name') }).where()).rejects.toThrow('JSON array');
    respond = (_req, res) => {
      res.end(JSON.stringify([{ answer: 'wrong' }]));
    };
    await expect(db.json({ answer: 42 }).where()).rejects.toThrow('JSON constant');
  });

  test('constructs named/default graph templates and decodes graph-preserving quads', async () => {
    const db = ArqDatabase.create({ endpointUrl: endpoint });
    const s = db.variable('s');
    const p = db.iri('https://example.org/p');
    const o = db.variable('o');
    const query = db
      .constructQuads(triples(s, p, o), quads(db.iri('https://example.org/g'), triples(s, p, o)))
      .where(triples(s, p, o), letBinding('example', db.variable('label')))
      .limit(3);
    const text = compact(query.toSPARQL());
    expect(text).toContain('CONSTRUCT {');
    expect(text).toContain('GRAPH <https://example.org/g>');
    expect(text).toContain('LET');
    expect(query.getSPARQL().template).toHaveLength(2);
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<ConstructedQuad[]>();
    respond = (_req, res) => {
      res.setHeader('content-type', 'application/n-quads');
      res.end(
        '<https://example.org/s> <https://example.org/p> "default" .\n<https://example.org/s> <https://example.org/p> "named" <https://example.org/g> .\n'
      );
    };
    const result = await query;
    expect(result.map(quad => quad.graph.termType)).toEqual(['DefaultGraph', 'NamedNode']);
    expect(result[1].graph.value).toBe('https://example.org/g');
    expect(requests[requests.length - 1]?.accept).toBe('application/n-quads');
  });

  test('generates PATHS with dataset, endpoint patterns, property paths, and modifiers', () => {
    const db = StardogDatabase.create().base('https://example.org/');
    const start = db.variable('start');
    const end = db.variable('end');
    const p = db.iri('https://example.org/p');
    const query = db
      .paths()
      .all()
      .cyclic()
      .fromNamed(p)
      .start(start, group(triples(start, p, 'start')))
      .end(end, new URL('https://example.org/end'))
      .via(seq(p, oneOrMore(p)))
      .maxLength(4)
      .offset(1)
      .limit(3);
    const text = compact(query.toSPARQL());
    expect(text).toContain('PATHS ALL CYCLIC FROM NAMED');
    expect(text).toContain('START ?start {');
    expect(text).toContain('END ?end = <https://example.org/end> VIA');
    expect(text).toContain('MAX LENGTH 4 OFFSET 1 LIMIT 3');
    expect(query.getSPARQL().via.kind).toBe('path');
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<PathResult[]>();
    expect(db.paths().start(start).end(end).via(p).toSPARQL()).toContain('SHORTEST');
    expect(db.paths().start(start).end(end).via(db.variable('p')).getSPARQL().via.kind).toBe(
      'variable'
    );
    expect(db.paths().start(start).end(end).via(triples(start, p, end)).getSPARQL().via.kind).toBe(
      'pattern'
    );
    expect(() => db.paths().limit(-1)).toThrow('non-negative');
    expect(() => db.paths().maxLength(Infinity)).toThrow('non-negative');
    // @ts-expect-error Incomplete queries cannot be generated.
    expect(() => db.paths().toSPARQL()).toThrow('START, END, and VIA');
  });

  test('decodes PATHS boundaries and RDF term metadata', async () => {
    const db = StardogDatabase.create({ endpointUrl: endpoint });
    const uri = (value: string) => ({ type: 'uri', value });
    respond = (_req, res) => {
      res.end(
        JSON.stringify({
          head: { vars: ['s', 'e', 'label', 'n'] },
          results: {
            bindings: [
              {},
              {
                s: uri('urn:a'),
                e: uri('urn:b'),
                label: { type: 'literal', value: 'hello', 'xml:lang': 'en' },
              },
              {
                s: uri('urn:b'),
                e: uri('urn:c'),
                n: {
                  type: 'literal',
                  value: '2',
                  datatype: 'http://www.w3.org/2001/XMLSchema#integer',
                },
              },
              {},
              {},
              { s: { type: 'bnode', value: 'b1' }, e: uri('urn:c') },
              {},
            ],
          },
        })
      );
    };
    const result = await db
      .paths()
      .start(db.variable('s'))
      .end(db.variable('e'))
      .via(db.variable('p'));
    expect(result.map(path => path.edges.length)).toEqual([2, 1]);
    expect(result[0].edges[0].label).toMatchObject({ termType: 'Literal', language: 'en' });
    expect(result[0].edges[1].n).toMatchObject({
      datatype: { value: 'http://www.w3.org/2001/XMLSchema#integer' },
    });
    expect(result[1].edges[0].s?.termType).toBe('BlankNode');
    expect(requests[requests.length - 1]?.accept).toBe('application/sparql-results+json');
  });

  test('propagates HTTP and malformed response errors and requires endpoint configuration', async () => {
    const db = StardogDatabase.create({ endpointUrl: endpoint });
    const query = () =>
      db.paths().start(db.variable('s')).end(db.variable('e')).via(db.variable('p'));
    respond = (_req, res) => {
      res.statusCode = 400;
      res.end('bad query');
    };
    await expect(query()).rejects.toThrow('400');
    respond = (_req, res) => {
      res.end(JSON.stringify({ results: { bindings: [{ s: { type: 'invalid', value: 'x' } }] } }));
    };
    await expect(query()).rejects.toThrow('RDF term type');
    await expect(Promise.resolve(ArqDatabase.create().json({ x: 1 }).where())).rejects.toThrow(
      'Database URL'
    );
  });
});

function typeChecks() {
  const arq = ArqDatabase.create();
  const stardog = StardogDatabase.create();
  const standard = SparqlDatabase.create();
  // @ts-expect-error Query forms are scoped to the dialect.
  standard.json({ x: 1 });
  // @ts-expect-error Query forms are scoped to the dialect.
  arq.paths();
  // @ts-expect-error Query forms are scoped to the dialect.
  stardog.constructQuads();
  // @ts-expect-error JSON's grammar does not accept arbitrary expressions in the template.
  arq.json({ x: { type: 'expression', subType: 'operation', operator: '+', args: [1, 2] } });
  // @ts-expect-error New top-level forms cannot be used as graph patterns.
  arq.select().where(arq.json({ x: 1 }).getSPARQL());
  stardog.select().where(
    // @ts-expect-error PATHS cannot be embedded as a subquery.
    stardog
      .paths()
      .start(stardog.variable('s'))
      .end(stardog.variable('e'))
      .via(stardog.variable('p'))
      .getSPARQL()
  );
  // @ts-expect-error PATHS does not support WHERE.
  stardog.paths().where();
  // @ts-expect-error START must be a variable.
  stardog.paths().start(new URL('https://example.org/'));
  // @ts-expect-error Incomplete paths are not executable queries.
  stardog.paths().start(stardog.variable('s')).then();
  // @ts-expect-error Module methods retain their argument types.
  SparqlDatabase.create({ dialect: echoDialect }).echo('wrong');
}
void typeChecks;
