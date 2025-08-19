import {
  IriTerm,
  Pattern,
  Wildcard,
  Expression,
  QueryReturnType,
  BaseQueryReturnType,
  OperationExpression,
  AggregateExpression,
  FunctionCallExpression,
} from '../generic.js';

export function op<K extends QueryReturnType>(
  operator: string,
  args: (Expression | Pattern)[],
  transform?: (self: BaseQueryReturnType, ...other: any[]) => K
): OperationExpression<K> {
  return {
    type: 'operation',
    operator: operator,
    args: args,
    transform: transform,
  };
}

export function func<K extends QueryReturnType>(
  func: string | IriTerm,
  args: Expression[],
  transform?: (self: BaseQueryReturnType, ...other: any[]) => K
): FunctionCallExpression<K> {
  return {
    type: 'functionCall',
    function: func,
    args: args,
    transform: transform,
  };
}

export function agg<K extends QueryReturnType>(
  expression: Expression | Wildcard,
  aggregation: string,
  separator?: string | undefined,
  transform?: (self: BaseQueryReturnType, ...other: any[]) => K
): AggregateExpression<K> {
  return {
    type: 'aggregate',
    expression: expression,
    aggregation: aggregation,
    separator: separator,
    transform: transform,
  };
}

export function distinct<
  K extends QueryReturnType,
  T extends OperationExpression<K> | FunctionCallExpression<K> | AggregateExpression<K>
>(expression: T): T {
  return { ...expression, distinct: true };
}
