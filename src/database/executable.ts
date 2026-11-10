import { type CommentInput, encodeComment } from './comment.js';
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
  /** Logger used for session requests, when enabled. */
  readonly logger?: Logger;
  /** Dialect query factory name, used in log metadata. */
  readonly operationName?: string;
  /** Repeat the SPARQL in `SparkqlQueryError.message`. */
  readonly queryInErrors?: boolean;
}

/** Shared execution lifecycle for standard and dialect-defined query forms. */
export abstract class ExecutableQuery<Result> implements PromiseLike<Result> {
  private commentLines: string[] = [];
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

  /**
   * Appends a sanitized SPARQL comment line before the query.
   *
   * @param input - Text or key-value metadata to encode.
   *
   * @example
   * Attach a source label to an ASK query.
   *
   * ```ts
   * db.ask().comment({ source: 'people' });
   * ```
   *
   * ```sparql
   * #source='people'
   * ASK WHERE {
   * }
   * ```
   */
  public comment(input: CommentInput): this {
    const text = encodeComment(input);
    if (text) this.commentLines.push(text);
    return this;
  }

  /** Operation builders belonging to the same update share request comments. */
  protected inheritComments(parent: ExecutableQuery<unknown>): void {
    this.commentLines = parent.commentLines;
  }

  /** Traqula does not carry comments in its AST; decorate the generated request. */
  protected withComments(sparql: string): string {
    return this.commentLines.map(line => `#${line}\n`).join('') + sparql;
  }

  protected get operationName(): string {
    return this.moduleName;
  }

  /**
   * Returns the query's AST without executing it; use `toSPARQL()` for the text.
   *
   * @example
   * Inspect a builder's AST without sending a request.
   *
   * ```ts
   * const ast = db
   *   .select({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .getSPARQL();
   * ```
   */
  public abstract getSPARQL(): unknown;
  /**
   * Returns the generated SPARQL without executing it.
   *
   * @example
   * Inspect a builder without sending a request.
   *
   * ```ts
   * db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name)).toSPARQL();
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
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
   *
   * @example
   * Execute an ASK query through the session.
   *
   * ```ts
   * const query = db.ask();
   * const result = await query.execute(); // true or false
   * ```
   *
   * ```sparql
   * ASK WHERE {
   * }
   * ```
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

  /**
   * Executes the query and chains callbacks to its result.
   *
   * Every call and every await sends a new request; results are not cached.
   *
   * @param onfulfilled - Callback for a successful result.
   * @param onrejected - Callback for a rejection.
   *
   * @example
   * Handle the boolean result of an ASK query.
   *
   * ```ts
   * const result = await db.ask().then(value => value); // true or false
   * ```
   *
   * ```sparql
   * ASK WHERE {
   * }
   * ```
   */
  // biome-ignore lint/suspicious/noThenProperty: Queries intentionally implement PromiseLike for await.
  public then<TFulfilled = Result, TRejected = never>(
    onfulfilled?: ((value: Result) => TFulfilled | PromiseLike<TFulfilled>) | null,
    onrejected?: ((reason: any) => TRejected | PromiseLike<TRejected>) | null
  ): Promise<TFulfilled | TRejected> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
