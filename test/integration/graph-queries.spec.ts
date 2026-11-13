import { expect, test } from 'vitest';
import { SparqlDatabase, triples } from '#src/index.js';
import { describeEngines, prefixes, triplesOf } from './harness.js';

describeEngines('ASK and CONSTRUCT', 'sparql11', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);

  test('ASK answers whether a pattern matches', async () => {
    expect(await db.ask().where(triples(n.ex.alice, n.foaf.knows, n.ex.bob))).toBe(true);
    expect(await db.ask().where(triples(n.ex.bob, n.foaf.knows, n.ex.alice))).toBe(false);
  });

  test('CONSTRUCT returns the instantiated template', async () => {
    const quads = await db
      .construct(triples(v.book, n.ex.writtenBy, v.name))
      .where(triples(v.book, n.ex.author, v.author), triples(v.author, n.foaf.name, v.name));
    expect(triplesOf(quads)).toEqual([
      ['ex:book1', 'ex:writtenBy', '"Alice"'],
      ['ex:book2', 'ex:writtenBy', '"Alice"'],
      ['ex:book2', 'ex:writtenBy', '"Bob"'],
      ['ex:book3', 'ex:writtenBy', '"Carol"'],
    ]);
  });
});
