import type { DataFactory } from 'rdf-data-factory';
import type { DefaultQueryReturnType } from '../helpers/types.js';

/** One SELECT solution: variable names (without `?`) mapped to RDF/JS terms. Unbound variables are absent. */
export type SparqlBindings = Readonly<Record<string, DefaultQueryReturnType | undefined>>;
/** An RDF/JS quad, as returned by CONSTRUCT and DESCRIBE. */
export type SparqlQuad = ReturnType<DataFactory['quad']>;

/** Options for requesting graph results. */
export interface SparqlQuadsOptions {
  /** Media type to request instead of the session's default graph format. */
  accept?: string;
}
/** Options for requesting an undecoded response. */
export interface SparqlRawOptions {
  /** Media type the caller will decode. */
  accept: string;
}

/**
 * Runs generated SPARQL. Builders only produce a string and decode results;
 * a session owns the transport. There is one method per result format, not
 * per query form, so custom query forms reuse the format they need.
 */
export interface SparqlSession {
  /**
   * Returns the target URL for logging, if available.
   *
   * @param kind - The request kind.
   *
   * @example
   * Find the URL used for a query request.
   *
   * ```ts
   * const session = {} as SparqlSession;
   * void session.getRequestUrl?.('query');
   * ```
   */
  getRequestUrl?(kind: 'query' | 'update'): string | undefined;
  /**
   * Runs a query and returns its solution bindings.
   *
   * @param sparql - The SPARQL query.
   *
   * @example
   * Request bindings from a session.
   *
   * ```ts
   * const session = {} as SparqlSession;
   * void session.bindings('SELECT * WHERE {}');
   * ```
   */
  bindings(sparql: string): Promise<SparqlBindings[]>;
  /**
   * Runs a query and returns its boolean result.
   *
   * @param sparql - The SPARQL query.
   *
   * @example
   * Request a boolean answer from a session.
   *
   * ```ts
   * const session = {} as SparqlSession;
   * void session.boolean('ASK {}');
   * ```
   */
  boolean(sparql: string): Promise<boolean>;
  /**
   * Runs a query and returns its RDF quads.
   *
   * @param sparql - The SPARQL query.
   * @param options - The requested response format.
   *
   * @example
   * Request quads from a session.
   *
   * ```ts
   * const session = {} as SparqlSession;
   * void session.quads('CONSTRUCT WHERE {}');
   * ```
   */
  quads(sparql: string, options?: SparqlQuadsOptions): Promise<SparqlQuad[]>;
  /**
   * Runs a SPARQL Update request.
   *
   * @param sparql - The SPARQL update.
   *
   * @example
   * Send an update through a session.
   *
   * ```ts
   * const session = {} as SparqlSession;
   * void session.update('CLEAR DEFAULT');
   * ```
   */
  update(sparql: string): Promise<void>;
  /**
   * Runs a query and returns its undecoded response.
   *
   * The response is returned regardless of status; callers check `ok` and decode it.
   *
   * @param sparql - The SPARQL query.
   * @param options - The requested response format.
   *
   * @example
   * Request a raw response with a JSON accept header.
   *
   * ```ts
   * const session = {} as SparqlSession;
   * void session.raw('ASK {}', { accept: 'application/json' });
   * ```
   */
  raw(sparql: string, options: SparqlRawOptions): Promise<Response>;
}

const SESSION_METHODS = ['bindings', 'boolean', 'quads', 'update', 'raw'] as const;

/**
 * Checks whether a value implements the session methods.
 *
 * The check tests for callable methods, not their signatures or behavior.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Check a candidate session.
 *
 * ```ts
 * const candidate: unknown = db.$session;
 * const valid = isSparqlSession(candidate);
 * ```
 */
export function isSparqlSession(value: unknown): value is SparqlSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    SESSION_METHODS.every(name => typeof (value as Record<string, unknown>)[name] === 'function')
  );
}
