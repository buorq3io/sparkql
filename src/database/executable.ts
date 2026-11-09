import type SparqlClient from 'sparql-http-client';

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
    // The client is ESM-only; dynamic import also works in the CommonJS build.
    this._promise ??= import('sparql-http-client').then(({ default: Client }) =>
      this.makeQuery(new Client({ endpointUrl: this.endpointUrl }))
    );
    return this._promise;
  }

  // biome-ignore lint/suspicious/noThenProperty: Queries intentionally implement PromiseLike for await.
  public then<TFulfilled = Result, TRejected = never>(
    onfulfilled?: ((value: Result) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onrejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TFulfilled | TRejected> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
