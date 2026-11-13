import { afterEach, expect, test } from 'vitest';
import { graph, quads, SparqlDatabase, triples } from '#src/index.js';
import { scratchGraph } from './engines.js';
import { describeEngines, prefixes, unorderedRows } from './harness.js';

describeEngines('UPDATE', 'sparql11', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);
  // Updates go to a named graph: Virtuoso has no writable default graph.
  const scratch = db.iri(scratchGraph);
  const inScratch = () =>
    db.select({ s: v.s, p: v.p, o: v.o }).where(graph(scratch, triples(v.s, v.p, v.o)));

  afterEach(async () => {
    await db.dropSilent(scratch);
  });

  test('INSERT DATA and DELETE DATA', async () => {
    await db.insertData(
      quads(scratch, triples(n.ex.erin, n.foaf.name, 'Erin')),
      quads(scratch, triples(n.ex.erin, n.foaf.age, 52))
    );
    expect(unorderedRows(await inScratch())).toEqual([
      { o: '"Erin"', p: 'foaf:name', s: 'ex:erin' },
      { o: 52, p: 'foaf:age', s: 'ex:erin' },
    ]);

    await db.deleteData(quads(scratch, triples(n.ex.erin, n.foaf.age, 52)));
    expect(unorderedRows(await inScratch())).toEqual([
      { o: '"Erin"', p: 'foaf:name', s: 'ex:erin' },
    ]);
  });

  test('INSERT ... WHERE copies matches from the dataset', async () => {
    await db
      .insert(quads(scratch, triples(v.person, n.ex.isAdult, true)))
      .where(triples(v.person, n.foaf.age, v.age));
    expect(unorderedRows(await inScratch())).toEqual([
      { o: true, p: 'ex:isAdult', s: 'ex:alice' },
      { o: true, p: 'ex:isAdult', s: 'ex:bob' },
      { o: true, p: 'ex:isAdult', s: 'ex:carol' },
    ]);
  });
});
