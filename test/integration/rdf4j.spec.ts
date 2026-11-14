import { afterAll, expect, test } from 'vitest';
import {
  as,
  desc,
  geof,
  graph,
  quads,
  rdf4jNil,
  SparqlDatabase,
  textSearch,
  triples,
} from '#src/rdf4j/index.js';
import { rdf4jLuceneConnection, scratchGraph } from './engines.js';
import { describeEngines, prefixes, rows } from './harness.js';

describeEngines('RDF4J extensions', 'rdf4j', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const lucene = SparqlDatabase.create({
    connection: rdf4jLuceneConnection,
    managerConfig: prefixes,
  });
  const [v, n] = db.createManagers([], prefixes);

  test('text search returns matches with score and snippet', async () => {
    const result = await lucene
      .select({ book: v.book, text: v.text, score: v.score })
      .where(
        textSearch(v.book, 'light*', { property: n.rdfs.label, score: v.score, snippet: v.text })
      );
    expect(rows(result).map(({ score, ...row }) => row)).toEqual([
      { book: 'ex:book1', text: '"The <B>Lighthouse</B>"' },
    ]);
    expect(rows(result)[0].score).toBeGreaterThan(0);
  });

  test('text search binds the matched property and tests a given resource', async () => {
    const matched = await lucene
      .select({ s: v.s, p: v.p })
      .where(textSearch(v.s, 'roads', { property: v.p }));
    expect(rows(matched)).toEqual([{ s: 'ex:book3', p: 'rdfs:label' }]);
    expect(await lucene.ask().where(textSearch(n.ex.alice, 'alice'))).toBe(true);
    expect(await lucene.ask().where(textSearch(n.ex.bob, 'alice'))).toBe(false);
  });

  test('combined text search and numDocs', async () => {
    const combined = await lucene
      .select({ s: v.s })
      .where(
        textSearch(
          v.s,
          [
            { query: 'rivers', property: n.rdfs.label, boost: 0.8 },
            { query: 'carol', property: n.foaf.name, boost: 0.2 },
          ],
          { score: v.score }
        )
      )
      .orderBy(desc(v.score));
    expect(rows(combined)).toEqual([{ s: 'ex:book2' }, { s: 'ex:carol' }]);
    const limited = await lucene.select({ s: v.s }).where(textSearch(v.s, 'a*', { numDocs: 2 }));
    expect(limited).toHaveLength(2);
  });

  test('text search matches nothing on a repository without a LuceneSail', async () => {
    expect(await db.select({ s: v.s }).where(textSearch(v.s, 'alice'))).toEqual([]);
  });

  test('geof: functions', async () => {
    const point = 'POINT(1 1)';
    const square = 'POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))';
    const result = await db
      .select({
        metres: as(geof.distance('POINT(0 0)', 'POINT(1 0)', 'metre'), v.metres),
        degrees: as(geof.distance('POINT(0 0)', 'POINT(1 0)', 'degree'), v.degrees),
        within: as(geof.sfWithin(point, square), v.within),
        touches: as(geof.sfTouches(point, square), v.touches),
        inside: as(geof.ehInside(point, square), v.inside),
        relate: as(geof.relate(point, square, 'T*F**F***'), v.relate),
        envelope: as(geof.envelope('LINESTRING(0 0, 3 3)'), v.envelope),
        srid: as(geof.getSRID(point), v.srid),
      })
      .where();
    expect(result).toHaveLength(1);
    const [row] = result;
    expect(row.metres).toBeCloseTo(111195, 0);
    expect(row).toMatchObject({
      degrees: 1,
      within: true,
      touches: false,
      inside: true,
      relate: true,
      envelope: 'POLYGON ((0 0, 0 3, 3 3, 3 0, 0 0))',
      srid: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
    });
  });

  test('rdf4jNil holds only the statements outside named graphs', async () => {
    await db.insert(quads(db.iri(scratchGraph), triples(n.ex.erin, n.foaf.name, 'Erin')));
    const name = triples(v.person, n.foaf.name, v.name);
    // RDF4J's default graph is the union of all graphs.
    expect(await db.select({ name: v.name }).where(name)).toHaveLength(5);
    expect(await db.select({ name: v.name }).from(rdf4jNil).where(name)).toHaveLength(4);
    const inNil = await db
      .select({ name: v.name })
      .where(graph(rdf4jNil, triples(n.ex.erin, n.foaf.name, v.name)));
    expect(inNil).toEqual([]);
    await db.dropSilent(db.iri(scratchGraph));
  });

  test('explain returns the plan at each level', async () => {
    const query = db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
    expect(await db.explain(query)).toContain('StatementPattern');
    expect(await db.explain(query, 'Unoptimized')).toContain('StatementPattern');
    expect(await db.explain(query, 'Executed')).toContain('resultSizeActual=4');
    expect(await db.explain(query, 'Timed')).toContain('totalTimeActual');
    expect(await db.explain(db.ask().where(triples(v.s, v.p, v.o)), 'Telemetry')).toContain(
      'resultSizeActual'
    );
  });

  test('protocol parameters in the endpoint URL are kept', async () => {
    const plain = SparqlDatabase.create({
      connection: {
        ...engine.connection,
        endpointUrl: `${engine.connection.endpointUrl}?infer=false`,
      },
      managerConfig: prefixes,
    });
    expect(
      await plain.select({ name: v.name }).where(triples(v.p, n.foaf.name, v.name))
    ).toHaveLength(4);
    expect(await plain.explain(plain.ask().where())).toContain('SingletonSet');
  });

  afterAll(async () => {
    await db.dropSilent(db.iri(scratchGraph));
  });
});
