import { expectTypeOf } from 'vitest';
import type { RootQueryBuilderBaseWithout } from '../../src/database/query.js';
import type { SelectQueryBuilderBase } from '../../src/database/select.js';
import {
  type InferredSelectResult,
  type SelectedVariables,
  SparqlDatabase,
  triples,
} from '../../src/index.js';

const db = SparqlDatabase.create();
const [v] = db.createManagers([], {});
const pattern = triples(v.s, v.p, v.o);

// A fresh query hides the solution modifiers until WHERE is given.
const root = db.select();
expectTypeOf<typeof root>().toEqualTypeOf<
  RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<SelectedVariables>>>
>();
for (const key of ['values', 'limit', 'offset', 'orderBy', 'having', 'groupBy'] as const) {
  expectTypeOf(root).not.toHaveProperty(key);
}
expectTypeOf(root).toHaveProperty('where');
expectTypeOf(root).toHaveProperty('from');

// Each clause can be used once, and only in SPARQL's order.
const where = root.where(pattern);
expectTypeOf(where).not.toHaveProperty('where');
expectTypeOf(where).not.toHaveProperty('from');
expectTypeOf(where).not.toHaveProperty('fromNamed');
expectTypeOf(where).toHaveProperty('limit');
expectTypeOf(where).toHaveProperty('groupBy');
const limited = where.limit(1);
expectTypeOf(limited).not.toHaveProperty('limit');
expectTypeOf(limited).not.toHaveProperty('groupBy');
expectTypeOf(limited).toHaveProperty('offset');
// @ts-expect-error WHERE cannot be given twice.
where.where(pattern);
// @ts-expect-error LIMIT cannot follow LIMIT.
limited.limit(2);
// @ts-expect-error A fresh query has no LIMIT yet.
root.limit(1);

// `$dynamic()` exposes every clause method, in any order, for the rest of the chain.
const clauses = ['where', 'from', 'values', 'limit', 'offset', 'orderBy', 'groupBy'] as const;
const dynamic = db.select({ s: v.s }).$dynamic();
const repeated = dynamic.limit(1).where(pattern).where(pattern).groupBy(v.s).limit(2).offset(1);
for (const key of clauses) {
  expectTypeOf(dynamic).toHaveProperty(key);
  expectTypeOf(repeated).toHaveProperty(key);
}
expectTypeOf<Awaited<typeof repeated>>().toEqualTypeOf<Awaited<typeof dynamic>>();
const fixed = db.select({ s: v.s }).where(pattern).limit(1);
expectTypeOf<Awaited<typeof dynamic>>().toEqualTypeOf<Awaited<typeof fixed>>();
db.ask().$dynamic().limit(1).where(pattern).offset(1).offset(2);

// Restrictions apply to ASK, CONSTRUCT and DESCRIBE too.
const ask = db.ask();
expectTypeOf(ask).not.toHaveProperty('limit');
expectTypeOf(ask.where(pattern)).not.toHaveProperty('where');
expectTypeOf<Awaited<typeof ask>>().toEqualTypeOf<boolean>();
