import { afterAll, expect, test } from 'vitest';
import {
  adjust,
  as,
  graph,
  lateral,
  quads,
  SparqlDatabase,
  str,
  triples,
} from '#src/oxigraph/index.js';
import { scratchGraph } from './engines.js';
import { describeEngines, prefixes, rows } from './harness.js';

describeEngines('Oxigraph extensions', 'oxigraph', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);

  test('LATERAL evaluates per solution', async () => {
    const result = await db
      .select({ author: v.author, title: v.title })
      .where(
        triples(v.author, n.foaf.name, v.name),
        lateral(
          // The subquery must project ?author to see the outer binding.
          db
            .select({ author: v.author, title: v.title })
            .where(triples(v.book, n.ex.author, v.author), triples(v.book, n.rdfs.label, v.title))
            // SPARQL leaves the order of language strings partly to the engine.
            .orderBy(str(v.title))
            .limit(1)
            .as()
        )
      )
      .orderBy(v.author);
    expect(rows(result)).toEqual([
      { author: 'ex:alice', title: '"Le Phare"@fr' },
      { author: 'ex:bob', title: '"Rivers"@en' },
      { author: 'ex:carol', title: '"Alte Straßen"@de' },
    ]);
  });

  test('ADJUST moves dates, times and date-times to a timezone', async () => {
    const result = await db
      .select({
        born: as(adjust(v.born, '-PT5H'), v.local),
        dateTime: as(adjust(db.literal('2020-01-01T00:00:00Z', n.xsd.dateTime), 'PT2H'), v.dt),
        time: as(adjust(db.literal('10:00:00', n.xsd.time), 'PT1H30M'), v.t),
        typed: as(
          adjust(
            db.literal('2020-01-01T12:00:00+01:00', n.xsd.dateTime),
            db.literal('PT0H', n.xsd.dayTimeDuration)
          ),
          v.utc
        ),
      })
      .where(triples(n.ex.alice, n.ex.born, v.born));
    expect(rows(result)).toEqual([
      {
        born: '"1990-04-12-05:00"^^xsd:date',
        dateTime: '"2020-01-01T02:00:00+02:00"^^xsd:dateTime',
        time: '"10:00:00+01:30"^^xsd:time',
        typed: '"2020-01-01T11:00:00Z"^^xsd:dateTime',
      },
    ]);
  });

  test('union-default-graph in the endpoint URL adds named graphs to the default graph', async () => {
    const union = SparqlDatabase.create({
      connection: {
        ...engine.connection,
        endpointUrl: `${engine.connection.endpointUrl}?union-default-graph`,
      },
      managerConfig: prefixes,
    });
    await db.insert(quads(db.iri(scratchGraph), triples(n.ex.erin, n.foaf.name, 'Erin')));
    const erin = (database: typeof db) =>
      database.select({ name: v.name }).where(triples(n.ex.erin, n.foaf.name, v.name));
    expect(rows(await erin(db))).toEqual([]);
    expect(rows(await erin(union))).toEqual([{ name: '"Erin"' }]);
    expect(
      rows(
        await db
          .select({ name: v.name })
          .where(graph(db.iri(scratchGraph), triples(n.ex.erin, n.foaf.name, v.name)))
      )
    ).toEqual([{ name: '"Erin"' }]);
  });

  afterAll(async () => {
    await db.dropSilent(db.iri(scratchGraph));
  });
});
