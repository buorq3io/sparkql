import { db, v } from '../index.js';
import { triple } from '../../src/index.js';

export default () => db.select().where(triple(v.s, v.p, v.o));
