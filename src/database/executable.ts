import { is } from './entity.js';
import { SparkqlError, SparkqlQueryError } from './errors.js';
import { type Logger, LoggingSparqlSession } from './logger.js';
import type { SparqlSession } from './session.js';

const MISSING_SESSION_MESSAGE =
  'This database is build-only: it has no session to execute queries with. ' +
  'Pass `connection`, `client` or `session` to SparqlDatabase.create().';

/** What execution needs from the database. A subset of `QueryModuleContext`. */
export interface ExecutionContext {
  /** Transport for execution. Absent on build-only databases. */
  readonly session?: SparqlSession;
  readonly logger?: Logger;
  /** Dialect query factory name, used in log metadata. */
  readonly operationName?: string;
  /** Repeat the SPARQL in `SparkqlQueryError.message`. */
  readonly queryInErrors?: boolean;
}

/** Shared execution lifecycle for standard and dialect-defined query forms. */
export abstract class ExecutableQuery<Result> implements PromiseLike<Result> {
  protected readonly session: SparqlSession | undefined;
  private readonly queryInErrors: boolean;
  private readonly logger: Logger | undefined;
  private readonly moduleName: string;

  protected constructor(context: ExecutionContext) {
    this.session = context.session;
    this.logger = context.logger;
    this.moduleName = context.operationName ?? 'query';
    this.queryInErrors = context.queryInErrors ?? false;
  }

  protected get operationName(): string {
    return this.moduleName;
  }

  public abstract getSPARQL(): unknown;
  public abstract toSPARQL(): string;
  /** Runs the generated `sparql` through `session` and decodes the result. */
  protected abstract makeQuery(session: SparqlSession, sparql: string): Promise<Result>;

  /**
   * Sends the query through the database's session. Every call, and so every
   * `await` of the builder, sends a new request; nothing is cached.
   *
   * Rejects with a `SparkqlError` on a build-only database, with whatever
   * generating the SPARQL throws (e.g. `SparkqlNormalizationError`), and with a
   * `SparkqlQueryError` for any failure after that: in the session or while
   * decoding the result.
   */
  public async execute(): Promise<Result> {
    if (!this.session) throw new SparkqlError({ message: MISSING_SESSION_MESSAGE });
    const sparql = this.toSPARQL();
    return this.executeSPARQL(sparql);
  }

  /** Shared transport, logging and error handling for prepared execution. */
  protected async executeSPARQL(sparql: string): Promise<Result> {
    if (!this.session) throw new SparkqlError({ message: MISSING_SESSION_MESSAGE });
    try {
      const session = this.logger
        ? new LoggingSparqlSession(this.session, this.logger, this.operationName)
        : this.session;
      return await this.makeQuery(session, sparql);
    } catch (error) {
      if (is(error, SparkqlQueryError)) throw error;
      throw new SparkqlQueryError({
        query: sparql,
        cause: error,
        queryInMessage: this.queryInErrors,
      });
    }
  }

  // biome-ignore lint/suspicious/noThenProperty: Queries intentionally implement PromiseLike for await.
  public then<TFulfilled = Result, TRejected = never>(
    onfulfilled?: ((value: Result) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onrejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TFulfilled | TRejected> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
