import SparqlJs from 'sparqljs';
import { agg, distinct } from './utils.js';
import { AggregateExpression, Expression } from '../generic.js';
import { transformArray, transformNumber } from '../structures/index.js';

export function count(): AggregateExpression<number>;
export function count(expression: Expression): AggregateExpression<number>;
export function count(expression?: Expression) {
  return agg(expression ?? new SparqlJs.Wildcard(), 'count', undefined, transformNumber);
}

export function countDistinct(): AggregateExpression<number>;
export function countDistinct(expression: Expression): AggregateExpression<number>;
export function countDistinct(expression?: Expression) {
  return distinct(expression ? count(expression) : count());
}

export function sum(expression: Expression): AggregateExpression<number> {
  return agg(expression, 'sum', undefined, transformNumber);
}

export function sumDistinct(expression: Expression): AggregateExpression<number> {
  return distinct(sum(expression));
}

export function avg(expression: Expression): AggregateExpression<number> {
  return agg(expression, 'avg', undefined, transformNumber);
}

export function avgDistinct(expression: Expression): AggregateExpression<number> {
  return distinct(avg(expression));
}

export function min(expression: Expression) {
  return agg(expression, 'min');
}

export function max(expression: Expression) {
  return agg(expression, 'max');
}

export function sample(expression: Expression) {
  return agg(expression, 'sample');
}

export function groupConcat(
  expression: Expression,
  separator: string = '\u001f'
): AggregateExpression<string[]> {
  return agg(expression, 'group_concat', separator, self => transformArray(self, separator));
}

export function groupConcatDistinct(
  expression: Expression,
  separator: string = '\u001f'
): AggregateExpression<string[]> {
  return distinct(groupConcat(expression, separator));
}
