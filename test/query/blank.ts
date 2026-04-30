import { triples } from '../../src/index.js';
import { db, v, b } from '../index.js';

export default () =>
  db.select().where(triples(v.s1, v.p1, b.__()), triples(b.__(), v.d1, v.f1), triples(v.v, v.s, b.b3));
