import { Generator } from 'sparqljs';
import SparqlClient from 'sparql-http-client';
import { SparqlGenerator, SparqlQuery } from '../generic';

export abstract class SparqlQueryBuilderBase<
  TConfig extends SparqlQuery,
  KReturn
> {
  protected readonly config: TConfig;
  protected readonly endpointUrl: string;
  protected _promise: Promise<KReturn> | null = null;
  protected readonly sparqlGenerator: SparqlGenerator;

  protected constructor(initialConfig: TConfig) {
    if (!process.env.DATABASE_URL) {
      throw Error(
        '$DATABASE_URL environment variable ' +
          'should be defined as your SPARQL endpoint!'
      );
    }

    this.config = initialConfig;
    this.sparqlGenerator = new Generator();
    this.endpointUrl = process.env.DATABASE_URL;
  }

  public getSPARQL() {
    return this.config;
  }

  public toSPARQL() {
    return this.sparqlGenerator.stringify(this.getSPARQL());
  }

  protected abstract makeQuery(client: SparqlClient): Promise<KReturn>;

  protected execute(): Promise<KReturn> {
    if (this._promise) {
      return this._promise;
    }

    this._promise = (async () => {
      try {
        const client = new SparqlClient({ endpointUrl: this.endpointUrl });
        return await this.makeQuery(client);
      } catch (error) {
        console.error('SPARQL execution failed:', error);
        throw error;
      }
    })();
    return this._promise;
  }

  public then<TResult1 = KReturn, TResult2 = never>(
    onfulfilled?: ((value: KReturn) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
