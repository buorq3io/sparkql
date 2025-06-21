import {
  Triple,
  Pattern,
  Ordering,
  SelectQuery,
  SparqlGenerator,
  VariableExpression,
  ExpressionOrPrimitive,
  Variable,
  LiteralTerm,
  IriTerm,
  VariableWithReturnType,
} from '../struct';
import { Generator } from 'sparqljs';
import SparqlClient from 'sparql-http-client';
import { createBgpPatterns, processPrimitiveExpression } from '../structures';

export type SelectReturn<T> = {
  [K in keyof T]: T[K] extends VariableWithReturnType<infer X>
    ? X
    : T[K] extends Variable
    ? LiteralTerm | IriTerm // Default for untyped variables
    : never;
};

export class SelectQueryBuilderBase<T>
  implements PromiseLike<SelectReturn<T>[]>
{
  private readonly config: SelectQuery;
  private readonly endpointUrl: string;
  private readonly sparqlGenerator: SparqlGenerator;
  private _promise: Promise<SelectReturn<T>[]> | null = null;

  constructor(
    variables: SelectQuery['variables'],
    prefixes: SelectQuery['prefixes'],
    distict: SelectQuery['distinct'] = undefined,
    reduced: SelectQuery['reduced'] = undefined
  ) {
    if (!process.env.DATABASE_URL) {
      throw Error(
        '$DATABASE_URL environment variable ' +
          'should be defined as your SPARQL endpoint!'
      );
    }

    this.endpointUrl = process.env.DATABASE_URL;
    this.sparqlGenerator = new Generator();

    this.config = {
      type: 'query',
      queryType: 'SELECT',
      variables: variables,
      prefixes: prefixes,
    };

    if (distict != undefined) {
      this.config['distinct'] = distict;
    }

    if (reduced != undefined) {
      this.config['reduced'] = reduced;
    }
  }

  where(...where: (Pattern | Triple)[]) {
    if (where.length !== 0) {
      this.config.where = createBgpPatterns(where);
    }
    return this;
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

  getSPARQL() {
    return this.config;
  }

  toSPARQL() {
    return this.sparqlGenerator.stringify(this.getSPARQL());
  }

  private execute(): Promise<SelectReturn<T>[]> {
    if (this._promise) {
      return this._promise;
    }

    this._promise = (async () => {
      try {
        const client = new SparqlClient({ endpointUrl: this.endpointUrl });
        const stream = client.query.select(this.toSPARQL());

        const items: SelectReturn<T>[] = [];
        for await (const binding of stream) {
          items.push(binding as SelectReturn<T>);
        }
        return items;
      } catch (error) {
        console.error('SPARQL execution failed:', error);
        throw error;
      }
    })();

    return this._promise;
  }

  public then<TResult1 = SelectReturn<T>[], TResult2 = never>(
    onfulfilled?:
      | ((value: SelectReturn<T>[]) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
