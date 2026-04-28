import { values, group } from '../structures/pattern.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import {
  ContextDefinitionBaseInput,
  ExpressionInput,
  OrderingInput,
  PatternInput,
  QueryInput,
  SolutionModifierGroupBindInput,
  TermIriFullInput,
  TermIriInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';

export abstract class QueryBuilderBase<
  TConfig extends QueryInput,
  KReturn
> extends SparqlQueryBuilderBase<TConfig, KReturn> {
  private fromBase(fromType: 'default' | 'named', iris: TermIriInput[]) {
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

  base(base: TermIriFullInput | string) {
    this.config.context.push({
      type: 'contextDef',
      subType: 'base',
      value:
        typeof base === 'string'
          ? {
              type: 'term',
              subType: 'namedNode',
              value: base,
              loc: {
                sourceLocationType: 'autoGenerate',
              },
            }
          : base,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
    } satisfies ContextDefinitionBaseInput);

    return this;
  }

  values(columns: ValuePatternColumnsInput) {
    if (!this.config.values) {
      this.config.values = values(columns);
    }

    return this;
  }

  where(...patterns: PatternInput[]) {
    if (!this.config.where) {
      this.config.where = group(...patterns);
    } else {
      this.config.where.patterns = [...this.config.where.patterns, ...patterns];
    }
    return this;
  }

  having(...expressions: ExpressionInput[]) {
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

  groupBy(...expressions: (ExpressionInput | SolutionModifierGroupBindInput)[]) {
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

  orderBy(...orderings: OrderingInput[]) {
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

  limit(limit: number) {
    if (
      !this.config.solutionModifiers.limitOffset ||
      !this.config.solutionModifiers.limitOffset?.limit
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        limit: limit,
        offset: this.config.solutionModifiers.limitOffset?.offset,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  offset(offset: number) {
    if (
      !this.config.solutionModifiers.limitOffset ||
      !this.config.solutionModifiers.limitOffset?.offset
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        limit: this.config.solutionModifiers.limitOffset?.limit,
        offset: offset,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }
}
