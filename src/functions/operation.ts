import { op } from './utils.js';
import { Expression, OperationExpression } from '../generic.js';
import { transform_boolean, transform_number } from '../structures/index.js';

export function eq(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('=', args, transform_boolean);
}

export function ne(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('!=', args, transform_boolean);
}

export function gt(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('>', args, transform_boolean);
}

export function gte(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('>=', args, transform_boolean);
}

export function lt(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('<', args, transform_boolean);
}

export function lte(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('<=', args, transform_boolean);
}

export function and(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('&&', [acc, current], transform_boolean),
    first
  ) as OperationExpression<boolean>;
}

export function or(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('||', [acc, current], transform_boolean),
    first
  ) as OperationExpression<boolean>;
}

export function add(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('+', [acc, current], transform_number),
    first
  ) as OperationExpression<number>;
}

export function subs(...args: [Expression, Expression]): OperationExpression<number> {
  return op('-', args, transform_number);
}

export function mul(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('*', [acc, current], transform_number),
    first
  ) as OperationExpression<number>;
}

export function div(...args: [Expression, Expression]): OperationExpression<number> {
  return op('/', args, transform_number);
}

export function not(...args: [Expression]): OperationExpression<boolean> {
  return op('!', args, transform_boolean);
}

export function uplus(...args: [Expression]): OperationExpression<number> {
  return op('uplus', args, transform_number);
}

export function uminus(...args: [Expression]): OperationExpression<number> {
  return op('uminus', args, transform_number);
}
