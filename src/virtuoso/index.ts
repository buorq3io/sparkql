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
import { virtuosoDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './functions.js';
export * from './pragmas.js';
export * from './text.js';
export * from './transitive.js';
export * from './types.js';

/** Options for creating a database with the Virtuoso dialect: `sparkql` options minus `dialect`. */
export type VirtuosoDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Omit<BaseSparqlDatabaseOptions<T, F, typeof virtuosoDialect, X>, 'dialect'>;

/** Options for `SparqlDatabase.create` in `sparkql/virtuoso`; see {@link VirtuosoDatabaseOptions}. */
export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = VirtuosoDatabaseOptions<T, F, X>;

/** A database configured with the Virtuoso dialect. */
export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
  X extends TermCodecs = {},
> = WithQueryMethods<
  BaseSparqlDatabase<T, R, F, typeof virtuosoDialect, C, X>,
  typeof virtuosoDialect
>;

/**
 * Creates a database with the Virtuoso dialect enabled.
 *
 * It takes the same options as `SparqlDatabase.create` from `sparkql`, except `dialect`. Builders
 * also accept the Virtuoso patterns. This entry point re-exports everything from
 * `sparkql`.
 *
 * @param options - Database configuration, including a ready `sparql-http-client` instance.
 *
 * @example
 * Connect to a Virtuoso SPARQL endpoint that holds people data.
 *
 * ```ts
 * import { SparqlDatabase } from 'sparkql/virtuoso';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({
 *   connection: 'http://localhost:8890/sparql',
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
  options: VirtuosoDatabaseOptions<T, F, X> & { client: C }
): SparqlDatabase<T, K, WithCodecFormats<F, X>, C, X>;
/**
 * Creates a database with the Virtuoso dialect enabled.
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
  options?: VirtuosoDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, DefaultSparqlClient, X>;
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(
  options?: VirtuosoDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, AnySparqlClient, X> {
  return BaseSparqlDatabase.create<T, K, F, typeof virtuosoDialect, X>({
    ...options,
    dialect: virtuosoDialect,
  });
}

/** Creates databases with the Virtuoso dialect enabled; this entry point re-exports `sparkql`. */
export const SparqlDatabase = { create };
