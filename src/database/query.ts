import { values, group } from '../structures/pattern.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import {
  ExpressionInput,
  OrderingInput,
  PatternInput,
  QueryInput,
  SolutionModifierGroupBindInput,
  TermIriInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';

export type QueryBuilderBaseWithout<
  T extends QueryBuilderBase<any, any, any>,
  TDynamic extends boolean,
  TExcluded extends keyof T & string,
> = TDynamic extends true ? T : Omit<T, TExcluded>;

export type RootQueryBuilderBaseWithout<T extends QueryBuilderBase<any, any, any>> =
  QueryBuilderBaseWithout<
    T,
    false,
    'values' | 'limit' | 'offset' | 'orderBy' | 'having' | 'groupBy'
  >;

export abstract class QueryBuilderBase<
  TConfig extends QueryInput,
  KReturn,
  TDynamic extends boolean = false
  > extends SparqlQueryBuilderBase<TConfig, KReturn> {

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
          } as const)
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

  where(
    ...patterns: PatternInput[]
  ): QueryBuilderBaseWithout<this, TDynamic, 'where' | 'from' | 'fromNamed'> {
    if (!this.config.where) {
      this.config.where = group(...patterns);
    } else {
      this.config.where.patterns = [...this.config.where.patterns, ...patterns];
    }
    return this;
  }

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

  orderBy(
    ...orderings: OrderingInput[]
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    if (!this.config.solutionModifiers.order) {
      this.config.solutionModifiers.order = {
        type: 'solutionModifier',
        subType: 'order',
        orderDefs: orderings,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  limit(
    limit: number
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    if (
      !this.config.solutionModifiers.limitOffset ||
      this.config.solutionModifiers.limitOffset?.limit === undefined
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        // @ts-ignore A workaround of a bug in the underlying library
        limit: String(limit),
        offset: this.config.solutionModifiers.limitOffset?.offset,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  offset(
    offset: number
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'offset' | 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    if (
      !this.config.solutionModifiers.limitOffset ||
      this.config.solutionModifiers.limitOffset?.offset === undefined
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        limit: this.config.solutionModifiers.limitOffset?.limit,
        // @ts-ignore A workaround of a bug in the underlying library
        offset: String(offset),
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

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

  $dynamic(): QueryBuilderBaseWithout<this, true, any> {
    return this
  }
}
