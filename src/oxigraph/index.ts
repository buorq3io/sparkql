import type {
  AnySparqlClient,
  SparqlDatabaseOptions as BaseSparqlDatabaseOptions,
  DefaultSparqlClient,
} from '../database/base.js';
import { SparqlDatabase as BaseSparqlDatabase } from '../database/base.js';
import type { SparqlHttpClient } from '../database/http-session.js';
import type { WithQueryMethods } from '../database/query-module.js';
import type { TermCodecs, WithCodecFormats } from '../helpers/codecs.js';
import type { TermFormats } from '../helpers/term-formats.js';
import type { IriManagerConfig } from '../structures/iri.js';
import { oxigraphDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './functions.js';

/** Options for creating a database with the Oxigraph dialect: `sparkql` options minus `dialect`. */
export type OxigraphDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Omit<BaseSparqlDatabaseOptions<T, F, typeof oxigraphDialect, X>, 'dialect'>;

/** Options for `SparqlDatabase.create` in `sparkql/oxigraph`; see {@link OxigraphDatabaseOptions}. */
export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = OxigraphDatabaseOptions<T, F, X>;

/** A database configured with the Oxigraph dialect. */
export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
  X extends TermCodecs = {},
> = WithQueryMethods<
  BaseSparqlDatabase<T, R, F, typeof oxigraphDialect, C, X>,
  typeof oxigraphDialect
>;

/**
 * Creates a database with the Oxigraph dialect enabled.
 *
 * It takes the same options as `SparqlDatabase.create` from `sparkql`, except `dialect`. Builders
 * also accept the {@link lateral} pattern. This entry point re-exports everything from `sparkql`.
 *
 * @param options - Database configuration, including a ready `sparql-http-client` instance.
 *
 * @example
 * Connect to an Oxigraph server that holds people data.
 *
 * ```ts
 * import { SparqlDatabase } from 'sparkql/oxigraph';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({
 *   connection: { endpointUrl: 'http://localhost:7878/query', updateUrl: 'http://localhost:7878/update' },
 *   managerConfig: prefixes,
 * });
 * ```
 */
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  C extends SparqlHttpClient = SparqlHttpClient,
  X extends TermCodecs = {},
>(
  options: OxigraphDatabaseOptions<T, F, X> & { client: C }
): SparqlDatabase<T, K, WithCodecFormats<F, X>, C, X>;
/**
 * Creates a database with the Oxigraph dialect enabled.
 *
 * See the first overload for details.
 *
 * @param options - Database configuration, including an optional transport. Without one the
 * database is build-only: queries generate SPARQL and reject when awaited.
 */
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(
  options?: OxigraphDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, DefaultSparqlClient, X>;
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(
  options?: OxigraphDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, AnySparqlClient, X> {
  return BaseSparqlDatabase.create<T, K, F, typeof oxigraphDialect, X>({
    ...options,
    dialect: oxigraphDialect,
  });
}

/** Creates databases with the Oxigraph dialect enabled; this entry point re-exports `sparkql`. */
export const SparqlDatabase = { create };
