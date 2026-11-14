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
import { qleverDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './functions.js';
export * from './paths.js';
export * from './rows.js';
export * from './spatial.js';
export * from './text.js';
export * from './types.js';
export * from './units.js';

/** Options for creating a database with the QLever dialect: `sparkql` options minus `dialect`. */
export type QleverDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Omit<BaseSparqlDatabaseOptions<T, F, typeof qleverDialect, X>, 'dialect'>;

/** Options for `SparqlDatabase.create` in `sparkql/qlever`; see {@link QleverDatabaseOptions}. */
export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = QleverDatabaseOptions<T, F, X>;

/** A database configured with the QLever dialect. */
export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
  X extends TermCodecs = {},
> = WithQueryMethods<BaseSparqlDatabase<T, R, F, typeof qleverDialect, C, X>, typeof qleverDialect>;

/**
 * Creates a database with the QLever dialect enabled.
 *
 * It takes the same options as `SparqlDatabase.create` from `sparkql`, except `dialect`. Builders
 * also accept the QLever patterns: {@link containsWord}, {@link containsEntity},
 * {@link textSearch}, {@link pathSearch}, {@link spatialSearch} and {@link rowNumber}. This entry point re-exports everything from `sparkql`.
 *
 * @param options - Database configuration, including a ready `sparql-http-client` instance.
 *
 * @example
 * Connect to a QLever server that holds people data. Updates need its access token.
 *
 * ```ts
 * import { SparqlDatabase } from 'sparkql/qlever';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({
 *   connection: {
 *     endpointUrl: 'http://localhost:7001/',
 *     headers: { authorization: 'Bearer my-access-token' },
 *   },
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
  options: QleverDatabaseOptions<T, F, X> & { client: C }
): SparqlDatabase<T, K, WithCodecFormats<F, X>, C, X>;
/**
 * Creates a database with the QLever dialect enabled.
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
  options?: QleverDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, DefaultSparqlClient, X>;
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(
  options?: QleverDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, AnySparqlClient, X> {
  return BaseSparqlDatabase.create<T, K, F, typeof qleverDialect, X>({
    ...options,
    dialect: qleverDialect,
  });
}

/** Creates databases with the QLever dialect enabled; this entry point re-exports `sparkql`. */
export const SparqlDatabase = { create };
