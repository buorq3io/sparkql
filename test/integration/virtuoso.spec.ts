import { afterEach, expect, test } from 'vitest';
import {
  as,
  bif,
  define,
  desc,
  eq,
  filter,
  graph,
  quads,
  SparqlDatabase,
  textContains,
  transitive,
  triples,
} from '#src/virtuoso/index.js';
import { scratchGraph } from './engines.js';
import { describeEngines, prefixes, rows, unorderedRows } from './harness.js';

describeEngines('Virtuoso extensions', 'virtuoso', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);

  afterEach(async () => {
    await db.dropSilent(db.iri(scratchGraph));
  });

  test('DEFINE pragmas apply to the query', async () => {
    const count = (graph: string) =>
      db
        .select({ name: v.name })
        .where(
          define('input:default-graph-uri', new URL(graph)),
          define('sql:log-enable', 2),
          triples(v.person, n.foaf.name, v.name)
        );
    expect(await count('https://example.org/sparkql/graph')).toHaveLength(4);
    expect(await count('https://example.org/sparkql/nothing')).toEqual([]);
  });

  test('DEFINE pragmas apply to updates', async () => {
    const scratch = db.iri(scratchGraph);
    await db
      .insert(quads(scratch, triples(v.person, n.ex.named, true)))
      .where(
        define('input:default-graph-uri', new URL('https://example.org/sparkql/graph')),
        define('sql:log-enable', 3),
        triples(v.person, n.foaf.name, v.name)
      );
    const inserted = await db
      .select({ person: v.person })
      .where(graph(scratch, triples(v.person, n.ex.named, v.flag)));
    expect(inserted).toHaveLength(4);
  });

  test('bif:contains matches indexed literals with a score', async () => {
    const result = await db
      .select({ person: v.person, rank: v.rank })
      .where(
        triples(v.person, n.foaf.name, v.name),
        textContains(v.name, '"Alic*" OR "Carol"', { score: v.rank })
      )
      .orderBy(desc(v.rank), v.person);
    expect(rows(result).map(row => row.person)).toEqual(['ex:alice', 'ex:carol']);
    expect(rows(result).every(row => typeof row.rank === 'number')).toBe(true);
    const filtered = await db
      .select({ person: v.person })
      .where(triples(v.person, n.foaf.name, v.name), filter(bif.contains(v.name, '"Bob"')));
    expect(rows(filtered)).toEqual([{ person: 'ex:bob' }]);
  });

  test('transitive subqueries walk foaf:knows', async () => {
    const step = db
      .select({ person: v.person, friend: v.friend })
      .where(triples(v.person, n.foaf.knows, v.friend))
      .as();
    const result = await db
      .select({ friend: v.friend, distance: v.distance })
      .where(
        transitive(step, {
          in: [v.person],
          out: [v.friend],
          distinct: true,
          min: 1,
          stepNumber: v.distance,
        }),
        filter(eq(v.person, n.ex.alice))
      )
      .orderBy(v.friend);
    expect(rows(result)).toEqual([
      { friend: 'ex:bob', distance: 1 },
      { friend: 'ex:carol', distance: 1 },
      { friend: 'ex:dave', distance: 2 },
    ]);
    const bounded = await db
      .select({ friend: v.friend })
      .where(
        transitive(step, { in: [v.person], out: [v.friend], distinct: true, min: 2, max: 2 }),
        filter(eq(v.person, n.ex.alice))
      );
    expect(unorderedRows(bounded)).toEqual([{ friend: 'ex:dave' }]);
  });

  test('transitive step values, path ids, direction and shortest paths', async () => {
    const step = db
      .select({ person: v.person, friend: v.friend })
      .where(triples(v.person, n.foaf.knows, v.friend))
      .as();
    const result = await db
      .select({ friend: v.friend, via: v.via, path: v.path, step: v.step })
      .where(
        transitive(step, {
          in: [v.person],
          out: [v.friend],
          noCycles: true,
          shortestOnly: true,
          direction: 'forward',
          stepNumber: v.step,
          pathId: v.path,
          stepValues: [[v.person, v.via]],
        }),
        filter(eq(v.person, n.ex.alice)),
        filter(eq(v.friend, n.ex.dave))
      )
      .orderBy(v.step);
    // One shortest path alice -> carol -> dave, listed step by step.
    expect(rows(result).map(row => [row.via, row.step])).toEqual([
      ['ex:alice', 0],
      ['ex:carol', 1],
      ['ex:dave', 2],
    ]);
    expect(new Set(rows(result).map(row => row.path)).size).toBe(1);
  });

  test('bif: geometry functions', async () => {
    const london = bif.st_point(0, 52);
    const north = bif.st_point(0, 70);
    const [result] = await db
      .select({
        km: as(bif.st_distance(london, north), v.km),
        near: as(bif.st_intersects(london, bif.st_point(0, 52.1), 100), v.near),
        far: as(bif.st_intersects(london, north, 100), v.far),
        wkt: as(bif.st_astext(london), v.wkt),
        x: as(bif.st_x(bif.st_point(10, 20)), v.x),
        haversine: as(bif.haversine_deg_km(-90, 0, 90, 0), v.haversine),
      })
      .where();
    expect(Math.round(result.km)).toBe(2000);
    expect(result.near).toBe(true);
    expect(result.far).toBe(false);
    expect(result.wkt).toBe('POINT(0 52)');
    expect(result.x).toBe(10);
    expect(Math.round(result.haversine)).toBe(20004);
  });
});
