import { db, v } from '../index';
import { triple } from '../../src';

export default () => db.select().where(triple(v.s, v.p, v.o));
