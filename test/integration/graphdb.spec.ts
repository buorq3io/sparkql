import { expect, test } from 'vitest';
import { as, historyAt, ofn, ontoGraphs, SparqlDatabase, triples } from '#src/graphdb/index.js';
import { describeEngines, prefixes, rows } from './harness.js';

describeEngines('GraphDB extensions', 'graphdb', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);
  const names = (...graphs: ReturnType<typeof historyAt>[]) =>
    graphs
      .reduce((query, graph) => query.from(graph), db.select({ name: v.name }))
      .where(triples(v.person, n.foaf.name, v.name));

  test('pseudo-graphs filter explicit and implicit statements', async () => {
    // The test repository uses the empty ruleset, so nothing is inferred.
    expect(await names(ontoGraphs.explicit)).toHaveLength(4);
    expect(await names(ontoGraphs.implicit)).toEqual([]);
    expect(await names(ontoGraphs.explicit, ontoGraphs.disableSameAs)).toHaveLength(4);
    // Without the history plugin, statements are returned as they are.
    expect(await names(historyAt('2020'))).toHaveLength(4);
  });

  test('explain and measure return the plan', async () => {
    const query = names().orderBy(v.name);
    const plan = await db.explain(query);
    expect(plan).toContain('Begin optimization group 1');
    expect(plan).toContain('ESTIMATED NUMBER OF ITERATIONS');
    expect(await db.measure(query)).toContain('EXECUTION');
  });

  test('ofn: functions', async () => {
    const result = await db
      .select({
        days: as(
          ofn.daysBetween(
            db.literal('2024-01-01', n.xsd.date),
            db.literal('2024-03-01', n.xsd.date)
          ),
          v.days
        ),
        years: as(ofn.yearsFromDuration(db.literal('P3Y2M', n.xsd.duration)), v.years),
        root: as(ofn.sqrt(16), v.root),
        pi: as(ofn.pi(), v.pi),
      })
      .where();
    expect(rows(result)).toEqual([{ days: 60, years: 3, root: 4, pi: Math.PI }]);
  });
});
