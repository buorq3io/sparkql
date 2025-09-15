import { op } from './utils.js';
import { Expression, OperationExpression } from '../generic.js';
import { transformBoolean, transformNumber } from '../structures/index.js';

export function eq(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('=', args, transformBoolean);
}

export function ne(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('!=', args, transformBoolean);
}

export function gt(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('>', args, transformBoolean);
}

export function gte(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('>=', args, transformBoolean);
}

export function lt(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('<', args, transformBoolean);
}

export function lte(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('<=', args, transformBoolean);
}

export function and(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('&&', [acc, current], transformBoolean),
    first
  ) as OperationExpression<boolean>;
}

export function or(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('||', [acc, current], transformBoolean),
    first
  ) as OperationExpression<boolean>;
}

export function add(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('+', [acc, current], transformNumber),
    first
  ) as OperationExpression<number>;
}

export function subs(...args: [Expression, Expression]): OperationExpression<number> {
  return op('-', args, transformNumber);
}

export function mul(
  ...args: [Expression, Expression, ...Expression[]]
): OperationExpression<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => op('*', [acc, current], transformNumber),
    first
  ) as OperationExpression<number>;
}

export function div(...args: [Expression, Expression]): OperationExpression<number> {
  return op('/', args, transformNumber);
}

export function not(...args: [Expression]): OperationExpression<boolean> {
  return op('!', args, transformBoolean);
}

export function uplus(...args: [Expression]): OperationExpression<number> {
  return op('uplus', args, transformNumber);
}

export function uminus(...args: [Expression]): OperationExpression<number> {
  return op('uminus', args, transformNumber);
}
