import { triples } from '../../src/index.js';
import { db, v, n } from '../index.js';

export default () =>
  db
    .base('ex:')
    .select()
    .where(...triples(v.s3, v.p3, [n.__.a3, n.__.b3]));
