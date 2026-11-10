import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { expect, expectTypeOf, test, vi } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../src/arq/index.js';
import { SparqlDatabase, type SparqlSession, sparql, triples, xsd } from '../src/index.js';
import { SparqlDatabase as StardogDatabase } from '../src/stardog/index.js';

const rdf = new DataFactory();
const bindings = vi.fn(async () => [{ count: rdf.literal('42', rdf.namedNode(xsd.integer)) }]);
const session: SparqlSession = {
  bindings,
  boolean: async () => true,
  quads: async () => [],
  update: async () => {},
  raw: async () => new Response(),
};

test('$count generates COUNT(*) and decodes an integer to number in every dialect', async () => {
  const databases: SparqlDatabase<{}, 'g_', {}, any>[] = [
    SparqlDatabase.create({ session }),
    ArqDatabase.create({ session }),
    StardogDatabase.create({ session }),
  ];
  for (const db of databases) {
    const query = db.$count(
      triples(db.variable('s'), db.iri('https://example.org/p'), db.variable('o'))
    );
    expect(query.toSPARQL()).toContain('COUNT( * ) AS ?count');
    expect(query.toSPARQL()).toContain('?s <https://example.org/p> ?o');
    expect(() => new Parser().parse(query.toSPARQL())).not.toThrow();
    const result = await query;
    expectTypeOf(result).toEqualTypeOf<number>();
    expect(result).toBe(42);
  }
});

test('$count supports a distinct variable, empty patterns and prepared patterns', async () => {
  const db = SparqlDatabase.create({ session });
  const s = db.variable('s');
  const query = db.$count(triples(s, db.iri('https://example.org/p'), db.variable('o')), {
    distinct: s,
  });
  expect(query.toSPARQL()).toContain('COUNT( DISTINCT ?s ) AS ?count');
  expect(() => new Parser().parse(db.$count().toSPARQL())).not.toThrow();
  const prepared = db
    .$count(triples(s, db.iri('https://example.org/p'), sparql.placeholder('value')))
    .prepare();
  expect(await prepared.execute({ value: 'Ada' })).toBe(42);
  expect(prepared.toSPARQL({ value: 'Ada' })).toContain('"Ada"');
});

test('$count rejects execution without a session', async () => {
  await expect(SparqlDatabase.create().$count()).rejects.toThrow('build-only');
});
