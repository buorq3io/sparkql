import SparqlClient from 'sparql-http-client';

/** Shared execution lifecycle for standard and dialect-defined query forms. */
export abstract class ExecutableQuery<Result> implements PromiseLike<Result> {
  protected _promise: Promise<Result> | null = null;

  protected constructor(protected readonly endpointUrl?: string) {}

  public abstract getSPARQL(): unknown;
  public abstract toSPARQL(): string;
  protected abstract makeQuery(client: SparqlClient): Promise<Result>;

  protected execute(): Promise<Result> {
    if (!this.endpointUrl) {
      throw new Error(
        'Database URL should be defined as your SPARQL endpoint in order to make a request.'
      );
    }
    return (this._promise ??= Promise.resolve().then(() =>
      this.makeQuery(new SparqlClient({ endpointUrl: this.endpointUrl }))
    ));
  }

  public then<TFulfilled = Result, TRejected = never>(
    onfulfilled?: ((value: Result) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onrejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TFulfilled | TRejected> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
