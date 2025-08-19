import { triple } from '../../src';
import { db, v, n, b } from '../index';

export default () =>
  db.select().where(triple(v.s1, v.p1, b.__()), triple(b.__(), v.d1, v.f1), triple(v.v, v.s, b.b3));
