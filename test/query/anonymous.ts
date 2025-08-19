import { triples } from '../../src/index.js';
import { db, v } from '../index.js';

export default () =>
  db
    .base('ex:')
    .select()
    .where(...triples(v.s3, v.p3, [[db.iri('a3'), db.iri('b3')]]));
