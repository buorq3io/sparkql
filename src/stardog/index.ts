import type {
  AnySparqlClient,
  SparqlDatabaseOptions as BaseSparqlDatabaseOptions,
  DefaultSparqlClient,
} from '../database/base.js';
import { SparqlDatabase as BaseSparqlDatabase } from '../database/base.js';
import type { SparqlHttpClient } from '../database/http-session.js';
import type { WithQueryMethods } from '../database/query-module.js';
import type { TermFormats } from '../helpers/term-formats.js';
import type { IriManagerConfig } from '../structures/iri.js';
import { stardogDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './paths.js';

export type StardogDatabaseOptions<T extends IriManagerConfig, F extends TermFormats = {}> = Omit<
  BaseSparqlDatabaseOptions<T, F, typeof stardogDialect>,
  'dialect'
>;

export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
> = StardogDatabaseOptions<T, F>;

export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  C extends AnySparqlClient = AnySparqlClient,
> = WithQueryMethods<BaseSparqlDatabase<T, R, F, typeof stardogDialect, C>, typeof stardogDialect>;

function create<
  T extends IriManagerConfig,
  K extends string = 'g_',
  F extends TermFormats = {},
  C extends SparqlHttpClient = SparqlHttpClient,
>(options: StardogDatabaseOptions<T, F> & { client: C }): SparqlDatabase<T, K, F, C>;
function create<T extends IriManagerConfig, K extends string = 'g_', F extends TermFormats = {}>(
  options?: StardogDatabaseOptions<T, F>
): SparqlDatabase<T, K, F, DefaultSparqlClient>;
function create<T extends IriManagerConfig, K extends string = 'g_', F extends TermFormats = {}>(
  options?: StardogDatabaseOptions<T, F>
): SparqlDatabase<T, K, F> {
  return BaseSparqlDatabase.create<T, K, F, typeof stardogDialect>({
    ...options,
    dialect: stardogDialect,
  });
}

/** Creates databases with Stardog PATHS support enabled. */
export const SparqlDatabase = { create };
