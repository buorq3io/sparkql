import { defineDialect, sparql11Dialect } from '../database/dialect.js';
import { isQleverPattern, type QleverAST, type QleverPatternInput } from './types.js';

/**
 * The QLever dialect: standard SPARQL 1.1 plus the text search ({@link containsWord},
 * {@link containsEntity}, {@link textSearch}), {@link pathSearch}, {@link spatialSearch} and
 * {@link rowNumber} patterns.
 *
 * Each pattern normalizes to the triples or `SERVICE` block QLever reads, so the standard
 * generator prints them. The {@link geof} and {@link ql} functions are standard SPARQL and need
 * no dialect support. `SparqlDatabase.create` from `sparkql/qlever` applies it for you.
 */
export const qleverDialect = defineDialect<QleverPatternInput, QleverAST>({
  patterns: {
    is: isQleverPattern,
    normalize: (value, context) => {
      const pattern = context.pattern(value.expansion) as QleverAST;
      if (value.check && pattern.subType === 'service') value.check(pattern);
      return pattern;
    },
  },
  generator: sparql11Dialect.generator,
});
