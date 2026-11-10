import { defineDialect, sparql11Dialect } from '../database/dialect.js';
import { stardogHints } from './hints.js';
import { stardogQueries } from './paths.js';

/**
 * The Stardog dialect: standard SPARQL 1.1 patterns plus the `db.paths()` method and the
 * {@link pragma} query hint helper.
 *
 * `SparqlDatabase.create` from `sparkql/stardog` applies it for you.
 */
export const stardogDialect = {
  ...defineDialect<never, never, typeof stardogQueries>({
    ...sparql11Dialect,
    queries: stardogQueries,
  }),
  hints: stardogHints,
};
