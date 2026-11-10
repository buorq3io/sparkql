import { createFunctionCallExpression, createOperationExpression } from '../functions/utils.js';
import type {
  ExpressionFunctionCallInput,
  ExpressionInput,
  ExpressionOperationInput,
  TermLiteralOutput,
} from '../helpers/types.js';
import { transformNumber } from '../structures/expression.js';

/**
 * Returns the remainder of dividing one number by another (ARQ `MOD`).
 *
 * @param left - The dividend.
 * @param right - The divisor.
 *
 * @example
 * Find people whose age is an even number.
 *
 * ```ts
 * import { SparqlDatabase, eq, filter, mod, triples } from 'sparkql/arq';
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(eq(mod(v.age, 2), 0))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   ?person foaf:age ?age .
 *   FILTER ( ( MOD( ?age , "2"^^<http://www.w3.org/2001/XMLSchema#integer> ) = "0"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function mod(
  left: ExpressionInput,
  right: ExpressionInput
): ExpressionOperationInput<number> {
  return createOperationExpression('mod', [left, right], transformNumber);
}

/**
 * Returns the integer quotient of a division, truncated toward zero (ARQ `IDIV`).
 *
 * @param left - The dividend.
 * @param right - The divisor.
 *
 * @example
 * Group people by decade of age (36 becomes 3).
 *
 * ```ts
 * import { SparqlDatabase, as, idiv, triples } from 'sparkql/arq';
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 * db.select({ name: v.name, decade: as(idiv(v.age, 10), v.decade) }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   triples(v.person, n.foaf.age, v.age)
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name ( IDIV( ?age , "10"^^<http://www.w3.org/2001/XMLSchema#integer> ) AS ?decade ) WHERE {
 *   ?person foaf:name ?name .
 *   ?person foaf:age ?age .
 * }
 * ```
 */
export function idiv(
  left: ExpressionInput,
  right: ExpressionInput
): ExpressionOperationInput<number> {
  return createOperationExpression('idiv', [left, right], transformNumber);
}

/**
 * Builds a locale-specific sorting key for use in `ORDER BY`.
 *
 * @param locale - A BCP 47 language tag such as `'fi'` or `'de-DE'`.
 * @param expression - The string to sort by.
 *
 * @example
 * Sort names in Finnish alphabetical order, where Ä and Ö come after Z.
 *
 * ```ts
 * import { SparqlDatabase, collation, triples } from 'sparkql/arq';
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 * db.select({ name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name))
 *   .orderBy(collation('fi', v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ORDER BY ASC ( <http://jena.apache.org/ARQ/function#collation> ( "fi" , ?name ) )
 * ```
 */
export function collation(
  locale: ExpressionInput,
  expression: ExpressionInput
): ExpressionFunctionCallInput<TermLiteralOutput> {
  return createFunctionCallExpression(new URL('http://jena.apache.org/ARQ/function#collation'), [
    locale,
    expression,
  ]);
}
