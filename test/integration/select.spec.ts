import { expect, test } from 'vitest';
import {
  as,
  asc,
  count,
  defaultCodecs,
  desc,
  eq,
  filter,
  group,
  gt,
  lang,
  minus,
  oneOrMore,
  optional,
  SparqlDatabase,
  sum,
  triples,
  union,
  values,
} from '#src/index.js';
import { describeEngines, expectedOn, prefixes, rows, unorderedRows } from './harness.js';

describeEngines('SELECT', 'sparql11', engine => {
  const db = SparqlDatabase.create({ connection: engine.connection, managerConfig: prefixes });
  const [v, n] = db.createManagers([], prefixes);

  test('projects bound terms in ORDER BY order', async () => {
    const result = await db
      .select({ person: v.person, name: v.name })
      .where(triples(v.person, n.rdf.type, n.foaf.Person), triples(v.person, n.foaf.name, v.name))
      .orderBy(v.name);
    expect(rows(result)).toEqual([
      { person: 'ex:alice', name: '"Alice"' },
      { person: 'ex:bob', name: '"Bob"' },
      { person: 'ex:carol', name: '"Carol"' },
      { person: 'ex:dave', name: '"Dave"' },
    ]);
  });

  test('leaves OPTIONAL variables unbound', async () => {
    const result = await db
      .select({ name: v.name, age: v.age })
      .where(triples(v.person, n.foaf.name, v.name), optional(triples(v.person, n.foaf.age, v.age)))
      .orderBy(desc(v.name));
    expect(rows(result)).toEqual([
      { name: '"Dave"' },
      { name: '"Carol"', age: 45 },
      { name: '"Bob"', age: 27 },
      { name: '"Alice"', age: 34 },
    ]);
  });

  test('returns typed literals', async () => {
    const result = await db
      .select({ age: v.age, height: v.height, active: v.active, born: v.born })
      .where(
        triples(n.ex.alice, n.foaf.age, v.age),
        triples(n.ex.alice, n.ex.height, v.height),
        triples(n.ex.alice, n.ex.active, v.active),
        triples(n.ex.alice, n.ex.born, v.born)
      );
    expect(rows(result)).toEqual([
      { age: 34, height: 1.68, active: true, born: '"1990-04-12"^^xsd:date' },
    ]);
  });

  test('filters on numbers and language tags', async () => {
    const older = await db
      .select({ name: v.name })
      .where(
        triples(v.person, n.foaf.name, v.name),
        triples(v.person, n.foaf.age, v.age),
        filter(gt(v.age, 30))
      );
    expect(unorderedRows(older)).toEqual([{ name: '"Alice"' }, { name: '"Carol"' }]);

    const english = await db
      .select({ label: v.label })
      .where(triples(v.book, n.rdfs.label, v.label), filter(eq(lang(v.label), 'en')))
      .orderBy(asc(v.label));
    expect(rows(english)).toEqual([
      { label: '"Old Roads"@en' },
      { label: '"Rivers"@en' },
      { label: '"The Lighthouse"@en' },
    ]);
  });

  test('groups and aggregates', async () => {
    const result = await db
      .select({
        author: v.author,
        books: as(count(v.book), v.books),
        pages: as(sum(v.bookPages), v.pages),
      })
      .where(triples(v.book, n.ex.author, v.author), triples(v.book, n.ex.pages, v.bookPages))
      .groupBy(v.author)
      .orderBy(v.author);
    expect(rows(result)).toEqual([
      { author: 'ex:alice', books: 2, pages: 530 },
      { author: 'ex:bob', books: 1, pages: 210 },
      { author: 'ex:carol', books: 1, pages: 512 },
    ]);
  });

  test('counts solutions with $count', async () => {
    expect(await db.$count(triples(v.book, n.rdf.type, n.ex.Book))).toBe(3);
    expect(await db.$count(triples(v.book, n.ex.author, v.author), { distinct: v.author })).toBe(3);
  });

  test('joins inline VALUES', async () => {
    const result = await db
      .select({ person: v.person, name: v.name })
      .where(values({ person: [n.ex.bob, n.ex.dave] }), triples(v.person, n.foaf.name, v.name));
    expect(unorderedRows(result)).toEqual([
      { name: '"Bob"', person: 'ex:bob' },
      { name: '"Dave"', person: 'ex:dave' },
    ]);
  });

  test('evaluates UNION and MINUS', async () => {
    const named = await db
      .select({ thing: v.thing })
      .where(
        union(
          group(triples(v.thing, n.foaf.name, 'Alice')),
          group(triples(v.thing, n.rdfs.label, db.literal('Rivers', 'en')))
        )
      );
    expect(unorderedRows(named)).toEqual([{ thing: 'ex:alice' }, { thing: 'ex:book2' }]);

    const nonAuthors = await db
      .select({ person: v.person })
      .where(
        triples(v.person, n.rdf.type, n.foaf.Person),
        minus(triples(v.book, n.ex.author, v.person))
      );
    expect(unorderedRows(nonAuthors)).toEqual([{ person: 'ex:dave' }]);
  });

  test('follows property paths', async () => {
    const result = await db
      .select({ friend: v.friend })
      .where(triples(n.ex.alice, oneOrMore(n.foaf.knows), v.friend));
    const reachable = [{ friend: 'ex:bob' }, { friend: 'ex:carol' }, { friend: 'ex:dave' }];
    expect(unorderedRows(result)).toEqual(
      expectedOn(engine, reachable, {
        // Virtuoso returns a node once per path reaching it, not once per node.
        virtuoso: [
          { friend: 'ex:bob' },
          { friend: 'ex:carol' },
          { friend: 'ex:carol' },
          { friend: 'ex:dave' },
          { friend: 'ex:dave' },
        ],
      })
    );
  });

  test('decodes results with codecs', async () => {
    const decoding = SparqlDatabase.create({
      connection: engine.connection,
      managerConfig: prefixes,
      codecs: defaultCodecs({ integer: 'number', decimal: 'number' }),
    });
    const result = await decoding
      .select({ age: v.age, height: v.height, active: v.active })
      .where(
        triples(n.ex.bob, n.foaf.age, v.age),
        triples(n.ex.bob, n.ex.height, v.height),
        triples(n.ex.bob, n.ex.active, v.active)
      );
    expect(result).toEqual([{ age: 27, height: 1.82, active: false }]);
  });
});
