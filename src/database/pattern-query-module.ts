import type {
  ExpressionInput,
  OrderingInput,
  PatternInput,
  QuerySelectInput,
  SolutionModifierGroupBindInput,
  TermIriInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, DialectPattern } from './dialect.js';
import {
  ModuleQueryBuilder,
  type QueryModule,
  type QueryModuleContext,
  type QueryNormalizer,
} from './query-module.js';

export interface PatternQueryConfig {
  body: QuerySelectInput;
}

/** Reuses standard clause handling for custom forms that have a WHERE clause. */
export abstract class PatternModuleQueryBuilder<
  C extends PatternQueryConfig,
  A,
  R,
  D extends AnySparqlDialect,
> extends ModuleQueryBuilder<C, A, R, D> {
  private readonly body: QueryNormalizer<D>;
  protected constructor(
    config: C,
    module: QueryModule<C, A, R, D>,
    context: QueryModuleContext<D>
  ) {
    super(config, module, context);
    this.body = context.normalizer(config.body);
  }
  where(
    ...patterns: PatternInput<DialectPattern<D>>[]
  ): Omit<this, 'where' | 'from' | 'fromNamed'> {
    this.body.where(...patterns);
    return this;
  }
  from(iri: TermIriInput): this {
    this.body.from(iri);
    return this;
  }
  fromNamed(iri: TermIriInput): this {
    this.body.fromNamed(iri);
    return this;
  }
  groupBy(
    ...expressions: (ExpressionInput | SolutionModifierGroupBindInput)[]
  ): Omit<this, 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    this.body.groupBy(...expressions);
    return this;
  }
  having(
    ...expressions: ExpressionInput[]
  ): Omit<this, 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    this.body.having(...expressions);
    return this;
  }
  orderBy(
    ...orderings: (OrderingInput | ExpressionInput)[]
  ): Omit<this, 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    this.body.orderBy(...orderings);
    return this;
  }
  limit(
    value: number
  ): Omit<this, 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    assertNonNegativeInteger(value, 'LIMIT');
    this.body.limit(value);
    return this;
  }
  offset(
    value: number
  ): Omit<
    this,
    'offset' | 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    assertNonNegativeInteger(value, 'OFFSET');
    this.body.offset(value);
    return this;
  }
  values(
    columns: ValuePatternColumnsInput
  ): Omit<
    this,
    | 'values'
    | 'offset'
    | 'limit'
    | 'orderBy'
    | 'having'
    | 'groupBy'
    | 'where'
    | 'from'
    | 'fromNamed'
  > {
    this.body.values(columns);
    return this;
  }
}

export function assertNonNegativeInteger(value: number, clause: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${clause} requires a non-negative safe integer.`);
}
