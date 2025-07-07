import { DescribeQuery, IriTerm, QuadTerm, VariableTerm } from '../generic';
import { QueryBuilderBase } from './query';
import SparqlClient from 'sparql-http-client';
import { Wildcard } from 'sparqljs';

export type DescribeVariables = (VariableTerm | IriTerm)[];

export class DescribeQueryBuilderBase
  extends QueryBuilderBase<DescribeQuery>
  implements PromiseLike<QuadTerm[]>
{
  private _promise: Promise<QuadTerm[]> | null = null;

  constructor(
    variables: DescribeVariables,
    prefixes: DescribeQuery['prefixes']
  ) {
    super({
      type: 'query',
      queryType: 'DESCRIBE',
      variables: variables.length !== 0
        ? <(VariableTerm | IriTerm)[]>Object.values(variables)
        : [new Wildcard()],
      prefixes: prefixes,
    });
  }

  private execute(): Promise<QuadTerm[]> {
    if (this._promise) {
      return this._promise;
    }

    this._promise = (async () => {
      try {
        const client = new SparqlClient({ endpointUrl: this.endpointUrl });
        const stream = client.query.construct(this.toSPARQL());

        const items: QuadTerm[] = [];
        for await (const binding of stream) {
          items.push(binding);
        }
        return items;
      } catch (error) {
        console.error('SPARQL execution failed:', error);
        throw error;
      }
    })();
    return this._promise;
  }

  public then<TResult1 = QuadTerm[], TResult2 = never>(
    onfulfilled?:
      | ((value: QuadTerm[]) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
