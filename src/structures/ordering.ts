import type { ExpressionInput, OrderingInput } from '../helpers/types.js';

/**
 * Creates an ascending `ORDER BY` expression.
 *
 * @param expression - Expression to sort by.
 *
 * @example
 * List names alphabetically.
 *
 * ```ts
 * const ordering = asc(v.name);
 * db.select({ name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name))
 *   .orderBy(ordering);
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ORDER BY ASC ( ?name )
 * ```
 */
export function asc(expression: ExpressionInput): OrderingInput {
  return {
    descending: false,
    expression: expression,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

/**
 * Creates a descending `ORDER BY` expression.
 *
 * @param expression - Expression to sort by.
 *
 * @example
 * List names in reverse alphabetical order.
 *
 * ```ts
 * const ordering = desc(v.name);
 * db.select({ name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name))
 *   .orderBy(ordering);
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ORDER BY DESC ( ?name )
 * ```
 */
export function desc(expression: ExpressionInput): OrderingInput {
  return {
    descending: true,
    expression: expression,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}
