import { expect, test } from 'vitest';
import {
  as,
  collation,
  idiv,
  lateral,
  letBinding,
  mod,
  SparqlDatabase,
  str,
  triples,
} from '#src/arq/index.js';
import { describeEngines, prefixes, rows } from './harness.js';

describeEngines('ARQ extensions', 'arq', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);

  test('MOD and IDIV', async () => {
    const result = await db
      .select({
        name: v.name,
        remainder: as(mod(v.pages, 100), v.remainder),
        hundreds: as(idiv(v.pages, 100), v.hundreds),
      })
      .where(triples(v.book, n.ex.pages, v.pages), triples(v.book, n.rdfs.label, v.name))
      .orderBy(v.name);
    expect(rows(result).filter(row => !String(row.name).endsWith('@fr'))).toEqual([
      { name: '"Alte Straßen"@de', remainder: 12, hundreds: 5 },
      { name: '"Old Roads"@en', remainder: 12, hundreds: 5 },
      { name: '"Rivers"@en', remainder: 10, hundreds: 2 },
      { name: '"The Lighthouse"@en', remainder: 20, hundreds: 3 },
    ]);
  });

  test('LET binds an expression', async () => {
    const result = await db
      .select({ name: v.name, next: v.next })
      .where(
        triples(v.person, n.foaf.name, v.name),
        triples(v.person, n.foaf.age, v.age),
        letBinding(mod(v.age, 10), v.next)
      )
      .orderBy(v.name);
    expect(rows(result)).toEqual([
      { name: '"Alice"', next: 4 },
      { name: '"Bob"', next: 7 },
      { name: '"Carol"', next: 5 },
    ]);
  });

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

  test('collation orders by locale', async () => {
    const result = await db
      .select({ label: v.label })
      .where(triples(v.book, n.rdfs.label, v.label))
      .orderBy(collation('en', v.label));
    expect(rows(result).map(row => row.label)).toEqual([
      '"Alte Straßen"@de',
      '"Le Phare"@fr',
      '"Old Roads"@en',
      '"Rivers"@en',
      '"The Lighthouse"@en',
    ]);
  });
});
