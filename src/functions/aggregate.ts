import type {
  ExpressionAggregateDefaultInput,
  ExpressionAggregateOnWildcardInput,
  ExpressionInput,
} from '../helpers/types.js';
import { transformArray, transformNumber } from '../structures/index.js';
import { createAggregateExpression, createWildCardInput, distinct } from './utils.js';

/**
 * Counts solutions, or the bound values of an expression (`COUNT`).
 *
 * The result is a number. Without `groupBy`, the aggregate applies to the whole result.
 *
 *
 * @example
 * Count matching solutions for each person.
 *
 * ```ts
 * db.select({ person: v.person, result: as(count(), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( COUNT( * ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function count(): ExpressionAggregateOnWildcardInput<number>;
/**
 * Counts solutions, or the bound values of an expression (`COUNT`).
 *
 * See the first overload for details.
 *
 * @param expression - The expression whose bound values are counted.
 *
 *
 * @example
 * Count bound friend values for each person.
 *
 * ```ts
 * db.select({ person: v.person, result: as(count(v.friend), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( COUNT( ?friend ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function count(expression: ExpressionInput): ExpressionAggregateDefaultInput<number>;
export function count(expression?: ExpressionInput) {
  if (expression) {
    return createAggregateExpression('count', [expression], undefined, transformNumber);
  }
  return createAggregateExpression('count', [createWildCardInput()], undefined, transformNumber);
}

/**
 * Counts distinct solutions, or distinct bound values of an expression (`COUNT`).
 *
 * The result is a number. Without `groupBy`, the aggregate applies to the whole result.
 *
 *
 * @example
 * Count distinct solutions for each person.
 *
 * ```ts
 * db.select({ person: v.person, result: as(countDistinct(), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( COUNT( DISTINCT * ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function countDistinct(): ExpressionAggregateOnWildcardInput<number>;
/**
 * Counts distinct solutions, or distinct bound values of an expression (`COUNT`).
 *
 * See the first overload for details.
 *
 * @param expression - The expression whose bound values are counted.
 *
 *
 * @example
 * Count distinct friends for each person.
 *
 * ```ts
 * db.select({ person: v.person, result: as(countDistinct(v.friend), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( COUNT( DISTINCT ?friend ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function countDistinct(expression: ExpressionInput): ExpressionAggregateDefaultInput<number>;
export function countDistinct(expression?: ExpressionInput) {
  return distinct(expression ? count(expression) : count());
}

/**
 * Adds numeric values (`SUM`).
 *
 * The result is a number. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 *
 * @example
 * Sum the ages of each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(sum(v.age), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( SUM( ?age ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function sum(expression: ExpressionInput) {
  return createAggregateExpression('sum', [expression], undefined, transformNumber);
}

/**
 * Adds distinct numeric values (`SUM`).
 *
 * The result is a number. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 *
 * @example
 * Sum distinct ages of each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(sumDistinct(v.age), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( SUM( DISTINCT ?age ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function sumDistinct(expression: ExpressionInput) {
  return distinct(sum(expression));
}

/**
 * Computes the mean of numeric values (`AVG`).
 *
 * The result is a number. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 *
 * @example
 * Average the ages of each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(avg(v.age), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( AVG( ?age ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function avg(expression: ExpressionInput) {
  return createAggregateExpression('avg', [expression], undefined, transformNumber);
}

/**
 * Computes the mean of distinct numeric values (`AVG`).
 *
 * The result is a number. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 *
 * @example
 * Average distinct ages of each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(avgDistinct(v.age), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( AVG( DISTINCT ?age ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function avgDistinct(expression: ExpressionInput) {
  return distinct(avg(expression));
}

/**
 * Finds the smallest value (`MIN`).
 *
 * The result is typed `unknown`; at runtime it is an RDF/JS term, or the value a configured
 * codec decodes it to. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 *
 * @example
 * Find the youngest age among each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(min(v.age), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( MIN( ?age ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function min(expression: ExpressionInput) {
  return createAggregateExpression('min', [expression], undefined);
}

/**
 * Finds the largest value (`MAX`).
 *
 * The result is typed `unknown`; at runtime it is an RDF/JS term, or the value a configured
 * codec decodes it to. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 *
 * @example
 * Find the oldest age among each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(max(v.age), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( MAX( ?age ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function max(expression: ExpressionInput) {
  return createAggregateExpression('max', [expression], undefined);
}

/**
 * Chooses a value from the group (`SAMPLE`).
 *
 * The result is typed `unknown`; at runtime it is an RDF/JS term, or the value a configured
 * codec decodes it to. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 *
 * @example
 * Choose one age among each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(sample(v.age), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( SAMPLE( ?age ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function sample(expression: ExpressionInput) {
  return createAggregateExpression('sample', [expression], undefined);
}

/**
 * Concatenates values (`GROUP_CONCAT`).
 *
 * The result is an array of values split using the separator. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 * @param separator - The separator between values; defaults to the unit separator (`\u001f`).
 * An empty string omits the SPARQL `SEPARATOR` (the endpoint then joins with a space), but
 * the result is still split on the empty string, into single characters.
 *
 * @example
 * Collect the names of each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(groupConcat(v.name, ', '), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( GROUP_CONCAT( ?name ;SEPARATOR=", " ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function groupConcat(expression: ExpressionInput, separator: string = '\u001f') {
  return createAggregateExpression('group_concat', [expression], separator, self =>
    transformArray(self, separator)
  );
}

/**
 * Concatenates distinct values (`GROUP_CONCAT`).
 *
 * The result is an array of values split using the separator. Without `groupBy`, the aggregate applies to the whole result.
 *
 * @param expression - The values to aggregate.
 * @param separator - The separator between values; defaults to the unit separator (`\u001f`).
 * An empty string omits the SPARQL `SEPARATOR` (the endpoint then joins with a space), but
 * the result is still split on the empty string, into single characters.
 *
 * @example
 * Collect distinct names of each person’s friends.
 *
 * ```ts
 * db.select({ person: v.person, result: as(groupConcatDistinct(v.name, ', '), v.result) })
 *    .where(
 *      triples(v.person, n.foaf.knows, v.friend),
 *      triples(v.friend, n.foaf.name, v.name),
 *      triples(v.friend, n.foaf.age, v.age)
 *    )
 *    .groupBy(v.person);
 * ```
 *
 * ```sparql
 * SELECT ?person ( GROUP_CONCAT( DISTINCT ?name ;SEPARATOR=", " ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 *   ?friend foaf:name ?name .
 *   ?friend foaf:age ?age .
 * }
 * GROUP BY ?person
 * ```
 */
export function groupConcatDistinct(expression: ExpressionInput, separator: string = '\u001f') {
  return distinct(groupConcat(expression, separator));
}
