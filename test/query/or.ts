import { db, v } from '../index.js';
import { and, eq, filter, or, triple } from '../../src/index.js';

export default () =>
  db
    .select()
    .where(
      triple(v.a, v.b, v.c),
      filter(or(eq(v.a, 1), eq(v.a, 2), eq(v.a, 3), eq(v.a, 4))),
      filter(and(eq(v.a, 1), eq(v.a, 2), eq(v.a, 3), eq(v.a, 4))),
      filter(or(and(eq(v.a, 1), eq(v.a, 2)), and(eq(v.a, 3), eq(v.a, 4))))
    );
