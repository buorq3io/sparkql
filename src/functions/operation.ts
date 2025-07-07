import { op } from './utils';
import {
  PatternOrTriple,
  OperationExpression,
  ExpressionOrPrimitive,
} from '../generic';
import { transform_boolean, transform_number } from '../structures';

type P = PatternOrTriple;
type E = ExpressionOrPrimitive;

export function eq<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('=', args, transform_boolean);
}

export function ne<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('!=', args, transform_boolean);
}

export function gt<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('>', args, transform_boolean);
}

export function gte<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('>=', args, transform_boolean);
}

export function lt<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('<', args, transform_boolean);
}

export function lte<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('<=', args, transform_boolean);
}

export function and<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('&&', args, transform_boolean);
}

export function or<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('||', args, transform_boolean);
}

export function add<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('+', args, transform_number);
}

export function subs<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('-', args, transform_number);
}

export function mul<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('*', args, transform_number);
}

export function div<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('/', args, transform_number);
}

export function not<T extends E>(...args: [T]): OperationExpression<boolean> {
  return op('!', args, transform_boolean);
}

export function uplus<T extends E>(...args: [T]): OperationExpression<number> {
  return op('uplus', args, transform_number);
}

export function uminus<T extends E>(...args: [T]): OperationExpression<number> {
  return op('uminus', args, transform_number);
}

export function inArray<K extends E>(...args: [K, E[]]): OperationExpression<boolean> {
  return op('in', args, transform_boolean);
}

export function notinArray<K extends E>(...args: [K, E[]]): OperationExpression<boolean> {
  return op('notin', args, transform_boolean);
}

export function exists<T extends P>(...args: [T]): OperationExpression<boolean> {
  return op('exists', args, transform_boolean);
}

export function notExists<T extends P>(...args: [T]): OperationExpression<boolean> {
  return op('notexists', args, transform_boolean);
}
