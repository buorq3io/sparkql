import {
  IriTerm,
  Wildcard,
  QueryReturnType,
  BaseQueryReturnType,
  PatternOrTriple,
  OperationExpression,
  AggregateExpression,
  ExpressionOrPrimitive,
  FunctionCallExpression,
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

export function op<K extends QueryReturnType>(
  operator: string,
  args: (ExpressionOrPrimitive | ExpressionOrPrimitive[] | PatternOrTriple)[],
  transform?: (self: BaseQueryReturnType, ...other: any[]) => K
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
    transform: transform,
  };
}

export function func<K extends QueryReturnType>(
  func: string | IriTerm,
  args: ExpressionOrPrimitive[],
  transform?: (self: BaseQueryReturnType, ...other: any[]) => K
): FunctionCallExpression<K> {
  return {
    type: 'functionCall',
    function: func,
    args: args.map(a => processPrimitiveExpression(a)),
    transform: transform,
  };
}

function isWildCardOrExpressionAndPrimitives(
  o: ExpressionOrPrimitive | Wildcard
): o is Wildcard {
  return typeof o === 'object' && 'termType' in o && o.termType === 'Wildcard';
}

export function agg<K extends QueryReturnType>(
  expression: ExpressionOrPrimitive | Wildcard,
  aggregation: string,
  separator?: string,
  transform?: (self: BaseQueryReturnType, ...other: any[]) => K
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
    transform: transform,
  };
}

export function distinct<
  K extends QueryReturnType,
  T extends
    | OperationExpression<K>
    | FunctionCallExpression<K>
    | AggregateExpression<K>
>(expression: T): T {
  return { ...expression, distinct: true };
}
