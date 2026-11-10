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
import { stardogDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './hints.js';
export * from './paths.js';

/** Options for creating a database with the Stardog dialect: `sparkql` options minus `dialect`. */
export type StardogDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Omit<BaseSparqlDatabaseOptions<T, F, typeof stardogDialect, X>, 'dialect'>;

/** Options for `SparqlDatabase.create` in `sparkql/stardog`; see {@link StardogDatabaseOptions}. */
export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = StardogDatabaseOptions<T, F, X>;

/** A database configured with the Stardog dialect and its query methods. */
export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
  X extends TermCodecs = {},
> = WithQueryMethods<
  BaseSparqlDatabase<T, R, F, typeof stardogDialect, C, X>,
  typeof stardogDialect
>;

/**
 * Creates a database with the Stardog dialect enabled.
 *
 * It takes the same options as `SparqlDatabase.create` from `sparkql`, except `dialect`. The
 * database also has the `db.paths()` method. This entry point re-exports everything from
 * `sparkql`.
 *
 * @param options - Database configuration, including a ready `sparql-http-client` instance.
 *
 * @example
 * Connect to a Stardog database that holds people data.
 *
 * ```ts
 * import { SparqlDatabase } from 'sparkql/stardog';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({
 *   connection: 'http://localhost:5820/people/query',
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
  options: StardogDatabaseOptions<T, F, X> & { client: C }
): SparqlDatabase<T, K, WithCodecFormats<F, X>, C, X>;
/**
 * Creates a database with the Stardog dialect enabled.
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
  options?: StardogDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, DefaultSparqlClient, X>;
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(
  options?: StardogDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, AnySparqlClient, X> {
  return BaseSparqlDatabase.create<T, K, F, typeof stardogDialect, X>({
    ...options,
    dialect: stardogDialect,
  });
}

/** Creates databases with the Stardog dialect enabled; this entry point re-exports `sparkql`. */
export const SparqlDatabase = { create };
