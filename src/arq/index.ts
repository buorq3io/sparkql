import { SparqlDatabase as BaseSparqlDatabase } from '../database/base.js';
import type { SparqlDatabaseOptions as BaseSparqlDatabaseOptions } from '../database/base.js';
import type { IriManagerConfig } from '../structures/iri.js';
import type { TermFormats } from '../helpers/term-formats.js';
import { arqDialect } from './dialect.js';

export * from '../index.js';
export * from './dialect.js';
export * from './functions.js';

export type ArqDatabaseOptions<T extends IriManagerConfig, F extends TermFormats = {}> = Omit<
  BaseSparqlDatabaseOptions<T, F, typeof arqDialect>,
  'dialect'
>;

export type SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {}
> = ArqDatabaseOptions<T, F>;

export type SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {}
> = BaseSparqlDatabase<T, R, F, typeof arqDialect>;

/** Creates databases with ARQ support enabled. */
export const SparqlDatabase = {
  create<T extends IriManagerConfig, K extends string = 'g_', F extends TermFormats = {}>(
    options?: ArqDatabaseOptions<T, F>
  ): SparqlDatabase<T, K, F> {
    return BaseSparqlDatabase.create<T, K, F, typeof arqDialect>({
      ...options,
      dialect: arqDialect,
    });
  },
};
