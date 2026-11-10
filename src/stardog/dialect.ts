import { defineDialect, sparql11Dialect } from '../database/dialect.js';
import { stardogHints } from './hints.js';
import { stardogQueries } from './paths.js';

export const stardogDialect = {
  ...defineDialect<never, never, typeof stardogQueries>({
    ...sparql11Dialect,
    queries: stardogQueries,
  }),
  hints: stardogHints,
};
