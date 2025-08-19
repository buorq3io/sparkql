import { Ordering, Expression } from '../generic.js';

export function asc(expression: Expression): Required<Ordering> {
  return { expression: expression, descending: false };
}

export function desc(expression: Expression): Required<Ordering> {
  return { expression: expression, descending: true };
}
