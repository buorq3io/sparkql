import {
  Pattern,
  IriTerm,
  Wildcard,
  ExpressionOrPrimitive,
  OperationExpression,
  AggregateExpression,
  FunctionCallExpression,
  PatternOrTriple,
} from '../struct';
import { createBgpPatterns, processPrimitiveExpression } from '../structures';

function isGeneralPatternOrExpression(
  o: ExpressionOrPrimitive | PatternOrTriple
): o is PatternOrTriple {
  return (
    typeof o === 'object' &&
    (('type' in o &&
      !['operation', 'functionCall', 'aggregate'].includes(o.type)) ||
      'subject' in o)
  );
}

export function op(
  operator: string,
  args: (ExpressionOrPrimitive | ExpressionOrPrimitive[] | PatternOrTriple)[]
): OperationExpression {
  const proper_args = args.map(a => {
    if (Array.isArray(a)) {
      return a.map(v => processPrimitiveExpression(v))
    }
    if (isGeneralPatternOrExpression(a)) {
      return createBgpPatterns([a])[0];
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
