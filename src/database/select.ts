import * as SparqlJs from 'sparqljs';
import {
  SparqlClient,
  Variable,
  VariableTerm,
  Ordering,
  SelectQuery,
  QueryReturnType,
  BaseQueryReturnType,
  VariableExpression,
  Expression,
  DataFactory,
} from '../generic';
import { QueryBuilderBase } from './query';

export type SelectVariables<T extends Record<string, any>> = {
  [K in keyof T]: Variable<T[K]>;
};

export class SelectQueryBuilderBase<T extends Record<string, any>>
  extends QueryBuilderBase<SelectQuery, T[]>
  implements PromiseLike<T[]>
{
  private lookup: Record<string, string> = {};
  private lookupTransform: Record<
    string,
    ((self: BaseQueryReturnType) => QueryReturnType) | undefined
  > = {};

  constructor(
    variables: SelectVariables<T> | undefined,
    prefixes: SelectQuery['prefixes'],
    factory: DataFactory,
    distict: SelectQuery['distinct'] = undefined,
    reduced: SelectQuery['reduced'] = undefined
  ) {
    super(
      {
        type: 'query',
        queryType: 'SELECT',
        variables: variables ? <SparqlJs.Variable[]>Object.values(variables).map(v => {
              if ('expression' in v) {
                return { ...v, expression: this.sanitizeExpression(v.expression) };
              }
              return v;
            }) : [new SparqlJs.Wildcard()],
        prefixes: prefixes,
      },
      factory
    );

    function isVariableTerm(obj: any): obj is VariableTerm {
      return (
        typeof obj === 'object' && obj !== null && 'termType' in obj && obj.termType === 'Variable'
      );
    }

    for (const key in variables) {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        const value = variables[key];
        // Case 1: The value is a Variable directly
        if (isVariableTerm(value)) {
          this.lookup[value.value] = key;
          this.lookupTransform[value.value] = value.transform;
        }
        // Case 2: The value is an object that contains a 'variable' property
        else if (
          typeof value === 'object' &&
          value !== null &&
          'variable' in value &&
          isVariableTerm(value.variable)
        ) {
          this.lookup[value.variable.value] = key;
          this.lookupTransform[value.variable.value] =
            typeof value.expression === 'object' && 'transform' in value.expression
              ? value.expression.transform
              : undefined;
        }
      }
    }

    if (distict != undefined) {
      this.config.distinct = distict;
    }

    if (reduced != undefined) {
      this.config.reduced = reduced;
    }
  }

  having(...expressions: Expression[]) {
    if (expressions.length === 0) {
      return this;
    }

    if (this.config.having) {
      this.config.having = [
        ...this.config.having,
        ...expressions.map(e => this.sanitizeExpression(e)),
      ];
    } else {
      this.config.having = expressions.map(e => this.sanitizeExpression(e));
    }
    return this;
  }

  groupBy(...groupings: (Expression | VariableExpression)[]) {
    if (groupings.length === 0) {
      return this;
    }

    if (!this.config.group) {
      this.config.group = [];
    }

    for (const grouping of groupings) {
      if (typeof grouping === 'object' && 'variable' in grouping) {
        this.config.group.push({
          ...grouping,
          expression: this.sanitizeExpression(grouping.expression),
        });
      } else {
        this.config.group.push({
          expression: this.sanitizeExpression(grouping),
        });
      }
    }
    return this;
  }

  orderBy(...orderings: (Expression | Required<Ordering>)[]) {
    if (orderings.length === 0) {
      return this;
    }

    if (!this.config.order) {
      this.config.order = [];
    }

    for (const ordering of orderings) {
      if (typeof ordering === 'object' && 'descending' in ordering) {
        this.config.order.push({
          ...ordering,
          expression: this.sanitizeExpression(ordering.expression),
        });
      } else {
        this.config.order.push({
          expression: this.sanitizeExpression(ordering),
        });
      }
    }
    return this;
  }

  limit(limit: number) {
    this.config.limit = limit;
    return this;
  }

  offset(offset: number) {
    this.config.offset = offset;
    return this;
  }

  protected async makeQuery(client: SparqlClient): Promise<T[]> {
    const stream = client.query.select(this.toSPARQL());

    const items: T[] = [];
    for await (const binding of stream) {
      const temp = Object.entries(this.lookup).reduce((acc, curr) => {
        const func = this.lookupTransform[curr[0]] ?? ((self: any) => self);
        acc[curr[1]] = func(binding[curr[0]]);
        return acc;
      }, {} as Record<string, any>);
      items.push(temp as T);
    }
    return items;
  }
}
