import { expect, test } from 'vitest';
import {
  as,
  containsEntity,
  containsWord,
  filter,
  geof,
  pathSearch,
  ql,
  rowNumber,
  SparqlDatabase,
  spatialSearch,
  textSearch,
  triples,
  values,
} from '#src/qlever/index.js';
import { describeEngines, prefixes, rows } from './harness.js';

const wkt = new URL('http://www.opengis.net/ont/geosparql#wktLiteral');

describeEngines('QLever extensions', 'qlever', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);
  const point = (text: string) => db.literal(text, wkt);

  test('containsWord and containsEntity search the text index', async () => {
    // The test index makes each literal a text record that mentions itself.
    const result = await db
      .select({ book: v.book })
      .where(
        containsWord(v.text, 'light*'),
        containsEntity(v.text, v.label),
        triples(v.book, n.rdfs.label, v.label)
      );
    expect(rows(result)).toEqual([{ book: 'ex:book1' }]);
  });

  test('textSearch binds scores, prefix completions and entities', async () => {
    const prefix = await db
      .select({ completion: v.completion, score: v.score })
      .where(textSearch(v.text, { word: 'light*', score: v.score, prefixMatch: v.completion }));
    expect(rows(prefix).map(row => row.completion)).toContain('"lighthouse"');
    expect(rows(prefix).every(row => Number(row.score) > 0)).toBe(true);
    const entities = await db
      .select({ book: v.book })
      .where(
        textSearch(v.text, { word: 'roads' }, { entity: v.label }),
        triples(v.book, n.rdfs.label, v.label)
      );
    expect(rows(entities)).toEqual([{ book: 'ex:book3' }]);
  });

  test('pathSearch returns every path, edge by edge', async () => {
    const result = await db
      .select({ path: v.path, edge: v.edge, start: v.start, end: v.end })
      .where(
        pathSearch(
          {
            source: n.ex.alice,
            target: n.ex.dave,
            start: v.start,
            end: v.end,
            path: v.path,
            edge: v.edge,
          },
          triples(v.start, n.foaf.knows, v.end)
        )
      );
    const paths = new Map<string, string[]>();
    for (const row of rows(result).sort((x, y) => Number(x.edge) - Number(y.edge))) {
      const edges = paths.get(String(row.path)) ?? [];
      edges.push(`${row.start}>${row.end}`);
      paths.set(String(row.path), edges);
    }
    expect([...paths.values()].map(edges => edges.join(' ')).sort()).toEqual([
      'ex:alice>ex:bob ex:bob>ex:carol ex:carol>ex:dave',
      'ex:alice>ex:carol ex:carol>ex:dave',
    ]);
    const near = await db
      .select({ end: v.end })
      .where(
        pathSearch(
          {
            source: n.ex.alice,
            start: v.start,
            end: v.end,
            path: v.path,
            edge: v.edge,
            maxDepth: 1,
          },
          triples(v.start, n.foaf.knows, v.end)
        )
      )
      .orderBy(v.end);
    expect(rows(near)).toEqual([{ end: 'ex:bob' }, { end: 'ex:carol' }]);
  });

  test('spatialSearch finds nearest neighbours and spatial relations', async () => {
    const left = values({ a: [point('POINT(7.8 48.0)')] });
    const right = values({
      b: [point('POINT(7.9 48.1)'), point('POINT(9.5 50)')],
      name: ['near', 'far'],
    });
    const nearest = await db.select({ name: v.name, km: v.km }).where(
      left,
      spatialSearch(
        {
          algorithm: 's2',
          left: v.a,
          right: v.b,
          numNearestNeighbors: 1,
          bindDistance: v.km,
          payload: [v.name],
        },
        right
      )
    );
    expect(rows(nearest)).toHaveLength(1);
    expect(rows(nearest)[0].name).toBe('"near"');
    expect(Number(rows(nearest)[0].km)).toBeCloseTo(13.4, 0);

    const inside = await db.select({ name: v.name }).where(
      values({ a: [point('POLYGON((7 47, 7 49, 9 49, 9 47, 7 47))')] }),
      spatialSearch(
        {
          algorithm: 'libspatialjoin',
          left: v.a,
          right: v.b,
          joinType: 'intersects',
          payload: 'all',
        },
        right
      )
    );
    expect(rows(inside)).toEqual([{ name: '"near"' }]);
  });

  test('rowNumber numbers an ordered subquery', async () => {
    const names = db
      .select({ name: v.name })
      .where(triples(v.person, n.foaf.name, v.name))
      .orderBy(v.name)
      .as();
    const result = await db
      .select({ rank: v.rank, name: v.name })
      .where(rowNumber(v.rank, names, { offset: 1 }))
      .orderBy(v.rank);
    expect(rows(result)).toEqual([
      { rank: 1, name: '"Alice"' },
      { rank: 2, name: '"Bob"' },
      { rank: 3, name: '"Carol"' },
      { rank: 4, name: '"Dave"' },
    ]);
  });

  test('geof: and ql: functions', async () => {
    const square = point('POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))');
    const [row] = await db
      .select({
        km: as(geof.distance('POINT(0 0)', 'POINT(1 0)'), v.km),
        metres: as(geof.distance('POINT(0 0)', 'POINT(1 0)', 'M'), v.metres),
        metric: as(geof.metricDistance('POINT(0 0)', 'POINT(1 0)'), v.metric),
        latitude: as(geof.latitude('POINT(7.8 48.0)'), v.latitude),
        centroid: as(geof.centroid(square), v.centroid),
        type: as(geof.geometryType(square), v.type),
        count: as(geof.numGeometries('MULTIPOINT((1 2),(3 4))'), v.count),
        second: as(geof.geometryN('MULTIPOINT((1 2),(3 4))', 2), v.second),
        hectares: as(geof.area(square, 'HA'), v.hectares),
        epoch: as(ql.toEpoch(db.literal('1970-01-02', n.xsd.date)), v.epoch),
        isPoint: as(ql.isGeoPoint('POINT(1 2)'), v.isPoint),
      })
      .where();
    expect(row.km).toBeCloseTo(111.3, 1);
    expect(row.metres).toBeCloseTo(111319, -1);
    expect(row.metric).toBeCloseTo(111319, -1);
    expect(row.latitude).toBeCloseTo(48, 3);
    expect(row).toMatchObject({
      centroid: 'POINT(1.000000 1.000000)',
      type: 'http://www.opengis.net/ont/sf#Polygon',
      count: 2,
      second: 'POINT(3 4)',
      epoch: 86400,
      isPoint: true,
    });
    expect(row.hectares).toBeGreaterThan(0);

    const contained = await db
      .select({ name: v.name })
      .where(
        values({ shape: [square], name: ['square'] }),
        filter(geof.sfContains(v.shape, 'POINT(1 1)'))
      );
    expect(rows(contained)).toEqual([{ name: '"square"' }]);
  });
});
