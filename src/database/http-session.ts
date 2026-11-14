import { Readable } from 'node:stream';
import type { ParsingClient, StreamClient } from 'sparql-http-client';
import { entityKind, is } from './entity.js';
import { SparkqlError } from './errors.js';
import type {
  SparqlBindings,
  SparqlQuad,
  SparqlQuadsOptions,
  SparqlRawOptions,
  SparqlSession,
} from './session.js';

/** A `sparql-http-client` client: the default `StreamClient` or a `ParsingClient`. */
export type SparqlHttpClient = StreamClient | ParsingClient;
/** @deprecated Use {@link SparqlHttpClient}. */
export type SparqlClient = StreamClient;

/** Options for the default HTTP session. */
export interface SparqlConnectionOptions {
  /** SPARQL query endpoint. */
  endpointUrl?: string;
  /**
   * SPARQL update endpoint.
   *
   * @defaultValue `endpointUrl`
   */
  updateUrl?: string;
  /** Headers sent with every request. */
  headers?: HeadersInit;
  /** User for HTTP basic authentication. */
  user?: string;
  /** Password for HTTP basic authentication. */
  password?: string;
  /** `fetch` implementation, e.g. to add timeouts, retries or request signing. */
  fetch?: typeof fetch;
}

type RawClient = SparqlHttpClient & {
  postDirect(
    query: string,
    options?: { headers?: HeadersInit; parameters?: Readonly<Record<string, string>> }
  ): Promise<Response>;
};

/** The default session: SPARQL 1.1 Protocol over HTTP through `sparql-http-client`. */
export class HttpSparqlSession<C extends SparqlHttpClient = SparqlHttpClient>
  implements SparqlSession
{
  static readonly [entityKind]: string = 'HttpSparqlSession';

  static [Symbol.hasInstance](value: unknown): boolean {
    return is(value, this);
  }

  private resolved: C | Promise<C> | undefined;
  private readonly connection: SparqlConnectionOptions | undefined;

  /**
   * Creates an HTTP session from a client or connection options.
   *
   * A connection must supply at least one endpoint URL. Query methods require
   * `endpointUrl`; the client is created lazily.
   *
   * @param config - A client to reuse or connection options.
   * @throws {@link SparkqlError} When neither endpoint URL is provided.
   *
   * @example
   * Configure a session.
   *
   * ```ts
   * const session = new HttpSparqlSession({ connection: 'https://example.org/sparql' });
   * ```
   */
  constructor(config: { client: C } | { connection: string | SparqlConnectionOptions }) {
    if ('client' in config) {
      this.resolved = config.client;
      return;
    }
    const connection =
      typeof config.connection === 'string'
        ? { endpointUrl: config.connection }
        : { ...config.connection };
    if (!connection.endpointUrl && !connection.updateUrl)
      throw new SparkqlError({ message: 'A connection requires `endpointUrl` or `updateUrl`.' });
    this.connection = connection;
  }

  /**
   * The underlying client. A client passed to the constructor is returned as
   * is; one created from connection options is loaded on first use, so it is a
   * promise. `await session.client` works for both.
   */
  get client(): C | Promise<C> {
    // The client is ESM-only; dynamic import also works in the CommonJS build.
    this.resolved ??= import('sparql-http-client').then(({ default: Client }) => {
      const { fetch: customFetch, updateUrl, ...options } = this.connection!;
      return new Client({
        ...options,
        updateUrl: updateUrl ?? options.endpointUrl,
        ...(customFetch ? { fetch: nodeifyFetch(customFetch) } : {}),
      }) as unknown as C;
    });
    return this.resolved;
  }

  /**
   * Returns the configured request URL.
   *
   * @param kind - The request kind.
   *
   * @example
   * Find the endpoint URL for a query request.
   *
   * ```ts
   * const session = new HttpSparqlSession({ connection: 'https://example.org/sparql' });
   * void session.getRequestUrl('query');
   * ```
   */
  getRequestUrl(kind: 'query' | 'update'): string | undefined {
    if (this.connection) {
      return kind === 'update'
        ? (this.connection.updateUrl ?? this.connection.endpointUrl)
        : this.connection.endpointUrl;
    }
    // A supplied client is already available; do not load a lazy client for logging.
    const client = this.resolved as C;
    return kind === 'update' ? client.updateUrl : client.endpointUrl;
  }

  /**
   * Runs a query and collects its solution bindings.
   *
   * @param sparql - The SPARQL query.
   *
   * @example
   * Request result bindings from the endpoint.
   *
   * ```ts
   * const session = new HttpSparqlSession({ connection: 'https://example.org/sparql' });
   * void session.bindings('SELECT * WHERE {}');
   * ```
   */
  async bindings(sparql: string): Promise<SparqlBindings[]> {
    const client = await this.queryClient();
    return collect<SparqlBindings>(client.query.select(sparql));
  }

  /**
   * Runs a query and returns its boolean result.
   *
   * @param sparql - The SPARQL query.
   *
   * @example
   * Request a boolean answer from the endpoint.
   *
   * ```ts
   * const session = new HttpSparqlSession({ connection: 'https://example.org/sparql' });
   * void session.boolean('ASK {}');
   * ```
   */
  async boolean(sparql: string): Promise<boolean> {
    const client = await this.queryClient();
    return client.query.ask(sparql);
  }

  /**
   * Runs a query and collects its RDF quads.
   *
   * @param sparql - The SPARQL query.
   * @param options - The requested graph format.
   *
   * @example
   * Request constructed quads from the endpoint.
   *
   * ```ts
   * const session = new HttpSparqlSession({ connection: 'https://example.org/sparql' });
   * void session.quads('CONSTRUCT WHERE {}');
   * ```
   */
  async quads(sparql: string, options?: SparqlQuadsOptions): Promise<SparqlQuad[]> {
    const client = await this.queryClient();
    return collect<SparqlQuad>(
      client.query.construct(
        sparql,
        // A non-default format is requested with a direct POST, like raw().
        options?.accept
          ? { operation: 'postDirect', headers: { accept: options.accept } }
          : undefined
      )
    );
  }

  /**
   * Runs a SPARQL Update request.
   *
   * @param sparql - The SPARQL update.
   *
   * @example
   * Clear the default graph through the endpoint.
   *
   * ```ts
   * const session = new HttpSparqlSession({ connection: 'https://example.org/sparql' });
   * void session.update('CLEAR DEFAULT');
   * ```
   */
  async update(sparql: string): Promise<void> {
    const client = await this.client;
    await client.query.update(sparql);
  }

  /**
   * Returns the undecoded response to a direct POST.
   *
   * `options.parameters` are added to the endpoint URL's query string.
   *
   * @param sparql - The SPARQL query.
   * @param options - The requested response format and extra URL parameters.
   *
   * @example
   * Request a raw boolean response as JSON.
   *
   * ```ts
   * const session = new HttpSparqlSession({ connection: 'https://example.org/sparql' });
   * void session.raw('ASK {}', { accept: 'application/json' });
   * ```
   */
  async raw(sparql: string, options: SparqlRawOptions): Promise<Response> {
    const client = (await this.queryClient()) as RawClient;
    return client.postDirect(sparql, {
      headers: { accept: options.accept },
      parameters: options.parameters,
    });
  }

  private async queryClient(): Promise<C> {
    if (this.connection && !this.connection.endpointUrl)
      throw new SparkqlError({
        message:
          'This connection has no `endpointUrl` to send queries to; only `updateUrl` is set.',
      });
    return this.client;
  }
}

/** Stream clients yield rows as they arrive; parsing clients resolve to the full result. */
async function collect<T>(result: unknown): Promise<T[]> {
  const items: T[] = [];
  for await (const item of (await result) as AsyncIterable<T> | Iterable<T>) items.push(item);
  return items;
}

/**
 * `sparql-http-client` pipes response bodies as Node streams. Standard `fetch`
 * implementations return web streams, so expose those bodies as Node streams.
 */
function nodeifyFetch(customFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await customFetch(input, init);
    const body = response.body as (ReadableStream & { pipe?: unknown }) | null;
    if (!body || typeof body.pipe === 'function') return response;
    let stream: Readable | undefined;
    return new Proxy(response, {
      get(target, key) {
        if (key === 'body') {
          stream ??= Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
          return stream;
        }
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
}
