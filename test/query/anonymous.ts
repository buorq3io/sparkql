import { triples } from '../../src';
import { db, v, n, b } from '../index';

export default () =>
  db
    .base('ex:')
    .select()
    .where(...triples(v.s3, v.p3, [[db.iri('a3'), db.iri('b3')]]));
