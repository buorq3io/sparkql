import { expect, test } from 'vitest';
import { SparqlDatabase } from '#src/stardog/index.js';
import { describeEngines, prefixes, rows } from './harness.js';

describeEngines('Stardog extensions', 'stardog', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);

  test('PATHS finds the shortest path', async () => {
    const paths = await db
      .paths()
      .start(v.start, n.ex.alice)
      .end(v.end, n.ex.dave)
      .via(n.foaf.knows);
    expect(paths.map(path => rows(path.edges))).toEqual([
      [
        { start: 'ex:alice', end: 'ex:carol' },
        { start: 'ex:carol', end: 'ex:dave' },
      ],
    ]);
  });
});
