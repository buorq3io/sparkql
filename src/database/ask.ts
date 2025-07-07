import { AskQuery } from '../generic';
import { QueryBuilderBase } from './query';
import SparqlClient from 'sparql-http-client';

export class AskQueryBuilderBase
  extends QueryBuilderBase<AskQuery>
  implements PromiseLike<boolean>
{
  private _promise: Promise<boolean> | null = null;

  constructor(prefixes: AskQuery['prefixes']) {
    super({
      type: 'query',
      queryType: 'ASK',
      prefixes: prefixes,
    });
  }

  private execute(): Promise<boolean> {
    if (this._promise) {
      return this._promise;
    }

    this._promise = (async () => {
      try {
        const client = new SparqlClient({ endpointUrl: this.endpointUrl });
        return client.query.ask(this.toSPARQL());
      } catch (error) {
        console.error('SPARQL execution failed:', error);
        throw error;
      }
    })();
    return this._promise;
  }

  public then<TResult1 = boolean, TResult2 = never>(
    onfulfilled?: ((value: boolean) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
