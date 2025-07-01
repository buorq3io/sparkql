import {
  IriTerm,
  Wildcard,
  PatternOrTriple,
  OperationExpression,
  AggregateExpression,
  ExpressionOrPrimitive,
  FunctionCallExpression,
  ExpressionReturnType,
} from '../generic';
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

export function op<K extends ExpressionReturnType>(
  operator: string,
  args: (ExpressionOrPrimitive | ExpressionOrPrimitive[] | PatternOrTriple)[]
): OperationExpression<K> {
  const proper_args = args.map(a => {
    if (Array.isArray(a)) {
      return a.map(v => processPrimitiveExpression(v));
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

export function func<K extends ExpressionReturnType>(
  func: string | IriTerm,
  args: ExpressionOrPrimitive[]
): FunctionCallExpression<K> {
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

export function agg<K extends ExpressionReturnType>(
  expression: ExpressionOrPrimitive | Wildcard,
  aggregation: string,
  separator?: string | undefined
): AggregateExpression<K> {
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
  K extends ExpressionReturnType,
  T extends
    | OperationExpression<K>
    | FunctionCallExpression<K>
    | AggregateExpression<K>
>(expression: T): T {
  return { ...expression, distinct: true };
}
