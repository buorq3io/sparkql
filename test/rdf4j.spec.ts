import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { SparqlDatabase as BaseDatabase } from '../src/index.js';
import { SparqlDatabase as NeptuneDatabase } from '../src/neptune/index.js';
import {
  as,
  filter,
  geof,
  graph,
  optional,
  rdf4jDialect,
  rdf4jNil,
  SparkqlError,
  SparkqlQueryError,
  SparqlDatabase,
  textSearch,
  triples,
  uom,
} from '../src/rdf4j/index.js';

const search = 'http://www.openrdf.org/contrib/lucenesail#';
const geofNs = 'http://www.opengis.net/def/function/geosparql/';
const wkt = '<http://www.opengis.net/ont/geosparql#wktLiteral>';
const rdf = new DataFactory();
const db = SparqlDatabase.create();
const s = db.variable('s');
const p = db.variable('p');
const o = db.variable('o');
const score = db.variable('score');
const text = db.variable('text');
const label = db.iri('http://www.w3.org/2000/01/rdf-schema#label');
const compact = (sparql: string) => sparql.replace(/\s+/g, ' ').trim();
const parser = new Parser();
const where = (sparql: string) => compact(sparql).replace(/^(SELECT \*|ASK) WHERE /, '');

describe('RDF4J text search', () => {
  test('prints a blank node property list with the LuceneSail vocabulary', () => {
    const query = db
      .select()
      .where(textSearch(s, 'light*', { property: label, score, snippet: text, numDocs: 5 }));
    const sparql = query.toSPARQL();
    expect(where(sparql)).toBe(
      `{ ?s <${search}matches> [ <${search}query> "light*" ; <${search}property> <http://www.w3.org/2000/01/rdf-schema#label> ; <${search}snippet> ?text ; <${search}score> ?score ; <${search}numDocs> "5"^^<http://www.w3.org/2001/XMLSchema#integer> ; ] . }`
    );
    expect(() => parser.parse(sparql)).not.toThrow();
  });

  test('takes only the query by default, an IRI subject and a variable property', () => {
    expect(where(db.select().where(textSearch(s, 'alice')).toSPARQL())).toBe(
      `{ ?s <${search}matches> [ <${search}query> "alice" ; ] . }`
    );
    const alice = new URL('https://example.org/alice');
    expect(
      where(
        db
          .ask()
          .where(textSearch(alice, 'alice', { property: p }))
          .toSPARQL()
      )
    ).toBe(
      `{ <https://example.org/alice> <${search}matches> [ <${search}query> "alice" ; <${search}property> ?p ; ] . }`
    );
  });

  test('combines clauses with their own boosts and snippets', () => {
    const query = db.select().where(
      textSearch(
        s,
        [
          { query: 'rivers', property: label, boost: 0.8, snippet: text },
          { query: 'carol', boost: 2 },
        ],
        { score, numDocs: 1 }
      )
    );
    const sparql = query.toSPARQL();
    expect(where(sparql)).toBe(
      `{ ?s <${search}matches> [ <${search}query> [ <${search}query> "rivers" ; <${search}property> <http://www.w3.org/2000/01/rdf-schema#label> ; <${search}boost> "0.8"^^<http://www.w3.org/2001/XMLSchema#decimal> ; <${search}snippet> ?text ; ] ; <${search}query> [ <${search}query> "carol" ; <${search}boost> "2"^^<http://www.w3.org/2001/XMLSchema#integer> ; ] ; <${search}score> ?score ; <${search}numDocs> "1"^^<http://www.w3.org/2001/XMLSchema#integer> ; ] . }`
    );
    expect(() => parser.parse(sparql)).not.toThrow();
  });

  test('prints at any depth and in updates', () => {
    expect(
      compact(
        db
          .select()
          .where(optional(graph(rdf4jNil, textSearch(s, 'x'))))
          .toSPARQL()
      )
    ).toContain(`OPTIONAL { GRAPH <http://rdf4j.org/schema/rdf4j#nil> { ?s <${search}matches>`);
    expect(
      db
        .delete(triples(s, p, o))
        .where(textSearch(s, 'x'), triples(s, p, o))
        .toSPARQL()
    ).toContain(`<${search}matches>`);
  });

  test('works through the standard factory and is rejected by other dialects', () => {
    const pattern = textSearch(s, 'x');
    const custom = BaseDatabase.create({ dialect: rdf4jDialect });
    expect(custom.select().where(pattern).toSPARQL()).toContain(`<${search}matches>`);
    expect(() =>
      BaseDatabase.create()
        .select()
        .where(pattern as never)
        .toSPARQL()
    ).toThrow();
    expect(() =>
      NeptuneDatabase.create()
        .select()
        .where(pattern as never)
        .toSPARQL()
    ).toThrow();
  });

  test('validates its input', () => {
    const t =
      (...args: unknown[]) =>
      () =>
        (textSearch as (...a: unknown[]) => unknown)(s, ...args);
    expect(t('')).toThrow(SparkqlError);
    expect(t('  ')).toThrow('non-empty string');
    expect(t(o)).toThrow('non-empty string');
    expect(t('x', { score: 'score' })).toThrow('`score` must be a variable');
    expect(t('x', { snippet: label })).toThrow('`snippet` must be a variable');
    expect(t('x', { numDocs: 0 })).toThrow('positive integer');
    expect(t('x', { numDocs: 1.5 })).toThrow('positive integer');
    expect(t([])).toThrow('at least one clause');
    expect(t([{ query: '' }])).toThrow('non-empty string');
    expect(t([{ query: 'x', boost: 0 }])).toThrow('positive number');
    expect(t([{ query: 'x', boost: Number.NaN }])).toThrow('positive number');
    expect(t([{ query: 'x' }], { property: label })).toThrow('in each clause');
    expect(t([{ query: 'x' }], { snippet: text })).toThrow('in each clause');
  });

  test('copies its options, so later changes to them do not leak in', () => {
    const options = { score };
    const clauses = [{ query: 'a' }];
    const pattern = textSearch(s, clauses);
    const single = textSearch(s, 'b', options);
    clauses.push({ query: 'c' });
    (options as { snippet?: unknown }).snippet = text;
    expect(db.select().where(pattern).toSPARQL()).not.toContain('"c"');
    expect(db.select().where(single).toSPARQL()).not.toContain('snippet');
  });
});

describe('RDF4J GeoSPARQL functions', () => {
  test('call geof: functions by full IRI with typed results', () => {
    const query = db
      .select({
        metres: as(geof.distance(o, 'POINT(1 0)', 'metre'), db.variable('metres')),
        area: as(geof.buffer(o, 10, uom.degree), db.variable('area')),
        inside: as(geof.sfWithin(o, 'POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))'), db.variable('inside')),
        srid: as(geof.getSRID(o), db.variable('srid')),
      })
      .where(triples(s, p, o), filter(geof.relate(o, o, 'T*F**F***')));
    const sparql = compact(query.toSPARQL());
    expect(sparql).toContain(
      `<${geofNs}distance> ( ?o , "POINT(1 0)"^^${wkt} , <http://www.opengis.net/def/uom/OGC/1.0/metre> )`
    );
    expect(sparql).toContain(
      `<${geofNs}buffer> ( ?o , "10"^^<http://www.w3.org/2001/XMLSchema#integer> , <http://www.opengis.net/def/uom/OGC/1.0/degree> )`
    );
    expect(sparql).toContain(
      `<${geofNs}sfWithin> ( ?o , "POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))"^^${wkt} )`
    );
    expect(sparql).toContain(`FILTER ( <${geofNs}relate> ( ?o , ?o , "T*F**F***" ) )`);
    expect(() => parser.parse(sparql)).not.toThrow();
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<
      { metres: number; area: string; inside: boolean; srid: string }[]
    >();
  });

  test('cover every function RDF4J registers', () => {
    expect(Object.keys(geof).sort()).toEqual(
      [
        'distance',
        'buffer',
        'convexHull',
        'envelope',
        'boundary',
        'intersection',
        'union',
        'difference',
        'symDifference',
        'getSRID',
        'relate',
        'sfEquals',
        'sfDisjoint',
        'sfIntersects',
        'sfTouches',
        'sfCrosses',
        'sfWithin',
        'sfContains',
        'sfOverlaps',
        'ehEquals',
        'ehDisjoint',
        'ehMeet',
        'ehOverlap',
        'ehCovers',
        'ehCoveredBy',
        'ehInside',
        'ehContains',
        'rcc8dc',
        'rcc8ec',
        'rcc8eq',
        'rcc8po',
        'rcc8tpp',
        'rcc8tppi',
        'rcc8ntpp',
        'rcc8ntppi',
      ].sort()
    );
    for (const name of ['convexHull', 'envelope', 'boundary'] as const) {
      expect(
        compact(
          db
            .select({ g: as(geof[name](o), db.variable('g')) })
            .where()
            .toSPARQL()
        )
      ).toContain(`<${geofNs}${name}> ( ?o )`);
    }
    expect(geof.rcc8ntppi(o, s).transform?.(rdf.literal('true'))).toBe(true);
    expect(geof.union(o, s).transform?.(rdf.literal('POINT (1 1)'))).toBe('POINT (1 1)');
  });

  test('pass expressions through and reject unknown unit names', () => {
    const unit = db.variable('unit');
    expect(
      compact(
        db
          .select({ d: as(geof.distance(o, s, unit), db.variable('d')) })
          .where()
          .toSPARQL()
      )
    ).toContain(`<${geofNs}distance> ( ?o , ?s , ?unit )`);
    expect(() => geof.distance(o, s, 'mile')).toThrow(SparkqlError);
    expect(() => geof.buffer(o, 1, 'toString')).toThrow('Unknown unit');
    expect(Object.isFrozen(geof)).toBe(true);
    expect(Object.isFrozen(uom)).toBe(true);
  });
});

describe('rdf4jNil', () => {
  test('prints as FROM and in GRAPH patterns, and cannot be changed', () => {
    expect(
      compact(
        db
          .select()
          .from(rdf4jNil)
          .where(triples(s, p, o))
          .toSPARQL()
      )
    ).toBe('SELECT * FROM <http://rdf4j.org/schema/rdf4j#nil> WHERE { ?s ?p ?o . }');
    expect(Object.isFrozen(rdf4jNil)).toBe(true);
  });
});

describe('RDF4J explain', () => {
  function stubbed(respond: () => Response) {
    const requests: Request[] = [];
    const fetchStub: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      requests.push(request.clone());
      return respond();
    };
    const explaining = SparqlDatabase.create({
      connection: {
        endpointUrl: 'https://example.org/repositories/r?infer=false',
        fetch: fetchStub,
      },
    });
    return { requests, explaining };
  }

  test('sends the query with the explain parameter and resolves to the plan', async () => {
    const { requests, explaining } = stubbed(() => new Response('Projection\n  StatementPattern'));
    const query = explaining.select({ o }).where(triples(s, p, o));
    const plan = explaining.explain(query);
    expect(plan.toSPARQL()).toBe(query.toSPARQL());
    expectTypeOf(plan).resolves.toEqualTypeOf<string>();
    expect(await plan).toBe('Projection\n  StatementPattern');
    expect(await explaining.explain(explaining.ask().where(triples(s, p, o)), 'Telemetry')).toBe(
      'Projection\n  StatementPattern'
    );

    const [first, second] = requests;
    expect(first.method).toBe('POST');
    expect(first.headers.get('accept')).toBe('text/plain');
    const url = new URL(first.url);
    expect(url.pathname).toBe('/repositories/r');
    expect(url.searchParams.get('explain')).toBe('Optimized');
    expect(url.searchParams.get('infer')).toBe('false');
    expect(await first.text()).toBe(query.toSPARQL());
    expect(new URL(second.url).searchParams.get('explain')).toBe('Telemetry');
  });

  test('rejects unknown levels, updates and error responses', async () => {
    const { explaining } = stubbed(() => new Response('bad', { status: 400 }));
    const query = explaining.select().where(triples(s, p, o));
    expect(() => explaining.explain(query, 'Full' as never)).toThrow('Unknown RDF4J explain level');
    expect(() =>
      explaining.explain(explaining.insert(triples(s, p, o)).where() as never).toSPARQL()
    ).toThrow('not updates');
    const failure = await explaining.explain(query).then(
      () => undefined,
      (error: unknown) => error
    );
    expect(failure).toBeInstanceOf(SparkqlQueryError);
  });

  test('is only on RDF4J databases', () => {
    // @ts-expect-error Explain over HTTP parameters is an RDF4J method.
    expect(BaseDatabase.create().explain).toBeUndefined();
  });
});
