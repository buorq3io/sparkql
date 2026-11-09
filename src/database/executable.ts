import type { SparqlSession } from './session.js';

const MISSING_SESSION_MESSAGE =
  'This database is build-only: it has no session to execute queries with. ' +
  'Pass `connection`, `client` or `session` to SparqlDatabase.create().';

/** Shared execution lifecycle for standard and dialect-defined query forms. */
export abstract class ExecutableQuery<Result> implements PromiseLike<Result> {
  protected constructor(protected readonly session: SparqlSession | undefined) {}

  public abstract getSPARQL(): unknown;
  public abstract toSPARQL(): string;
  protected abstract makeQuery(session: SparqlSession): Promise<Result>;

  /**
   * Sends the query through the database's session. Every call, and so every
   * `await` of the builder, sends a new request; nothing is cached.
   */
  public async execute(): Promise<Result> {
    if (!this.session) throw new Error(MISSING_SESSION_MESSAGE);
    return this.makeQuery(this.session);
  }

  // biome-ignore lint/suspicious/noThenProperty: Queries intentionally implement PromiseLike for await.
  public then<TFulfilled = Result, TRejected = never>(
    onfulfilled?: ((value: Result) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onrejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TFulfilled | TRejected> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
