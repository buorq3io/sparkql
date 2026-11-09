import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExtensionPattern, WithDialectPatterns } from '../database/dialect.js';
import type { ExpressionInput, PatternInput } from '../helpers/types.js';

export type LetInput = ExtensionPattern & {
  subType: 'let';
  variable: AST.TermVariable;
  expression: ExpressionInput;
};
export type LateralInput = ExtensionPattern & {
  subType: 'lateral';
  patterns: PatternInput<ArqInput>[];
};
export type ArqInput = LetInput | LateralInput;
export interface LetAST extends ExtensionPattern {
  subType: 'let';
  variable: AST.TermVariable;
  expression: AST.Expression;
}
export interface LateralAST extends ExtensionPattern {
  subType: 'lateral';
  patterns: ArqPattern[];
}
/** Named recursive containers keep extension nodes distinct from standard AST nodes. */
export interface ArqGroup extends Omit<AST.PatternGroup, 'patterns'> {
  patterns: ArqPattern[];
}
export interface ArqOptional extends Omit<AST.PatternOptional, 'patterns'> {
  patterns: ArqPattern[];
}
export interface ArqMinus extends Omit<AST.PatternMinus, 'patterns'> {
  patterns: ArqPattern[];
}
export interface ArqGraph extends Omit<AST.PatternGraph, 'patterns'> {
  patterns: ArqPattern[];
}
export interface ArqService extends Omit<AST.PatternService, 'patterns'> {
  patterns: ArqPattern[];
}
export interface ArqUnion extends Omit<AST.PatternUnion, 'patterns'> {
  patterns: ArqGroup[];
}
export interface ArqSelect extends Omit<AST.QuerySelect, 'where'> {
  where: ArqGroup;
}
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
export type ArqAST = LetAST | LateralAST;
export type ArqQuery = WithDialectPatterns<AST.SparqlQuery, ArqAST>;
