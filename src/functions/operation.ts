import { createOperationExpression } from './utils.js';
import { transformBoolean, transformNumber } from '../structures/index.js';
import { ExpressionInput, ExpressionOperationInput } from '../helpers/types.js';

export function eq(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('=', args, transformBoolean);
}

export function ne(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('!=', args, transformBoolean);
}

export function gt(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('>', args, transformBoolean);
}

export function gte(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('>=', args, transformBoolean);
}

export function lt(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('<', args, transformBoolean);
}

export function lte(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('<=', args, transformBoolean);
}

export function and(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('&&', [acc, current], transformBoolean),
    first
  ) as ExpressionOperationInput<boolean>;
}

export function or(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('||', [acc, current], transformBoolean),
    first
  ) as ExpressionOperationInput<boolean>;
}

export function add(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('+', [acc, current], transformNumber),
    first
  ) as ExpressionOperationInput<number>;
}

export function subs(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<number> {
  return createOperationExpression('-', args, transformNumber);
}

export function mul(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('*', [acc, current], transformNumber),
    first
  ) as ExpressionOperationInput<number>;
}

export function div(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('/', args, transformNumber);
}

export function not(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('!', args, transformBoolean);
}

export function uplus(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('uplus', args, transformNumber);
}

export function uminus(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('uminus', args, transformNumber);
}
