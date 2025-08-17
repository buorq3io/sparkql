import { agg } from './utils';
import { Wildcard } from 'sparqljs';
import { AggregateExpression, Expression } from '../generic';
import { transform_array, transform_number } from '../structures';

export function count(): AggregateExpression<number>;
export function count(expression: Expression): AggregateExpression<number>;

export function count(expression?: Expression) {
  return agg(expression ?? new Wildcard(), 'count', undefined, transform_number);
}

export function sum(expression: Expression): AggregateExpression<number> {
  return agg(expression, 'sum', undefined, transform_number);
}

export function avg(expression: Expression): AggregateExpression<number> {
  return agg(expression, 'avg', undefined, transform_number);
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
  return agg(expression, 'group_concat', separator, self => transform_array(self, separator));
}
