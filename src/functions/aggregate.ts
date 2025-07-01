import { agg } from './utils';
import { Wildcard } from 'sparqljs';
import { AggregateExpression, ExpressionOrPrimitive } from '../generic';

export function count(): AggregateExpression<number>;
export function count(
  expression: ExpressionOrPrimitive
): AggregateExpression<number>;

export function count(expression?: ExpressionOrPrimitive) {
  return agg(expression ?? new Wildcard(), 'count');
}

export function sum(
  expression: ExpressionOrPrimitive
): AggregateExpression<number> {
  return agg(expression, 'sum');
}

export function avg(
  expression: ExpressionOrPrimitive
): AggregateExpression<number> {
  return agg(expression, 'avg');
}

export function min(expression: ExpressionOrPrimitive) {
  return agg(expression, 'min');
}

export function max(expression: ExpressionOrPrimitive) {
  return agg(expression, 'max');
}

export function sample(expression: ExpressionOrPrimitive) {
  return agg(expression, 'sample');
}

export function groupConcat(
  expression: ExpressionOrPrimitive,
  separator: string = '\u001f'
): AggregateExpression<string> {
  return agg(expression, 'group_concat', separator);
}
