import { op } from './utils';
import {
  PatternOrTriple,
  OperationExpression,
  ExpressionOrPrimitive,
} from '../generic';

type P = PatternOrTriple;
type E = ExpressionOrPrimitive;

export function eq<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('=', args);
}

export function ne<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('!=', args);
}

export function gt<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('>', args);
}

export function gte<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('>=', args);
}

export function lt<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('<', args);
}

export function lte<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('<=', args);
}

export function and<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('&&', args);
}

export function or<T extends E>(...args: [T, T]): OperationExpression<boolean> {
  return op('||', args);
}

export function add<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('+', args);
}

export function subs<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('-', args);
}

export function mul<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('*', args);
}

export function div<T extends E>(...args: [T, T]): OperationExpression<number> {
  return op('/', args);
}

export function not<T extends E>(...args: [T]): OperationExpression<boolean> {
  return op('!', args);
}

export function uplus<T extends E>(...args: [T]): OperationExpression<number> {
  return op('uplus', args);
}

export function uminus<T extends E>(...args: [T]): OperationExpression<number> {
  return op('uminus', args);
}

export function inArray<K extends E>(...args: [K, E[]]): OperationExpression<boolean> {
  return op('in', args);
}

export function notinArray<K extends E>(...args: [K, E[]]): OperationExpression<boolean> {
  return op('notin', args);
}

export function exists<T extends P>(...args: [T]): OperationExpression<boolean> {
  return op('exists', args);
}

export function notExists<T extends P>(...args: [T]): OperationExpression<boolean> {
  return op('notexists', args);
}
