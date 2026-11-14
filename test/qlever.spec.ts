import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { SparqlDatabase as BaseDatabase } from '../src/index.js';
import {
  as,
  containsEntity,
  containsWord,
  filter,
  geof,
  group,
  optional,
  pathSearch,
  ql,
  qleverDialect,
  rowNumber,
  SparkqlError,
  SparqlDatabase,
  spatialSearch,
  textSearch,
  triples,
  union,
} from '../src/qlever/index.js';
import { SparqlDatabase as Rdf4jDatabase } from '../src/rdf4j/index.js';

const QL = 'http://qlever.cs.uni-freiburg.de/builtin-functions/';
const TS = 'https://qlever.cs.uni-freiburg.de/textSearch/';
const PS = 'https://qlever.cs.uni-freiburg.de/pathSearch/';
const SS = 'https://qlever.cs.uni-freiburg.de/spatialSearch/';
const RN = 'https://qlever.cs.uni-freiburg.de/rowNumber/';
const GEOF = 'http://www.opengis.net/def/function/geosparql/';
const WKT = '<http://www.opengis.net/ont/geosparql#wktLiteral>';
const INT = '<http://www.w3.org/2001/XMLSchema#integer>';
const rdf = new DataFactory();
const db = SparqlDatabase.create();
const [s, p, o, t, e, score, start, end, path, edge, n, a, b, d] = [
  's',
  'p',
  'o',
  't',
  'e',
  'score',
  'start',
  'end',
  'path',
  'edge',
  'n',
  'a',
  'b',
  'd',
].map(name => db.variable(name));
const knows = db.iri('http://xmlns.com/foaf/0.1/knows');
const alice = new URL('https://example.org/alice');
const compact = (sparql: string) => sparql.replace(/\s+/g, ' ').trim();
const body = (pattern: unknown) =>
  compact(
    db
      .select()
      .where(pattern as never)
      .toSPARQL()
  ).replace(/^SELECT \* WHERE /, '');
const parser = new Parser();
const parses = (pattern: unknown) =>
  expect(() =>
    parser.parse(
      db
        .select()
        .where(pattern as never)
        .toSPARQL()
    )
  ).not.toThrow();

describe('QLever text search', () => {
  test('containsWord and containsEntity print the ql: predicates', () => {
    expect(body(containsWord(t, 'moon walk*'))).toBe(`{ ?t <${QL}contains-word> "moon walk*" . }`);
    expect(body(containsEntity(t, e))).toBe(`{ ?t <${QL}contains-entity> ?e . }`);
    expect(body(containsEntity(t, alice))).toBe(
      `{ ?t <${QL}contains-entity> <https://example.org/alice> . }`
    );
    expect(body(containsEntity(t, 'Alice'))).toBe(`{ ?t <${QL}contains-entity> "Alice" . }`);
    expect(() => containsWord(t, ' ')).toThrow(SparkqlError);
    expect(() => containsWord('t' as never, 'x')).toThrow('`text` must be a variable');
  });

  test('textSearch prints one configuration per search inside the service', () => {
    const pattern = textSearch(
      t,
      { word: 'light*', score, prefixMatch: o },
      { word: 'roads' },
      { entity: e, score: s }
    );
    expect(body(pattern)).toBe(
      `{ SERVICE <${TS}> { ` +
        `?t <${TS}contains> [ <${TS}word> "light*" ; <${TS}prefix-match> ?o ; <${TS}score> ?score ; ] . ` +
        `?t <${TS}contains> [ <${TS}word> "roads" ; ] . ` +
        `?t <${TS}contains> [ <${TS}entity> ?e ; <${TS}score> ?s ; ] . } }`
    );
    parses(pattern);
  });

  test('textSearch follows QLever’s rules for searches', () => {
    expect(() => textSearch(t)).toThrow('at least one search');
    expect(() => textSearch(t, { entity: e })).toThrow('needs a word search');
    expect(() => textSearch(t, { word: 'a', entity: e } as never)).toThrow('exactly one');
    expect(() => textSearch(t, {} as never)).toThrow('exactly one');
    expect(() => textSearch(t, { word: 'two words' })).toThrow('one word');
    expect(() => textSearch(t, { word: '' })).toThrow('one word');
    expect(() => textSearch(t, { word: 'light', prefixMatch: o })).toThrow('ending in `*`');
    expect(() => textSearch(t, { word: 'a', score: 'x' as never })).toThrow('`score`');
  });
});

describe('QLever path search', () => {
  const required = { start, end, path, edge };

  test('prints the configuration and the edge group', () => {
    const pattern = pathSearch(
      {
        ...required,
        source: [alice, s],
        target: new URL('https://example.org/dave'),
        edgeProperties: [p],
        cartesian: false,
        numPathsPerTarget: 2,
        maxDepth: 3,
      },
      triples(start, knows, end)
    );
    expect(body(pattern)).toBe(
      `{ SERVICE <${PS}> { [ ` +
        `<${PS}algorithm> <${PS}allPaths> ; ` +
        `<${PS}source> <https://example.org/alice> ; <${PS}source> ?s ; ` +
        `<${PS}target> <https://example.org/dave> ; ` +
        `<${PS}start> ?start ; <${PS}end> ?end ; <${PS}pathColumn> ?path ; <${PS}edgeColumn> ?edge ; ` +
        `<${PS}edgeProperty> ?p ; ` +
        `<${PS}cartesian> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> ; ` +
        `<${PS}numPathsPerTarget> "2"^^${INT} ; <${PS}maxDepth> "3"^^${INT} ; ` +
        `] . { ?start <http://xmlns.com/foaf/0.1/knows> ?end . } } }`
    );
    parses(pattern);
  });

  test('checks its options', () => {
    const edges = triples(start, knows, end);
    const check =
      (options: object, ...patterns: unknown[]) =>
      () =>
        pathSearch({ ...required, source: alice, ...options } as never, ...(patterns as never[]));
    expect(check({}, edges)).not.toThrow();
    expect(check({})).toThrow('edge patterns');
    expect(check({ source: [] }, edges)).toThrow('at least one `source`');
    expect(check({ end: start }, edges)).toThrow('different variables');
    expect(check({ path: undefined }, edges)).toThrow('`path` must be a variable');
    expect(check({ maxDepth: -1 }, edges)).toThrow('`maxDepth`');
    expect(check({ maxDepth: 0 }, edges)).not.toThrow();
    expect(check({ numPathsPerTarget: 0 }, edges)).toThrow('`numPathsPerTarget`');
    expect(check({ cartesian: 'yes' }, edges)).toThrow('`cartesian`');
    expect(check({ edgeProperties: ['x'] }, edges)).toThrow('`edgeProperties`');
  });
});

describe('QLever spatial search', () => {
  const right = triples(s, p, b);

  test('prints the configuration and the right group', () => {
    const pattern = spatialSearch(
      {
        algorithm: 'libspatialjoin',
        left: a,
        right: b,
        joinType: 'within-dist',
        maxDistance: 500,
        bindDistance: d,
        distanceUnit: 'KiloM',
        payload: 'all',
      },
      right
    );
    expect(body(pattern)).toBe(
      `{ SERVICE <${SS}> { [ ` +
        `<${SS}algorithm> <${SS}libspatialjoin> ; <${SS}left> ?a ; <${SS}right> ?b ; ` +
        `<${SS}maxDistance> "500"^^${INT} ; <${SS}joinType> <${SS}within-dist> ; ` +
        `<${SS}bindDistance> ?d ; <${SS}distanceUnit> <http://qudt.org/vocab/unit/KiloM> ; ` +
        `<${SS}payload> <${SS}all> ; ] . { ?s ?p ?b . } } }`
    );
    parses(pattern);
    expect(
      body(
        spatialSearch(
          {
            algorithm: 'libspatialjoin',
            left: a,
            right: b,
            joinType: 'de9im',
            de9imFilter: 'T*F**F***',
          },
          right
        )
      )
    ).toContain(`<${SS}de9imFilter> "T*F**F***"`);
    expect(
      body(
        spatialSearch(
          { algorithm: 's2', left: a, right: b, numNearestNeighbors: 1, payload: [s, p] },
          right
        )
      )
    ).toContain(`<${SS}payload> ?s ; <${SS}payload> ?p ;`);
  });

  test('follows QLever’s rules for options', () => {
    const check =
      (options: object, ...patterns: unknown[]) =>
      () =>
        spatialSearch(
          { algorithm: 's2', left: a, right: b, ...options } as never,
          ...((patterns.length ? patterns : [right]) as never[])
        );
    expect(check({ maxDistance: 10 })).not.toThrow();
    expect(check({})).toThrow('give `numNearestNeighbors`, `maxDistance` or `joinType`');
    expect(check({ algorithm: 'rtree', maxDistance: 1 })).toThrow('`algorithm`');
    expect(check({ right: a, maxDistance: 1 })).toThrow('different variables');
    expect(check({ joinType: 'intersects' })).toThrow('only it takes one');
    expect(check({ algorithm: 'libspatialjoin', maxDistance: 1 })).toThrow('needs a `joinType`');
    expect(check({ algorithm: 'libspatialjoin', joinType: 'near' })).toThrow('`joinType` must be');
    expect(check({ algorithm: 'libspatialjoin', joinType: 'within-dist' })).toThrow(
      'needs `maxDistance`'
    );
    expect(
      check({ algorithm: 'libspatialjoin', joinType: 'intersects', numNearestNeighbors: 1 })
    ).toThrow('`s2` and `baseline`');
    expect(check({ algorithm: 'libspatialjoin', joinType: 'de9im' })).toThrow('`de9imFilter`');
    expect(
      check({ algorithm: 'libspatialjoin', joinType: 'de9im', de9imFilter: 'T*F**F**' })
    ).toThrow('nine characters');
    expect(check({ maxDistance: 1, de9imFilter: 'T*F**F***' })).toThrow('`de9imFilter`');
    expect(check({ maxDistance: 1, distanceUnit: 'M' })).toThrow('needs `bindDistance`');
    expect(check({ maxDistance: 1, bindDistance: d, distanceUnit: 'M2' })).toThrow('length unit');
    expect(check({ maxDistance: -1 })).toThrow('`maxDistance`');
    expect(check({ numNearestNeighbors: 0 })).toThrow('`numNearestNeighbors`');
    expect(check({ maxDistance: 1, payload: 's' })).toThrow('`payload`');
    expect(() => spatialSearch({ algorithm: 's2', left: a, right: b, maxDistance: 1 })).toThrow(
      'bind `right`'
    );
  });
});

describe('QLever row numbers', () => {
  const ordered = db
    .select({ o })
    .where(triples(s, p, o))
    .orderBy(o)
    .as();

  test('number an ordered subquery', () => {
    const pattern = rowNumber(n, ordered, { offset: 1 });
    expect(body(pattern)).toBe(
      `{ SERVICE <${RN}> { [ <${RN}bind> ?n ; <${RN}offset> "1"^^${INT} ; ] . ` +
        '{ SELECT ?o WHERE { ?s ?p ?o . } ORDER BY ASC ( ?o ) } } }'
    );
    parses(pattern);
    expect(body(rowNumber(n, ordered))).not.toContain('offset');
  });

  test('require an ordered subquery that does not select the row number', () => {
    const unordered = db
      .select({ o })
      .where(triples(s, p, o))
      .as();
    const selectsN = db
      .select({ n })
      .where(triples(s, p, n))
      .orderBy(n)
      .as();
    expect(() => body(rowNumber(n, unordered))).toThrow('needs an `orderBy()`');
    expect(() => body(rowNumber(n, selectsN))).toThrow('must not select ?n');
    expect(() => body(rowNumber(n, group(triples(s, p, o)) as never))).toThrow('one subquery');
    expect(() => rowNumber(n, ordered, { offset: -1 })).toThrow('`offset`');
    expect(() => rowNumber('n' as never, ordered)).toThrow('`bind`');
  });
});

describe('QLever patterns in queries', () => {
  test('print at any depth, nest in each other, and work through the standard factory', () => {
    const nested = pathSearch(
      { source: alice, start, end, path, edge },
      containsWord(t, 'knows'),
      containsEntity(t, end)
    );
    const query = db.ask().where(optional(union(group(nested), group(containsWord(t, 'x')))));
    expect(compact(query.toSPARQL())).toContain(
      `{ ?t <${QL}contains-word> "knows" . ?t <${QL}contains-entity> ?end . }`
    );
    const custom = BaseDatabase.create({ dialect: qleverDialect });
    expect(custom.select().where(containsWord(t, 'x')).toSPARQL()).toContain('contains-word');
  });

  test('are rejected by other dialects', () => {
    const pattern = containsWord(t, 'x') as never;
    expect(() => BaseDatabase.create().select().where(pattern).toSPARQL()).toThrow();
    expect(() => Rdf4jDatabase.create().select().where(pattern).toSPARQL()).toThrow();
  });
});

describe('QLever functions', () => {
  test('geof: functions take QUDT units and send strings as WKT', () => {
    const query = db
      .select({
        km: as(geof.distance(o, 'POINT(1 0)'), db.variable('km')),
        metres: as(geof.distance(o, s, 'M'), db.variable('metres')),
        area: as(geof.area(o, 'HA'), db.variable('area')),
        length: as(geof.length(o, 'MI'), db.variable('length')),
        centroid: as(geof.centroid('POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))'), db.variable('centroid')),
        second: as(geof.geometryN(o, 2), db.variable('second')),
        count: as(geof.numGeometries(o), db.variable('count')),
        epoch: as(ql.toEpoch(s), db.variable('epoch')),
        point: as(ql.isGeoPoint(o), db.variable('point')),
      })
      .where(filter(geof.sfContains(o, 'POINT(1 1)')), filter(geof.relate(o, s, 'T*F**F***')));
    const sparql = compact(query.toSPARQL());
    expect(sparql).toContain(`<${GEOF}distance> ( ?o , "POINT(1 0)"^^${WKT} ) AS ?km`);
    expect(sparql).toContain(`<${GEOF}distance> ( ?o , ?s , <http://qudt.org/vocab/unit/M> )`);
    expect(sparql).toContain(`<${GEOF}area> ( ?o , <http://qudt.org/vocab/unit/HA> )`);
    expect(sparql).toContain(`<${GEOF}length> ( ?o , <http://qudt.org/vocab/unit/MI> )`);
    expect(sparql).toContain(`<${GEOF}centroid> ( "POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))"^^${WKT} )`);
    expect(sparql).toContain(`<${GEOF}geometryN> ( ?o , "2"^^${INT} )`);
    expect(sparql).toContain(`FILTER ( <${GEOF}sfContains> ( ?o , "POINT(1 1)"^^${WKT} ) )`);
    expect(sparql).toContain(`<${QL}toEpoch> ( ?s )`);
    expect(() => parser.parse(sparql)).not.toThrow();
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<
      {
        km: number;
        metres: number;
        area: number;
        length: number;
        centroid: string;
        second: string;
        count: number;
        epoch: number;
        point: boolean;
      }[]
    >();
    expect(geof.sfWithin(o, s).transform?.(rdf.literal('true'))).toBe(true);
    expect(geof.metricArea(o).transform?.(rdf.literal('2.5'))).toBe(2.5);
  });

  test('cover QLever’s documented functions and reject unknown units', () => {
    expect(Object.keys(geof).sort()).toEqual(
      [
        'distance',
        'metricDistance',
        'length',
        'area',
        'metricLength',
        'metricArea',
        'latitude',
        'longitude',
        'minX',
        'minY',
        'maxX',
        'maxY',
        'centroid',
        'envelope',
        'asGeoJSON',
        'geometryType',
        'numGeometries',
        'geometryN',
        'relate',
        'sfIntersects',
        'sfContains',
        'sfCovers',
        'sfCrosses',
        'sfTouches',
        'sfEquals',
        'sfOverlaps',
        'sfWithin',
      ].sort()
    );
    expect(Object.keys(ql).sort()).toEqual(
      [
        'envelopeLowerLeft',
        'envelopeUpperRight',
        'isGeoPoint',
        'simplifyGeometry',
        'toEpoch',
      ].sort()
    );
    expect(() => geof.distance(o, s, 'metre' as never)).toThrow('unknown length unit');
    expect(() => geof.area(o, 'M' as never)).toThrow('unknown area unit');
    expect(Object.isFrozen(geof)).toBe(true);
    expect(Object.isFrozen(ql)).toBe(true);
  });
});
