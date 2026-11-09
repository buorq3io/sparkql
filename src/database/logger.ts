import type { SparqlQuadsOptions, SparqlRawOptions, SparqlSession } from './session.js';

export interface QueryLogMeta {
  /** Standard query form (e.g. `select`, `update`) or dialect query factory name. */
  readonly operation: string;
  /** Target endpoint, when the session can provide one. */
  readonly targetUrl: string | undefined;
}

/** Integration point for application logging. SPARQL values are inlined in the string. */
export interface Logger {
  logQuery(sparql: string, meta: QueryLogMeta): void;
}

export interface LogWriter {
  write(message: string): void;
}

export class ConsoleLogWriter implements LogWriter {
  write(message: string): void {
    console.log(message);
  }
}

export class DefaultLogger implements Logger {
  readonly writer: LogWriter;

  constructor(config?: { writer: LogWriter }) {
    this.writer = config?.writer ?? new ConsoleLogWriter();
  }

  logQuery(sparql: string, meta: QueryLogMeta): void {
    this.writer.write(
      `Query (${meta.operation}${meta.targetUrl ? ` @ ${meta.targetUrl}` : ''}): ${sparql}`
    );
  }
}

export class NoopLogger implements Logger {
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
