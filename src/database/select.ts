import {
  Triple,
  Pattern,
  Ordering,
  SelectQuery,
  SparqlGenerator,
  VariableExpression,
  ExpressionOrPrimitive,
} from '../struct';
import { Generator } from 'sparqljs';
import SparqlClient from 'sparql-http-client';
import { createBgpPatterns, processLiteralExpression } from '../structures';

export class SelectQueryBuilderBase<T> implements PromiseLike<T[]> {
  private readonly config: SelectQuery;
  private readonly endpointUrl: string;
  private readonly sparqlGenerator: SparqlGenerator;
  private _promise: Promise<T[]> | null = null;

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
      this.config.having = havings.map(e => processLiteralExpression(e));
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
          expression: processLiteralExpression(grouping),
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
          expression: processLiteralExpression(ordering),
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
          items.push(binding as T);
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
