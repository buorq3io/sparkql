import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { expect, expectTypeOf, test } from 'vitest';
import {
  as,
  castNumber,
  count,
  maybe,
  SparqlDatabase,
  type SparqlSession,
  sparql,
  triples,
  xsd,
} from '../src/index.js';

const rdf = new DataFactory();
const session: SparqlSession = {
  bindings: async () => [{ amount: rdf.literal('42', rdf.namedNode(xsd.integer)) }],
  boolean: async () => true,
  quads: async () => [],
  update: async () => {},
  raw: async () => new Response(),
};

test('typed subqueries preserve projected transforms and optional presence', async () => {
  const db = SparqlDatabase.create({ session });
  const amount = db.variable('amount');
  const sub = db
    .select({ price: castNumber(amount), absent: maybe(castNumber(db.variable('missing'))) })
    .where(triples(db.variable('s'), db.iri('https://example.org/price'), amount))
    .as();
  const query = db.select({ price: sub.price, absent: sub.absent }).where(sub);
  const result = await query;
  expectTypeOf(result).toEqualTypeOf<{ price: number; absent: number | undefined }[]>();
  expect(result).toEqual([{ price: 42, absent: undefined }]);
  expect(sub.price.value).toBe('amount');
  expect(() => new Parser().parse(query.toSPARQL())).not.toThrow();
});

test('projected expressions become variable references in the outer SELECT', async () => {
  const db = SparqlDatabase.create({ session });
  const sub = db.select({ total: as(count(), db.variable('amount')) }).as();
  const query = db.select({ total: sub.total }).where(sub);
  expect(query.toSPARQL().match(/COUNT/g)).toHaveLength(1);
  expect(() => new Parser().parse(query.toSPARQL())).not.toThrow();
  expect(await query).toEqual([{ total: 42 }]);
  expectTypeOf(await query).toEqualTypeOf<{ total: number }[]>();
});

test('pattern member collisions are reported, while fields can be retrieved separately', () => {
  const db = SparqlDatabase.create();
  for (const key of ['type', 'patterns', 'loc', 'then', '__proto__']) {
    const query = db.select({ [key]: db.variable('s') });
    expect(() => query.as()).toThrow('Subquery field conflicts');
    expect(query.getSelectedFields()[key].value).toBe('s');
    expect(() => new Parser().parse(db.ask().where(query.$asSubQuery()).toSPARQL())).not.toThrow();
  }
});

test('subqueries retain prepared placeholder types and support nesting', async () => {
  const db = SparqlDatabase.create({ session });
  const amount = castNumber(db.variable('amount'));
  const sub = db
    .select({ amount })
    .where(
      triples(
        db.variable('amount'),
        db.iri('https://example.org/p'),
        sparql.placeholder<'name', string>('name')
      )
    )
    .as();
  const nested = db.select({ amount: sub.amount }).where(sub).as();
  const prepared = db.select({ amount: nested.amount }).where(nested).prepare();
  expectTypeOf(prepared.execute).parameter(0).toEqualTypeOf<{ name: string }>();
  expect(await prepared.execute({ name: 'Ada' })).toEqual([{ amount: 42 }]);
  expect(() => new Parser().parse(prepared.toSPARQL({ name: 'Ada' }))).not.toThrow();
});
