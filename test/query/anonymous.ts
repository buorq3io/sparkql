import { triples } from '../../src/index.js';
import { db, v, n } from '../index.js';

export default () =>
  db
    .select()
    .base('ex:')
    .where(triples(v.s3, v.p3, [n.__.a3, n.__.b3]));
