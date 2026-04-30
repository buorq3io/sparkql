import { db, v } from '../index.js';
import { triples } from '../../src/index.js';

export default () => db.select().where(triples(v.s, v.p, v.o));
