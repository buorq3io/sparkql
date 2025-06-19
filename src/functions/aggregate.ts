import { agg } from './utils';
import { Wildcard } from 'sparqljs';
import { AggregateExpression, ExpressionOrPrimitive } from '../struct';

export function count(): AggregateExpression;
export function count(expression: ExpressionOrPrimitive): AggregateExpression;
export function count(expression?: ExpressionOrPrimitive) {
  return agg(expression ?? new Wildcard(), 'count');
}

export function sum(expression: ExpressionOrPrimitive) {
  return agg(expression, 'sum');
}

export function avg(expression: ExpressionOrPrimitive) {
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
) {
  return agg(expression, 'group_concat', separator);
}
