import type {
  ExpressionInput,
  OrderingInput,
  PatternGroupInput,
  PatternInput,
  QueryInput,
  SolutionModifierGroupBindInput,
  TermIriInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';
import { isObjectLike } from '../helpers/utilities.js';
import { group, values } from '../structures/pattern.js';
import type { AnySparqlDialect, DialectPattern, SparqlDialect } from './dialect.js';
import {
  type MergePlaceholders,
  Placeholder,
  type PlaceholderCarrier,
  type PlaceholderValues,
  type placeholderTypes,
} from './prepared.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';

export type QueryBuilderBaseWithout<
  T,
  TDynamic extends boolean,
  TExcluded extends keyof T & string,
> = TDynamic extends true ? T : Omit<T, TExcluded>;

export type RootQueryBuilderBaseWithout<T extends QueryBuilderBase<any, any, any, any>> =
  QueryBuilderBaseWithout<
    T,
    false,
    'values' | 'limit' | 'offset' | 'orderBy' | 'having' | 'groupBy'
  >;

export abstract class QueryBuilderBase<
  TConfig extends QueryInput,
  KReturn,
  TDynamic extends boolean = false,
  D extends AnySparqlDialect = SparqlDialect,
> extends SparqlQueryBuilderBase<TConfig, KReturn, D> {
  private fromBase(
    fromType: 'default' | 'named',
    iris: TermIriInput[]
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'groupBy' | 'having' | 'orderBy' | 'limit' | 'offset' | 'values'
  > {
    this.config.datasets.clauses = [
      ...this.config.datasets.clauses,
      ...iris.map(
        i =>
          ({
            clauseType: fromType,
            value: i,
          }) as const
      ),
    ];

    return this;
  }

  from(iri: TermIriInput) {
    return this.fromBase('default', [iri]);
  }

  fromNamed(iri: TermIriInput) {
    return this.fromBase('named', [iri]);
  }

  where<Self extends PlaceholderCarrier<object>, P extends PatternInput<DialectPattern<D>>[]>(
    this: Self,
    ...patterns: P
  ): QueryBuilderBaseWithout<this, TDynamic, 'where' | 'from' | 'fromNamed'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<P[number]>>;

  where<P extends PatternInput<DialectPattern<D>>[]>(
    ...patterns: P
  ): QueryBuilderBaseWithout<this, TDynamic, 'where' | 'from' | 'fromNamed'> &
    PlaceholderCarrier<MergePlaceholders<P[number]>> {
    if (!this.config.where) {
      this.config.where = group(...patterns) as unknown as PatternGroupInput;
    } else {
      this.config.where.patterns = [
        ...this.config.where.patterns,
        ...(patterns as unknown as PatternInput[]),
      ];
    }
    return this as typeof this & PlaceholderCarrier<MergePlaceholders<P[number]>>;
  }

  groupBy<
    Self extends PlaceholderCarrier<object>,
    Inputs extends (ExpressionInput | SolutionModifierGroupBindInput)[],
  >(
    this: Self,
    ...expressions: Inputs
  ): QueryBuilderBaseWithout<this, TDynamic, 'groupBy' | 'where' | 'from' | 'fromNamed'> &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Inputs[number]>
    >;

  groupBy(
    ...expressions: (ExpressionInput | SolutionModifierGroupBindInput)[]
  ): QueryBuilderBaseWithout<this, TDynamic, 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    if (!this.config.solutionModifiers.group) {
      this.config.solutionModifiers.group = {
        type: 'solutionModifier',
        subType: 'group',
        groupings: expressions,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  having<Self extends PlaceholderCarrier<object>, Inputs extends ExpressionInput[]>(
    this: Self,
    ...expressions: Inputs
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Inputs[number]>
    >;

  having(
    ...expressions: ExpressionInput[]
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    if (!this.config.solutionModifiers.having) {
      this.config.solutionModifiers.having = {
        type: 'solutionModifier',
        subType: 'having',
        having: expressions,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  orderBy<
    Self extends PlaceholderCarrier<object>,
    Inputs extends (OrderingInput | ExpressionInput)[],
  >(
    this: Self,
    ...orderings: Inputs
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Inputs[number]>
    >;

  orderBy(
    ...orderings: (OrderingInput | ExpressionInput)[]
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    if (!this.config.solutionModifiers.order) {
      this.config.solutionModifiers.order = {
        type: 'solutionModifier',
        subType: 'order',
        orderDefs: orderings.map(o => {
          if (isObjectLike(o) && 'descending' in o) return o;
          return {
            descending: false,
            loc: { sourceLocationType: 'autoGenerate' },
            expression: o,
          } as const;
        }),
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  limit<Self extends PlaceholderCarrier<object>, P extends number | Placeholder<string, number>>(
    this: Self,
    limit: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & PlaceholderValues<P>>;

  limit<P extends number | Placeholder<string, number>>(
    limit: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<PlaceholderValues<P>> {
    if (
      !this.config.solutionModifiers.limitOffset ||
      this.config.solutionModifiers.limitOffset?.limit === undefined
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        // @ts-expect-error A workaround of a bug in the underlying library
        limit: limit instanceof Placeholder ? limit : String(limit),
        offset: this.config.solutionModifiers.limitOffset?.offset,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this as typeof this & PlaceholderCarrier<PlaceholderValues<P>>;
  }

  offset<Self extends PlaceholderCarrier<object>, P extends number | Placeholder<string, number>>(
    this: Self,
    offset: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'offset' | 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & PlaceholderValues<P>>;

  offset<P extends number | Placeholder<string, number>>(
    offset: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'offset' | 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<PlaceholderValues<P>> {
    if (
      !this.config.solutionModifiers.limitOffset ||
      this.config.solutionModifiers.limitOffset?.offset === undefined
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        limit: this.config.solutionModifiers.limitOffset?.limit,
        // @ts-expect-error A workaround of a bug in the underlying library
        offset: offset instanceof Placeholder ? offset : String(offset),
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this as typeof this & PlaceholderCarrier<PlaceholderValues<P>>;
  }

  values<Self extends PlaceholderCarrier<object>, Columns extends ValuePatternColumnsInput>(
    this: Self,
    columns: Columns
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    | 'values'
    | 'limit'
    | 'offset'
    | 'orderBy'
    | 'having'
    | 'groupBy'
    | 'where'
    | 'from'
    | 'fromNamed'
  > &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Columns[keyof Columns][number]>
    >;

  values(
    columns: ValuePatternColumnsInput
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    | 'values'
    | 'limit'
    | 'offset'
    | 'orderBy'
    | 'having'
    | 'groupBy'
    | 'where'
    | 'from'
    | 'fromNamed'
  > {
    if (!this.config.values) {
      this.config.values = values(columns);
    }

    return this;
  }

  $dynamic<Self extends PlaceholderCarrier<object>>(
    this: Self
  ): QueryBuilderBaseWithout<this, true, never> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]>>;

  $dynamic(): QueryBuilderBaseWithout<this, true, any> {
    return this;
  }
}
