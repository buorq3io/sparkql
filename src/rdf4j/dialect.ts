import type * as AST from '@traqula/rules-sparql-1-1';
import { defineDialect, sparql11Dialect } from '../database/dialect.js';
import { rdf4jQueries } from './explain.js';
import { isTextSearch, type TextSearchInput, textSearchTriples } from './search.js';

/**
 * The Eclipse RDF4J dialect: standard SPARQL 1.1 plus the {@link textSearch} pattern and the
 * `db.explain()` method.
 *
 * Searches normalize to ordinary triple patterns, so the standard generator prints them. The
 * GeoSPARQL functions ({@link geof}) and {@link rdf4jNil} are standard SPARQL and need no
 * dialect support. `SparqlDatabase.create` from `sparkql/rdf4j` applies it for you.
 */
export const rdf4jDialect = defineDialect<TextSearchInput, AST.PatternBgp, typeof rdf4jQueries>({
  patterns: {
    is: isTextSearch,
    normalize: (search, context) => context.pattern(textSearchTriples(search)) as AST.PatternBgp,
  },
  generator: sparql11Dialect.generator,
  queries: rdf4jQueries,
});
