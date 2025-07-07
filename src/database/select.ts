import {
  Variable,
  VariableTerm,
  Ordering,
  SelectQuery,
  QueryReturnType,
  BaseQueryReturnType,
  VariableExpression,
  ExpressionOrPrimitive,
} from '../generic';
import { Wildcard } from 'sparqljs';
import SparqlClient from 'sparql-http-client';
import { SelectVariables } from './base';
import { QueryBuilderBase } from './query';
import { processPrimitiveExpression } from '../structures';

export class SelectQueryBuilderBase<T extends Record<string, any>>
  extends QueryBuilderBase<SelectQuery>
  implements PromiseLike<T[]>
{
  private _promise: Promise<T[]> | null = null;
  private lookup: Record<string, string> = {};
  private lookupTransform: Record<
    string,
    ((self: BaseQueryReturnType) => QueryReturnType) | undefined
  > = {};

  constructor(
    variables: SelectVariables<T> | undefined,
    prefixes: SelectQuery['prefixes'],
    distict: SelectQuery['distinct'] = undefined,
    reduced: SelectQuery['reduced'] = undefined
  ) {
    super({
      type: 'query',
      queryType: 'SELECT',
      variables: variables
        ? <Variable[]>Object.values(variables)
        : [new Wildcard()],
      prefixes: prefixes,
    });

    function isVariableTerm(obj: any): obj is VariableTerm {
      return (
        typeof obj === 'object' &&
        obj !== null &&
        'termType' in obj &&
        obj.termType === 'Variable'
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
          this.lookup[(value as any).variable.value] = key;
          this.lookupTransform[(value as any).variable.value] =
            'transform' in value.expression
              ? value.expression.transform
              : undefined;
        }
      }
    }

    if (distict != undefined) {
      this.config['distinct'] = distict;
    }

    if (reduced != undefined) {
      this.config['reduced'] = reduced;
    }
  }

  having(...havings: ExpressionOrPrimitive[]) {
    if (havings.length !== 0) {
      this.config.having = havings.map(e => processPrimitiveExpression(e));
    }
    return this;
  }

  groupBy(
    ...groupings: [
      ExpressionOrPrimitive | VariableExpression,
      ...(ExpressionOrPrimitive | VariableExpression)[]
    ]
  ) {
    this.config.group = [];
    for (const grouping of groupings) {
      if (typeof grouping === 'object' && 'variable' in grouping) {
        this.config.group.push(grouping);
      } else {
        this.config.group.push({
          expression: processPrimitiveExpression(grouping),
        });
      }
    }
    return this;
  }

  orderBy(
    ...orderings: [
      ExpressionOrPrimitive | Required<Ordering>,
      ...(ExpressionOrPrimitive | Required<Ordering>)[]
    ]
  ) {
    this.config.order = [];
    for (const ordering of orderings) {
      if (typeof ordering === 'object' && 'descending' in ordering) {
        this.config.order.push(ordering);
      } else {
        this.config.order.push({
          expression: processPrimitiveExpression(ordering),
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

  private execute(): Promise<T[]> {
    if (this._promise) {
      return this._promise;
    }

    this._promise = (async () => {
      try {
        const client = new SparqlClient({ endpointUrl: this.endpointUrl });
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
      } catch (error) {
        console.error('SPARQL execution failed:', error);
        throw error;
      }
    })();
    return this._promise;
  }

  public then<TResult1 = T[], TResult2 = never>(
    onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
