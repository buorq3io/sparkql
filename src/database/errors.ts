import { entityKind, is } from './entity.js';

/** Longest response body kept on a {@link SparkqlQueryError}, in characters. */
export const MAX_ERROR_BODY_LENGTH = 4096;
/** Longest cause message repeated in a {@link SparkqlQueryError} message, in characters. */
const MAX_CAUSE_MESSAGE_LENGTH = 500;

/** Base class of every error sparkql throws itself. */
export class SparkqlError extends Error {
  static readonly [entityKind]: string = 'SparkqlError';

  static override [Symbol.hasInstance](value: unknown): boolean {
    return is(value, this);
  }

  /** The error that led to this one, if any. */
  readonly cause: unknown;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super(message);
    this.name = 'SparkqlError';
    this.cause = cause;
  }
}

/** Options for a failed query error. */
export interface SparkqlQueryErrorOptions {
  /** The SPARQL that was sent. */
  query: string;
  /** What the session or the result decoder threw. */
  cause: unknown;
  /**
   * Repeat `query` in `message`; the query text can contain user data.
   *
   * @defaultValue `false`
   */
  queryInMessage?: boolean;
}

/**
 * A query was generated but running it failed: the session rejected (network,
 * HTTP status, engine error) or its result could not be decoded.
 *
 * `query` always holds the SPARQL. It contains every value inlined into the
 * query (VALUES rows, literals), so `message` repeats it only when the database
 * was created with `queryInErrors: true`.
 */
export class SparkqlQueryError extends SparkqlError {
  static override readonly [entityKind]: string = 'SparkqlQueryError';

  /** The SPARQL that was sent; equal to the builder's `toSPARQL()`. */
  readonly query: string;
  /** HTTP status of the failed response, when the session reported one. */
  readonly status: number | undefined;
  /**
   * Body of the failed response, cut to {@link MAX_ERROR_BODY_LENGTH}
   * characters, when the session reported one. Endpoints often echo the query
   * in it.
   */
  readonly body: string | undefined;

  constructor({ query, cause, queryInMessage = false }: SparkqlQueryErrorOptions) {
    const { status, statusText, body } = responseDetails(cause);
    // A response body can echo the query, so HTTP failures name only the status.
    const reason = status === undefined ? causeMessage(cause) : '';
    super({
      message:
        'Failed SPARQL query' +
        (status === undefined ? '' : ` (HTTP ${status}${statusText ? ` ${statusText}` : ''})`) +
        (reason ? `: ${reason}` : '') +
        (queryInMessage ? `\nquery: ${query}` : ''),
      cause,
    });
    this.name = 'SparkqlQueryError';
    this.query = query;
    this.status = status;
    this.body = body?.slice(0, MAX_ERROR_BODY_LENGTH);
  }
}

/**
 * A non-2xx response that `session.raw()` returned, as rejected by
 * {@link requestQueryJson}. Execution wraps it in a {@link SparkqlQueryError}.
 */
export class SparqlResponseError extends SparkqlError {
  static override readonly [entityKind]: string = 'SparqlResponseError';

  /** HTTP status code. */
  readonly status: number;
  /** HTTP status text. */
  readonly statusText: string;
  /** Response body, cut to {@link MAX_ERROR_BODY_LENGTH} characters. */
  readonly body: string;

  constructor({ status, statusText, body }: { status: number; statusText: string; body: string }) {
    super({ message: `SPARQL endpoint responded ${status}${statusText ? ` ${statusText}` : ''}` });
    this.name = 'SparqlResponseError';
    this.status = status;
    this.statusText = statusText;
    this.body = body.slice(0, MAX_ERROR_BODY_LENGTH);
  }
}

/** What was being normalised when a {@link SparkqlNormalizationError} was thrown. */
export type NormalizationInputKind =
  | 'query'
  | 'update'
  | 'expression'
  | 'property path'
  | 'term'
  | 'pattern';

/** Builder input could not be turned into a SPARQL AST node. */
export class SparkqlNormalizationError extends SparkqlError {
  static override readonly [entityKind]: string = 'SparkqlNormalizationError';

  /** The rejected input node. */
  readonly input: unknown;
  /** The input's `type`, if it has one. */
  readonly inputType: string | undefined;
  /** The input's `subType`, if it has one. */
  readonly inputSubType: string | undefined;

  constructor(kind: NormalizationInputKind, input: unknown) {
    const inputType = stringField(input, 'type');
    const inputSubType = stringField(input, 'subType');
    const described = [
      inputType === undefined ? undefined : `type "${inputType}"`,
      inputSubType === undefined ? undefined : `subType "${inputSubType}"`,
    ].filter(Boolean);
    super({
      message:
        `Unsupported ${kind} provided` +
        (described.length ? ` (${described.join(', ')}).` : ` (${describeValue(input)}).`),
    });
    this.name = 'SparkqlNormalizationError';
    this.input = input;
    this.inputType = inputType;
    this.inputSubType = inputSubType;
  }
}

interface ResponseDetails {
  status?: number;
  statusText?: string;
  body?: string;
}

/**
 * Status and body of a failed HTTP response. Reads `status`, `statusText` and
 * `body` properties, which {@link SparqlResponseError} has. `sparql-http-client`
 * sets only `status` and writes `<statusText> (<status>): <body>` as its message.
 */
function responseDetails(cause: unknown): ResponseDetails {
  if (typeof cause !== 'object' || cause === null) return {};
  const { status, statusText, body, message } = cause as Record<string, unknown>;
  if (typeof status !== 'number') return {};
  if (typeof body === 'string')
    return { status, body, statusText: typeof statusText === 'string' ? statusText : undefined };
  if (typeof message === 'string') {
    const marker = ` (${status}): `;
    const at = message.indexOf(marker);
    if (at !== -1)
      return {
        status,
        statusText: message.slice(0, at) || undefined,
        body: message.slice(at + marker.length),
      };
  }
  return { status };
}

function causeMessage(cause: unknown): string {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === 'string'
        ? cause
        : cause === undefined
          ? ''
          : describeValue(cause);
  return message.length > MAX_CAUSE_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_CAUSE_MESSAGE_LENGTH)}…`
    : message;
}

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : undefined;
}

/** Names the kind of a value without its content, which may be user data. */
function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return `${value.constructor?.name ?? 'object'}`;
  return typeof value;
}
