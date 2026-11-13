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
import { neptuneDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './hints.js';

/** Options for creating a database with the Neptune dialect: `sparkql` options minus `dialect`. */
export type NeptuneDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Omit<BaseSparqlDatabaseOptions<T, F, typeof neptuneDialect, X>, 'dialect'>;

/** Options for `SparqlDatabase.create` in `sparkql/neptune`; see {@link NeptuneDatabaseOptions}. */
export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = NeptuneDatabaseOptions<T, F, X>;

/** A database configured with the Neptune dialect and its query methods. */
export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
  X extends TermCodecs = {},
> = WithQueryMethods<
  BaseSparqlDatabase<T, R, F, typeof neptuneDialect, C, X>,
  typeof neptuneDialect
>;

/**
 * Creates a database with the Neptune dialect enabled.
 *
 * It takes the same options as `SparqlDatabase.create` from `sparkql`, except `dialect`. Its
 * builders also accept the {@link queryHint} pattern. This entry point re-exports everything
 * from `sparkql`.
 *
 * @param options - Database configuration, including a ready `sparql-http-client` instance.
 *
 * @example
 * Connect to a Neptune cluster's SPARQL endpoint.
 *
 * ```ts
 * import { SparqlDatabase } from 'sparkql/neptune';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({
 *   connection: 'https://my-cluster.cluster-abc123.us-east-1.neptune.amazonaws.com:8182/sparql',
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
  options: NeptuneDatabaseOptions<T, F, X> & { client: C }
): SparqlDatabase<T, K, WithCodecFormats<F, X>, C, X>;
/**
 * Creates a database with the Neptune dialect enabled.
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
  options?: NeptuneDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, DefaultSparqlClient, X>;
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(
  options?: NeptuneDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, AnySparqlClient, X> {
  return BaseSparqlDatabase.create<T, K, F, typeof neptuneDialect, X>({
    ...options,
    dialect: neptuneDialect,
  });
}

/** Creates databases with the Neptune dialect enabled; this entry point re-exports `sparkql`. */
export const SparqlDatabase = { create };
