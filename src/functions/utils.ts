import type {
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

/**
 * Creates an operation expression with the given SPARQL operator.
 *
 * @param operator - The SPARQL operator.
 * @param args - Its operands.
 * @param transform - An optional result transformer.
 *
 * @example
 * Build an absolute-age expression.
 *
 * ```ts
 * const expression = createOperationExpression('abs', [v.age]);
 * ```
 */
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

/**
 * Creates an operation expression over a group pattern.
 *
 * @param operator - The SPARQL operator.
 * @param args - The group pattern.
 * @param transform - An optional result transformer.
 *
 * @example
 * Test for a person with a name.
 *
 * ```ts
 * const expression = createPatternOperationExpression('exists', group(triples(v.person, n.foaf.name, v.name)));
 * ```
 */
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

/**
 * Creates a call to a function identified by an IRI.
 *
 * @param func - The function IRI.
 * @param args - The function arguments.
 * @param transform - An optional result transformer.
 *
 * @example
 * Call an IRI-identified function on a name.
 *
 * ```ts
 * const expression = createFunctionCallExpression(n.schema.name, [v.name]);
 * ```
 */
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

/**
 * Creates an aggregate expression.
 *
 * @param aggregation - The aggregate name.
 * @param expression - The value or wildcard to aggregate.
 * @param separator - The separator for concatenation, if supplied.
 * @param transform - An optional result transformer.
 *
 * @example
 * Count bound person values.
 *
 * ```ts
 * const expression = createAggregateExpression('count', [v.person], undefined);
 * ```
 */
export function createAggregateExpression<T extends QueryReturnType>(
  aggregation: string,
  expression: [ExpressionInput],
  separator: undefined,
  transform?: TermVariableTransform<T>
): ExpressionAggregateDefaultInput<T>;

/**
 * Creates an aggregate expression.
 *
 * See the first overload for details.
 *
 * @param aggregation - The aggregate name.
 * @param expression - The value or wildcard to aggregate.
 * @param separator - The separator for concatenation, if supplied.
 * @param transform - An optional result transformer.
 *
 * @example
 * Count all solutions with a wildcard.
 *
 * ```ts
 * const expression = createAggregateExpression('count', [createWildCardInput()], undefined);
 * ```
 */
export function createAggregateExpression<T extends QueryReturnType>(
  aggregation: string,
  expression: [WildcardInput],
  separator: undefined,
  transform?: TermVariableTransform<T>
): ExpressionAggregateOnWildcardInput<T>;

/**
 * Creates an aggregate expression.
 *
 * See the first overload for details.
 *
 * @param aggregation - The aggregate name.
 * @param expression - The value or wildcard to aggregate.
 * @param separator - The separator for concatenation, if supplied.
 * @param transform - An optional result transformer.
 *
 * @example
 * Join names with a comma separator.
 *
 * ```ts
 * const expression = createAggregateExpression('group_concat', [v.name], ', ');
 * ```
 */
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

/**
 * Adds `DISTINCT` to an aggregate or function call.
 *
 * @param expression - The expression to make distinct.
 *
 * @example
 * Count distinct friends.
 *
 * ```ts
 * const expression = distinct(count(v.friend));
 * ```
 */
export function distinct<
  T extends QueryReturnType,
  K extends ExpressionFunctionCallInput<T> | ExpressionAggregateInput<T>,
>(expression: K): K {
  return { ...expression, distinct: true };
}

/**
 * Creates a wildcard input for an aggregate.
 *
 *
 * @example
 * Create a wildcard for counting solutions.
 *
 * ```ts
 * const wildcard = createWildCardInput();
 * ```
 */
export function createWildCardInput(): WildcardInput {
  return {
    type: 'wildcard',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}
