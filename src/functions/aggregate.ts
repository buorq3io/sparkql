import {
  ExpressionInput,
  ExpressionAggregateDefaultInput,
  ExpressionAggregateOnWildcardInput,
} from '../helpers/types.js';
import { transformArray, transformNumber } from '../structures/index.js';
import { createAggregateExpression, createWildCardInput, distinct } from './utils.js';

export function count(): ExpressionAggregateOnWildcardInput<number>;
export function count(expression: ExpressionInput): ExpressionAggregateDefaultInput<number>;
export function count(expression?: ExpressionInput) {
  return createAggregateExpression(
    'count',
    [expression ? expression : createWildCardInput()],
    undefined,
    transformNumber
  );
}

export function countDistinct(): AggregateExpression<number>;
export function countDistinct(expression: ExpressionInput): AggregateExpression<number>;
export function countDistinct(expression?: ExpressionInput) {
  return distinct(expression ? count(expression) : count());
}

export function sum(expression: ExpressionInput) {
  return createAggregateExpression('sum', [expression], undefined, transformNumber);
}

export function sumDistinct(expression: ExpressionInput) {
  return distinct(sum(expression));
}

export function avg(expression: ExpressionInput) {
  return createAggregateExpression('avg', [expression], undefined, transformNumber);
}

export function avgDistinct(expression: ExpressionInput) {
  return distinct(avg(expression));
}

export function min(expression: ExpressionInput) {
  return createAggregateExpression('min', [expression], undefined);
}

export function max(expression: ExpressionInput) {
  return createAggregateExpression('max', [expression], undefined);
}

export function sample(expression: ExpressionInput) {
  return createAggregateExpression('sample', [expression], undefined);
}

export function groupConcat(expression: ExpressionInput, separator: string = '\u001f') {
  return createAggregateExpression('group_concat', [expression], separator, self =>
    transformArray(self, separator)
  );
}

export function groupConcatDistinct(expression: ExpressionInput, separator: string = '\u001f') {
  return distinct(groupConcat(expression, separator));
}
