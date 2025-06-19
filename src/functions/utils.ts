import {
  Pattern,
  IriTerm,
  Wildcard,
  ExpressionOrPrimitive,
  OperationExpression,
  AggregateExpression,
  FunctionCallExpression,
} from '../struct';
import { processPrimitiveExpression } from '../structures';

function isPatternOrExpressionAndPrimitives(
  o: ExpressionOrPrimitive | Pattern
): o is Pattern {
  return (
    typeof o === 'object' &&
    'type' in o &&
    !['operation', 'functionCall', 'aggregate'].includes(o.type)
  );
}

export function op(
  operator: string,
  args: (ExpressionOrPrimitive | Pattern)[]
): OperationExpression {
  const proper_args = args.map(a => {
    if (isPatternOrExpressionAndPrimitives(a)) {
      return a;
    }
    return processPrimitiveExpression(a);
  });

  return {
    type: 'operation',
    operator: operator,
    args: proper_args,
  };
}

export function func(
  func: string | IriTerm,
  args: ExpressionOrPrimitive[]
): FunctionCallExpression {
  return {
    type: 'functionCall',
    function: func,
    args: args.map(a => processPrimitiveExpression(a)),
  };
}

function isWildCardOrExpressionAndPrimitives(
  o: ExpressionOrPrimitive | Wildcard
): o is Wildcard {
  return typeof o === 'object' && 'termType' in o && o.termType === 'Wildcard';
}

export function agg(
  expression: ExpressionOrPrimitive | Wildcard,
  aggregation: string,
  separator?: string | undefined
): AggregateExpression {
  let proper_expression;
  if (isWildCardOrExpressionAndPrimitives(expression)) {
    proper_expression = expression;
  } else {
    proper_expression = processPrimitiveExpression(expression);
  }

  return {
    type: 'aggregate',
    expression: proper_expression,
    aggregation: aggregation,
    separator: separator,
  };
}

export function distinct<
  T extends OperationExpression | FunctionCallExpression | AggregateExpression
>(expression: T): T {
  return { ...expression, distinct: true };
}
