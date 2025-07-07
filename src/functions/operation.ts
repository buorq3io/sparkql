import {
  QueryReturnType,
  OperationExpression,
  ExpressionOrPrimitive,
} from '../generic';
import { op } from './utils';
import { transform_boolean, transform_number } from '../structures';

type E<T = QueryReturnType> = ExpressionOrPrimitive<T>;

export function eq(...args: [E, E]): OperationExpression<boolean> {
  return op('=', args, transform_boolean);
}

export function ne(...args: [E, E]): OperationExpression<boolean> {
  return op('!=', args, transform_boolean);
}

export function gt(...args: [E, E]): OperationExpression<boolean> {
  return op('>', args, transform_boolean);
}

export function gte(...args: [E, E]): OperationExpression<boolean> {
  return op('>=', args, transform_boolean);
}

export function lt(...args: [E, E]): OperationExpression<boolean> {
  return op('<', args, transform_boolean);
}

export function lte(...args: [E, E]): OperationExpression<boolean> {
  return op('<=', args, transform_boolean);
}

export function and(...args: [E, E]): OperationExpression<boolean> {
  return op('&&', args, transform_boolean);
}

export function or(...args: [E, E]): OperationExpression<boolean> {
  return op('||', args, transform_boolean);
}

export function add(...args: [E, E]): OperationExpression<number> {
  return op('+', args, transform_number);
}

export function subs(...args: [E, E]): OperationExpression<number> {
  return op('-', args, transform_number);
}

export function mul(...args: [E, E]): OperationExpression<number> {
  return op('*', args, transform_number);
}

export function div(...args: [E, E]): OperationExpression<number> {
  return op('/', args, transform_number);
}

export function not(...args: [E]): OperationExpression<boolean> {
  return op('!', args, transform_boolean);
}

export function uplus(...args: [E]): OperationExpression<number> {
  return op('uplus', args, transform_number);
}

export function uminus(...args: [E]): OperationExpression<number> {
  return op('uminus', args, transform_number);
}
