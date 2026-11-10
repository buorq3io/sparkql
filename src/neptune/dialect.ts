import type * as AST from '@traqula/rules-sparql-1-1';
import { defineDialect, type SparqlDialect, sparql11Dialect } from '../database/dialect.js';
import { triples } from '../structures/expression.js';
import {
  isNeptuneHint,
  type NeptuneHintAST,
  type NeptuneHintInput,
  neptuneHintIri,
  neptuneHints,
} from './hints.js';

/**
 * The Amazon Neptune dialect: standard SPARQL 1.1 plus the {@link queryHint} pattern.
 *
 * Hints normalize to ordinary triple patterns, so the standard generator prints them.
 * `SparqlDatabase.create` from `sparkql/neptune` applies it for you.
 */
export const neptuneDialect: SparqlDialect<NeptuneHintInput, NeptuneHintAST> & {
  /** Neptune query hint helpers. */
  readonly hints: typeof neptuneHints;
} = {
  ...defineDialect<NeptuneHintInput, NeptuneHintAST>({
    patterns: {
      is: isNeptuneHint,
      normalize: (hint, context) =>
        context.pattern(
          triples(neptuneHintIri(hint.scope), neptuneHintIri(hint.name), hint.value)
        ) as AST.PatternBgp,
    },
    generator: sparql11Dialect.generator,
  }),
  hints: neptuneHints,
};
