import type { DataFactory } from 'rdf-data-factory';
import type { DefaultQueryReturnType } from '../helpers/types.js';

/** One SELECT solution: variable names (without `?`) mapped to RDF/JS terms. Unbound variables are absent. */
export type SparqlBindings = Readonly<Record<string, DefaultQueryReturnType | undefined>>;
/** An RDF/JS quad, as returned by CONSTRUCT and DESCRIBE. */
export type SparqlQuad = ReturnType<DataFactory['quad']>;

export interface SparqlQuadsOptions {
  /** Media type to request instead of the session's default graph format. */
  accept?: string;
}
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
  /** Runs a query whose result is a solution sequence (SELECT). */
  bindings(sparql: string): Promise<SparqlBindings[]>;
  /** Runs a query whose result is a boolean (ASK). */
  boolean(sparql: string): Promise<boolean>;
  /** Runs a query whose result is an RDF graph or dataset (CONSTRUCT, DESCRIBE). */
  quads(sparql: string, options?: SparqlQuadsOptions): Promise<SparqlQuad[]>;
  /** Runs a SPARQL Update request. */
  update(sparql: string): Promise<void>;
  /**
   * Runs a query and returns the undecoded response, for result formats the
   * other methods do not cover. The response is returned whatever its status;
   * callers check `ok` and decode the body.
   */
  raw(sparql: string, options: SparqlRawOptions): Promise<Response>;
}

const SESSION_METHODS = ['bindings', 'boolean', 'quads', 'update', 'raw'] as const;

export function isSparqlSession(value: unknown): value is SparqlSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    SESSION_METHODS.every(name => typeof (value as Record<string, unknown>)[name] === 'function')
  );
}
