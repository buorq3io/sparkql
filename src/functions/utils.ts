import {
  ExpressionAggregateDefaultInput,
  ExpressionAggregateInput,
  ExpressionAggregateOnWildcardInput,
  ExpressionAggregateSeparatorInput,
  ExpressionFunctionCallInput,
  ExpressionInput,
  ExpressionOperationInput,
  ExpressionPatternOperationInput,
  PatternGroupInput,
  QueryReturnType,
  TermIriInput,
  TermVariableTransform,
  WildcardInput,
} from '../helpers/types.js';

export function createOperationExpression<T extends QueryReturnType>(
  operator: string,
  args: ExpressionInput[],
  transform?: TermVariableTransform<T>
): ExpressionOperationInput<T> {
  return {
    type: 'expression',
    subType: 'operation',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    operator: operator,
    args: args,
    transform: transform,
  };
}

export function createPatternOperationExpression<T extends QueryReturnType>(
  operator: string,
  args: PatternGroupInput,
  transform?: TermVariableTransform<T>
): ExpressionPatternOperationInput<T> {
  return {
    type: 'expression',
    subType: 'patternOperation',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    operator: operator,
    args: args,
    transform: transform,
  };
}

export function createFunctionCallExpression<T extends QueryReturnType>(
  func: TermIriInput,
  args: ExpressionInput[],
  transform?: TermVariableTransform<T>
): ExpressionFunctionCallInput<T> {
  return {
    type: 'expression',
    subType: 'functionCall',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    distinct: false,
    function: func,
    args: args,
    transform: transform,
  };
}

export function createAggregateExpression<T extends QueryReturnType>(
  aggregation: string,
  expression: [ExpressionInput],
  separator: undefined,
  transform?: TermVariableTransform<T>
): ExpressionAggregateDefaultInput<T>;

export function createAggregateExpression<T extends QueryReturnType>(
  aggregation: string,
  expression: [WildcardInput],
  separator: undefined,
  transform?: TermVariableTransform<T>
): ExpressionAggregateOnWildcardInput<T>;

export function createAggregateExpression<T extends QueryReturnType>(
  aggregation: string,
  expression: [ExpressionInput],
  separator: string,
  transform?: TermVariableTransform<T>
): ExpressionAggregateSeparatorInput<T>;

export function createAggregateExpression<T extends QueryReturnType>(
  aggregation: string,
  expression: [WildcardInput] | [ExpressionInput],
  separator?: string,
  transform?: TermVariableTransform<T>
): ExpressionAggregateInput<T> {
  return {
    type: 'expression',
    subType: 'aggregate',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    distinct: false,
    aggregation: aggregation,
    ...(separator ? { separator: separator } : {}),
    expression: expression,
    transform: transform,
  } as ExpressionAggregateInput<T>;
}

export function distinct<
  T extends QueryReturnType,
  K extends ExpressionFunctionCallInput<T> | ExpressionAggregateInput<T>
>(expression: K): K {
  return { ...expression, distinct: true };
}

export function createWildCardInput(): WildcardInput {
  return {
    type: 'wildcard',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}
