import { agg } from './utils';
import { Wildcard, ExpressionOrPrimitive } from '../struct';

export function groupConcat(
  expression: ExpressionOrPrimitive | Wildcard,
  separator: string
) {
  return agg(expression, 'group_concat', separator);
}
