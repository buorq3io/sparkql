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
import { rdf4jDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './explain.js';
export * from './geosparql.js';
export * from './graphs.js';
export * from './search.js';

/** Options for creating a database with the RDF4J dialect: `sparkql` options minus `dialect`. */
export type Rdf4jDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Omit<BaseSparqlDatabaseOptions<T, F, typeof rdf4jDialect, X>, 'dialect'>;

/** Options for `SparqlDatabase.create` in `sparkql/rdf4j`; see {@link Rdf4jDatabaseOptions}. */
export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  X extends TermCodecs = {},
> = Rdf4jDatabaseOptions<T, F, X>;

/** A database configured with the RDF4J dialect and its query methods. */
export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
  X extends TermCodecs = {},
> = WithQueryMethods<BaseSparqlDatabase<T, R, F, typeof rdf4jDialect, C, X>, typeof rdf4jDialect>;

/**
 * Creates a database with the RDF4J dialect enabled.
 *
 * It takes the same options as `SparqlDatabase.create` from `sparkql`, except `dialect`. The
 * database also has the `db.explain()` method, and builders accept the {@link textSearch}
 * pattern. This entry point re-exports everything from `sparkql`.
 *
 * @param options - Database configuration, including a ready `sparql-http-client` instance.
 *
 * @example
 * Connect to a repository on RDF4J Server that holds people data.
 *
 * ```ts
 * import { SparqlDatabase } from 'sparkql/rdf4j';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({
 *   connection: {
 *     endpointUrl: 'http://localhost:8080/rdf4j-server/repositories/people',
 *     updateUrl: 'http://localhost:8080/rdf4j-server/repositories/people/statements',
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
  options: Rdf4jDatabaseOptions<T, F, X> & { client: C }
): SparqlDatabase<T, K, WithCodecFormats<F, X>, C, X>;
/**
 * Creates a database with the RDF4J dialect enabled.
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
  options?: Rdf4jDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, DefaultSparqlClient, X>;
function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  X extends TermCodecs = {},
>(
  options?: Rdf4jDatabaseOptions<T, F, X>
): SparqlDatabase<T, K, WithCodecFormats<F, X>, AnySparqlClient, X> {
  return BaseSparqlDatabase.create<T, K, F, typeof rdf4jDialect, X>({
    ...options,
    dialect: rdf4jDialect,
  });
}

/** Creates databases with the RDF4J dialect enabled; this entry point re-exports `sparkql`. */
export const SparqlDatabase = { create };
