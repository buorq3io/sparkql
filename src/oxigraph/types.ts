import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExtensionPattern, WithDialectPatterns } from '../database/dialect.js';
import type { PatternInput } from '../helpers/types.js';

/**
 * Input for an Oxigraph `LATERAL` group, as returned by {@link lateral}.
 *
 * It has the same shape as ARQ's `LATERAL`, so ARQ databases accept it too.
 */
export interface LateralInput extends ExtensionPattern {
  /** The `LATERAL` pattern subtype. */
  subType: 'lateral';
  /** The patterns inside the group. */
  patterns: PatternInput<OxigraphInput>[];
}

/** Oxigraph extension pattern inputs. */
export type OxigraphInput = LateralInput;

/** Normalized Oxigraph `LATERAL` group. */
export interface LateralAST extends ExtensionPattern {
  /** The `LATERAL` pattern subtype. */
  subType: 'lateral';
  /** The nested patterns. */
  patterns: OxigraphPattern[];
}

/** Normalized Oxigraph extension patterns. */
export type OxigraphAST = LateralAST;

/** A graph pattern accepted by the Oxigraph generator. */
export type OxigraphPattern = WithDialectPatterns<AST.Pattern, OxigraphAST>;

/** A query or update containing Oxigraph patterns. */
export type OxigraphQuery = WithDialectPatterns<AST.SparqlQuery, OxigraphAST>;
