import { processLiteralExpression } from './expression';
import { Ordering, ExpressionOrPrimitive } from '../struct';

export function asc(expression: ExpressionOrPrimitive): Required<Ordering> {
  return {
    expression: processLiteralExpression(expression),
    descending: false,
  };
}

export function desc(expression: ExpressionOrPrimitive): Required<Ordering> {
  return { expression: processLiteralExpression(expression), descending: true };
}
