import type { MergePlaceholders, PlaceholderCarrier } from '../database/prepared.js';
import type { ExpressionInput, ExpressionOperationInput } from '../helpers/types.js';
import { transformBoolean, transformNumber } from '../structures/index.js';
import { createOperationExpression } from './utils.js';

export function eq<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function eq(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('=', args, transformBoolean);
}

export function ne<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function ne(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('!=', args, transformBoolean);
}

export function gt<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function gt(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('>', args, transformBoolean);
}

export function gte<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function gte(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('>=', args, transformBoolean);
}

export function lt<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function lt(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('<', args, transformBoolean);
}

export function lte<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function lte(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('<=', args, transformBoolean);
}

export function and<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function and(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('&&', [acc, current], transformBoolean),
    first
  ) as ExpressionOperationInput<boolean>;
}

export function or<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function or(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('||', [acc, current], transformBoolean),
    first
  ) as ExpressionOperationInput<boolean>;
}

export function add<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function add(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('+', [acc, current], transformNumber),
    first
  ) as ExpressionOperationInput<number>;
}

export function subs<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function subs(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<number> {
  return createOperationExpression('-', args, transformNumber);
}

export function mul<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function mul(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('*', [acc, current], transformNumber),
    first
  ) as ExpressionOperationInput<number>;
}

export function div<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function div(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('/', args, transformNumber);
}

export function not<A extends [ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function not(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('!', args, transformBoolean);
}

export function uplus<A extends [ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function uplus(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('uplus', args, transformNumber);
}

export function uminus<A extends [ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function uminus(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('uminus', args, transformNumber);
}
