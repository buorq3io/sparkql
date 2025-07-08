import SparqlClient from 'sparql-http-client';
import { QueryBuilderBase } from './query';
import { ConstructQuery, QuadTerm, Triple } from '../generic';

export type ConstructTemplates = Triple[];

export class ConstructQueryBuilderBase
  extends QueryBuilderBase<ConstructQuery>
  implements PromiseLike<QuadTerm[]>
{
  private _promise: Promise<QuadTerm[]> | null = null;

  constructor(
    variables: ConstructTemplates,
    prefixes: ConstructQuery['prefixes']
  ) {
    super({
      type: 'query',
      queryType: 'CONSTRUCT',
      template: variables.length !== 0 ? variables : undefined,
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
