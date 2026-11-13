import { defineDialect, sparql11Dialect } from '../database/dialect.js';
import { graphdbQueries } from './explain.js';

/**
 * The Ontotext GraphDB dialect: standard SPARQL 1.1 plus the `db.explain()` and `db.measure()`
 * methods.
 *
 * GraphDB's pseudo-graphs ({@link ontoGraphs}, {@link historyAt}) and `ofn:` functions
 * ({@link ofn}) are standard SPARQL and need no dialect support. `SparqlDatabase.create` from
 * `sparkql/graphdb` applies it for you.
 */
export const graphdbDialect = defineDialect<never, never, typeof graphdbQueries>({
  ...sparql11Dialect,
  queries: graphdbQueries,
});
