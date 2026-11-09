import { Readable } from 'node:stream';
import type { ParsingClient, StreamClient } from 'sparql-http-client';
import { entityKind, is } from './entity.js';
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
  /** SPARQL update endpoint. Defaults to `endpointUrl`. */
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
  postDirect(query: string, options?: { headers?: HeadersInit }): Promise<Response>;
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
      throw new Error('A connection requires `endpointUrl` or `updateUrl`.');
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

  async bindings(sparql: string): Promise<SparqlBindings[]> {
    const client = await this.queryClient();
    return collect<SparqlBindings>(client.query.select(sparql));
  }

  async boolean(sparql: string): Promise<boolean> {
    const client = await this.queryClient();
    return client.query.ask(sparql);
  }

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

  async update(sparql: string): Promise<void> {
    const client = await this.client;
    await client.query.update(sparql);
  }

  async raw(sparql: string, options: SparqlRawOptions): Promise<Response> {
    const client = (await this.queryClient()) as RawClient;
    return client.postDirect(sparql, { headers: { accept: options.accept } });
  }

  private async queryClient(): Promise<C> {
    if (this.connection && !this.connection.endpointUrl)
      throw new Error(
        'This connection has no `endpointUrl` to send queries to; only `updateUrl` is set.'
      );
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
