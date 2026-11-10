import type { SparqlQuadsOptions, SparqlRawOptions, SparqlSession } from './session.js';

/** Metadata supplied with a logged request. */
export interface QueryLogMeta {
  /** Standard query form (e.g. `select`, `update`) or dialect query factory name. */
  readonly operation: string;
  /** Target endpoint, when the session can provide one. */
  readonly targetUrl: string | undefined;
}

/** Integration point for application logging. SPARQL values are inlined in the string. */
export interface Logger {
  /**
   * Records a request before it is sent.
   *
   * Throwing prevents the request. The SPARQL can contain inlined values.
   *
   * @param sparql - Generated SPARQL.
   * @param meta - Operation and optional target URL.
   *
   * @example
   * Supply a logger.
   *
   * ```ts
   * const logger: Logger = { logQuery: (sparql, meta) => console.log(sparql, meta) };
   * ```
   */
  logQuery(sparql: string, meta: QueryLogMeta): void;
}

/** Destination for formatted log messages. */
export interface LogWriter {
  /**
   * Writes a formatted message.
   *
   * @param message - The message to write.
   *
   * @example
   * Supply a writer.
   *
   * ```ts
   * const writer: LogWriter = { write: message => console.log(message) };
   * ```
   */
  write(message: string): void;
}

/** Writes log messages to the console. */
export class ConsoleLogWriter implements LogWriter {
  /**
   * Writes a message to the console.
   *
   * @param message - The message to write.
   *
   * @example
   * Write a message.
   *
   * ```ts
   * new ConsoleLogWriter().write('Query');
   * ```
   */
  write(message: string): void {
    console.log(message);
  }
}

/** Formats requests and writes them to a log writer. */
export class DefaultLogger implements Logger {
  /** Destination for formatted messages. */
  readonly writer: LogWriter;

  /**
   * Creates a logger with a console writer by default.
   *
   * @param config - Custom destination for formatted messages.
   *
   * @example
   * Create a logger.
   *
   * ```ts
   * const logger = new DefaultLogger();
   * ```
   */
  constructor(config?: { writer: LogWriter }) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }

  /**
   * Formats and writes a request with its operation and optional URL.
   *
   * @param sparql - Generated SPARQL.
   * @param meta - Operation and optional target URL.
   *
   * @example
   * Log a request.
   *
   * ```ts
   * new DefaultLogger().logQuery('ASK {}', { operation: 'ask', targetUrl: undefined });
   * ```
   */
  logQuery(sparql: string, meta: QueryLogMeta): void {
    this.writer.write(
      `Query (${meta.operation}${meta.targetUrl ? ` @ ${meta.targetUrl}` : ''}): ${sparql}`
    );
  }
}

/** Discards logged requests. */
export class NoopLogger implements Logger {
  /**
   * Discards a request.
   *
   * @example
   * Use a logger that discards requests.
   *
   * ```ts
   * new NoopLogger().logQuery();
   * ```
   */
  logQuery(): void {}
}

/** @internal Only allocated when logging is enabled; logs each session request once. */
export class LoggingSparqlSession implements SparqlSession {
  constructor(
    private readonly session: SparqlSession,
    private readonly logger: Logger,
    private readonly operation: string
  ) {}

  private log(sparql: string, kind: 'query' | 'update' = 'query'): void {
    this.logger.logQuery(sparql, {
      operation: this.operation,
      targetUrl: this.session.getRequestUrl?.(kind),
    });
  }

  bindings(sparql: string): ReturnType<SparqlSession['bindings']> {
    this.log(sparql);
    return this.session.bindings(sparql);
  }

  boolean(sparql: string): ReturnType<SparqlSession['boolean']> {
    this.log(sparql);
    return this.session.boolean(sparql);
  }

  quads(sparql: string, options?: SparqlQuadsOptions): ReturnType<SparqlSession['quads']> {
    this.log(sparql);
    return this.session.quads(sparql, options);
  }

  update(sparql: string): ReturnType<SparqlSession['update']> {
    this.log(sparql, 'update');
    return this.session.update(sparql);
  }

  raw(sparql: string, options: SparqlRawOptions): ReturnType<SparqlSession['raw']> {
    this.log(sparql);
    return this.session.raw(sparql, options);
  }
}
