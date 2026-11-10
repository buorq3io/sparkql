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
import { arqDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './functions.js';
export * from './queries.js';

/** Options for creating a database with the ARQ dialect: the `sparkql` options minus `dialect`. */
export type ArqDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Omit<BaseSparqlDatabaseOptions<T, F, typeof arqDialect, X>, 'dialect'>;

/** Options for `SparqlDatabase.create` from `sparkql/arq`; alias of {@link ArqDatabaseOptions}. */
export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = ArqDatabaseOptions<T, F, X>;

/** A database configured with the ARQ dialect and its query methods. */
export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
> = WithQueryMethods<BaseSparqlDatabase<T, R, F, typeof arqDialect, C>, typeof arqDialect>;

/**
 * Creates a database with the ARQ dialect enabled.
 *
 * It takes the same options as `SparqlDatabase.create` from `sparkql`, except `dialect`. The
 * database also has the `db.json()` and `db.constructQuads()` methods, and its builders accept
 * the {@link letBinding} and {@link lateral} patterns. This entry point re-exports everything
 * from `sparkql`.
 *
 * @param options - Database configuration, including a ready `sparql-http-client` instance.
 *
 * @example
 * Connect to a Fuseki dataset that holds people data.
 *
 * ```ts
 * import { SparqlDatabase } from 'sparkql/arq';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({
 *   connection: 'http://localhost:3030/people/sparql',
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
  options: ArqDatabaseOptions<T, F, X> & { client: C }
): SparqlDatabase<T, K, WithCodecFormats<F, X>, C>;
/**
 * Creates a database with the ARQ dialect enabled.
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
  options?: ArqDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, DefaultSparqlClient>;
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(options?: ArqDatabaseOptions<T, F, X>): SparqlDatabase<T, K, WithCodecFormats<F, X>> {
  return BaseSparqlDatabase.create<T, K, F, typeof arqDialect, X>({
    ...options,
    dialect: arqDialect,
  });
}

/** Creates databases with the ARQ dialect enabled; this entry point re-exports `sparkql`. */
export const SparqlDatabase = { create };
