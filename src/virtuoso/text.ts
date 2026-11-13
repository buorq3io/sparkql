import type * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';
import type { TextContainsInput } from './types.js';

/** Options of {@link textContains}. */
export interface TextContainsOptions {
  /** Variable that receives the score of each match (`OPTION (score ?score)`). */
  readonly score?: AST.TermVariable;
}

const loc = { sourceLocationType: 'autoGenerate' } as const;

/**
 * Matches literals against a Virtuoso full-text expression with the `bif:contains` predicate.
 *
 * Prints `?text bif:contains "query"`, followed by `OPTION (score ?score)` when a score variable
 * is given. `text` must be bound to the literals by another pattern, and the literals must be in
 * Virtuoso's full-text index, so set the index up first (for example with
 * `DB.DBA.RDF_OBJ_FT_RULE_ADD`). The query uses Virtuoso's text syntax: put words and phrases
 * that contain spaces or other non-alphanumeric characters in double quotes, as in
 * `'"New York" AND city'`, and add `*` after a word prefix, as in `'rich*'`. Only databases
 * created from `sparkql/virtuoso` accept it. See
 * [Full-text search](https://docs.openlinksw.com/virtuoso/sparqlextensions/).
 *
 * @param text - Variable bound to the literals to search.
 * @param query - Virtuoso text expression.
 * @param options - The score variable, if wanted.
 * @throws {@link SparkqlError} When `query` is empty or not a string.
 *
 * @example
 * Find the ten people whose names best match "Ada".
 *
 * ```ts
 * import { desc, SparqlDatabase, textContains, triples } from 'sparkql/virtuoso';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const people = db
 *   .select({ person: v.person, name: v.name })
 *   .where(
 *     triples(v.person, n.foaf.name, v.name),
 *     textContains(v.name, '"Ada*"', { score: v.score })
 *   )
 *   .orderBy(desc(v.score))
 *   .limit(10);
 * ```
 *
 * ```sparql
 * SELECT ?person ?name WHERE {
 *   ?person foaf:name ?name .
 *   ?name bif:contains "\"Ada*\"" OPTION (score ?score) .
 * }
 * ORDER BY DESC ( ?score )
 * LIMIT 10
 * ```
 */
export function textContains(
  text: AST.TermVariable,
  query: string,
  options: TextContainsOptions = {}
): TextContainsInput {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new SparkqlError({ message: 'A Virtuoso text query must be a non-empty string.' });
  }
  return {
    type: 'pattern',
    subType: 'virtuosoTextContains',
    loc,
    text,
    query,
    ...(options.score ? { score: options.score } : {}),
  };
}
