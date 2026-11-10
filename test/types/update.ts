import { expectTypeOf } from 'vitest';
import { SparqlDatabase, triples } from '../../src/index.js';

const db = SparqlDatabase.create();
const [v] = db.createManagers([], {});
const pattern = triples(v.s, v.p, v.o);
const graph = db.iri('http://example.org/graph');

// A modify operation takes each template and WHERE once, in SPARQL's order.
const inserted = db.with(graph).insert(pattern);
expectTypeOf(inserted).not.toHaveProperty('insert');
expectTypeOf(inserted).not.toHaveProperty('delete');
expectTypeOf(inserted).toHaveProperty('where');
const matched = inserted.where(pattern);
expectTypeOf(matched).not.toHaveProperty('where');
// @ts-expect-error WHERE cannot be given twice.
matched.where(pattern);

// `$dynamic()` exposes every clause method, in any order, for the rest of the chain.
const clauses = ['delete', 'insert', 'using', 'usingNamed', 'where'] as const;
const dynamic = db.with(graph).$dynamic();
const repeated = dynamic
  .where(pattern)
  .insert(pattern)
  .insert(pattern)
  .using(graph)
  .delete(pattern)
  .where(pattern);
for (const key of clauses) {
  expectTypeOf(dynamic).toHaveProperty(key);
  expectTypeOf(repeated).toHaveProperty(key);
}
db.insert(pattern).$dynamic().where(pattern).where(pattern).insert(pattern).delete(pattern);
db.delete(pattern).$dynamic().usingNamed(graph).delete(pattern).insert(pattern);
