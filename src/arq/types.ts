import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExtensionPattern, WithDialectPatterns } from '../database/dialect.js';
import type { ExpressionInput, PatternInput } from '../helpers/types.js';

/** Input for an ARQ `LET` pattern, as returned by {@link letBinding}. */
export type LetInput = ExtensionPattern & {
  /** The `LET` pattern subtype. */
  subType: 'let';
  /** The variable receiving the expression. */
  variable: AST.TermVariable;
  /** The expression to bind. */
  expression: ExpressionInput;
};
/** Input for an ARQ `LATERAL` group, as returned by {@link lateral}. */
export type LateralInput = ExtensionPattern & {
  /** The `LATERAL` pattern subtype. */
  subType: 'lateral';
  /** The patterns inside the group. */
  patterns: PatternInput<ArqInput>[];
};
/** ARQ extension pattern inputs. */
export type ArqInput = LetInput | LateralInput;
/** Normalized ARQ `LET` pattern. */
export interface LetAST extends ExtensionPattern {
  /** The `LET` pattern subtype. */
  subType: 'let';
  /** The variable receiving the expression. */
  variable: AST.TermVariable;
  /** The normalized expression to bind. */
  expression: AST.Expression;
}
/** Normalized ARQ `LATERAL` group. */
export interface LateralAST extends ExtensionPattern {
  /** The `LATERAL` pattern subtype. */
  subType: 'lateral';
  /** The nested patterns. */
  patterns: ArqPattern[];
}
/**
 * A group graph pattern containing ARQ patterns.
 *
 * This and the other `Arq*` container types are named so that extension nodes stay distinct
 * from standard AST nodes.
 */
export interface ArqGroup extends Omit<AST.PatternGroup, 'patterns'> {
  /** The nested patterns. */
  patterns: ArqPattern[];
}
/** An `OPTIONAL` pattern containing ARQ patterns. */
export interface ArqOptional extends Omit<AST.PatternOptional, 'patterns'> {
  /** The nested patterns. */
  patterns: ArqPattern[];
}
/** A `MINUS` pattern containing ARQ patterns. */
export interface ArqMinus extends Omit<AST.PatternMinus, 'patterns'> {
  /** The nested patterns. */
  patterns: ArqPattern[];
}
/** A `GRAPH` pattern containing ARQ patterns. */
export interface ArqGraph extends Omit<AST.PatternGraph, 'patterns'> {
  /** The nested patterns. */
  patterns: ArqPattern[];
}
/** A `SERVICE` pattern containing ARQ patterns. */
export interface ArqService extends Omit<AST.PatternService, 'patterns'> {
  /** The nested patterns. */
  patterns: ArqPattern[];
}
/** A `UNION` pattern containing ARQ groups. */
export interface ArqUnion extends Omit<AST.PatternUnion, 'patterns'> {
  /** The nested patterns. */
  patterns: ArqGroup[];
}
/** A `SELECT` query containing ARQ patterns. */
export interface ArqSelect extends Omit<AST.QuerySelect, 'where'> {
  /** The query graph pattern. */
  where: ArqGroup;
}
/** A graph pattern accepted by the ARQ generator. */
export type ArqPattern =
  | ArqAST
  | AST.PatternBgp
  | AST.PatternBind
  | AST.PatternFilter
  | AST.PatternValues
  | ArqGroup
  | ArqOptional
  | ArqMinus
  | ArqGraph
  | ArqService
  | ArqUnion
  | ArqSelect;
/** Normalized ARQ extension patterns. */
export type ArqAST = LetAST | LateralAST;
/** A query or update containing ARQ patterns. */
export type ArqQuery = WithDialectPatterns<AST.SparqlQuery, ArqAST>;
