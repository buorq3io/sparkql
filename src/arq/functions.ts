import { createFunctionCallExpression, createOperationExpression } from '../functions/utils.js';
import type {
  ExpressionFunctionCallInput,
  ExpressionInput,
  ExpressionOperationInput,
  TermLiteralOutput,
} from '../helpers/types.js';
import { transformNumber } from '../structures/expression.js';

/** ARQ numeric modulus. Evaluation, including errors, is performed by the endpoint. */
export function mod(
  left: ExpressionInput,
  right: ExpressionInput
): ExpressionOperationInput<number> {
  return createOperationExpression('mod', [left, right], transformNumber);
}

/** ARQ integer division, truncating the quotient toward zero. */
export function idiv(
  left: ExpressionInput,
  right: ExpressionInput
): ExpressionOperationInput<number> {
  return createOperationExpression('idiv', [left, right], transformNumber);
}

/** Builds a locale-specific sorting key for use in ORDER BY. */
export function collation(
  locale: ExpressionInput,
  expression: ExpressionInput
): ExpressionFunctionCallInput<TermLiteralOutput> {
  return createFunctionCallExpression(new URL('http://jena.apache.org/ARQ/function#collation'), [
    locale,
    expression,
  ]);
}
