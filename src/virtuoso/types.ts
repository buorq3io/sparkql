import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExtensionPattern, WithDialectPatterns } from '../database/dialect.js';
import type { PatternGroupInput } from '../helpers/types.js';
import type { VirtuosoPragmaName, VirtuosoPragmas } from './pragmas.js';

/** Input for a Virtuoso `DEFINE` pragma, as returned by {@link define}. */
export interface DefineInput<K extends VirtuosoPragmaName = VirtuosoPragmaName>
  extends ExtensionPattern {
  /** Identifies the node as a Virtuoso pragma. */
  subType: 'virtuosoDefine';
  /** Pragma name, such as `input:inference`. */
  name: K;
  /** Pragma value. */
  value: VirtuosoPragmas[K];
}

/** Input for a Virtuoso full-text match, as returned by {@link textContains}. */
export interface TextContainsInput extends ExtensionPattern {
  /** Identifies the node as a Virtuoso full-text match. */
  subType: 'virtuosoTextContains';
  /** Variable bound to the indexed literal. */
  text: AST.TermVariable;
  /** Virtuoso text expression. */
  query: string;
  /** Variable that receives the match score. */
  score?: AST.TermVariable;
}

/** Options of a Virtuoso transitive subquery, printed in its `OPTION (TRANSITIVE, ...)` clause. */
export interface TransitiveOptions {
  /** Input variables of each step (`t_in`). They must be projected by the subquery. */
  readonly in: readonly AST.TermVariable[];
  /**
   * Output variables of each step (`t_out`), as many as `in`. Each output becomes the matching
   * input of the next step.
   */
  readonly out: readonly AST.TermVariable[];
  /** Uses each binding of the inputs only once (`t_distinct`). */
  readonly distinct?: boolean;
  /** Generates a single path (`t_exists`). */
  readonly exists?: boolean;
  /** Skips paths that would loop (`t_no_cycles`). Not with `cyclesOnly`. */
  readonly noCycles?: boolean;
  /** Returns only paths that loop (`t_cycles_only`). Not with `noCycles`. */
  readonly cyclesOnly?: boolean;
  /**
   * When both ends are bound, stops at the length of the first path found
   * (`t_shortest_only`).
   */
  readonly shortestOnly?: boolean;
  /** Leaves out paths shorter than this many steps (`t_min`). `0` includes the start. */
  readonly min?: number;
  /** Leaves out paths longer than this many steps (`t_max`). */
  readonly max?: number;
  /**
   * Which end Virtuoso evaluates from (`t_direction`): from the inputs, from the outputs, or
   * from both. By default the optimizer decides.
   */
  readonly direction?: 'forward' | 'backward' | 'both';
  /** Variable that receives the step number on the path (`t_step ('step_no')`). */
  readonly stepNumber?: AST.TermVariable;
  /** Variable that receives an identifier of the path (`t_step ('path_id')`). */
  readonly pathId?: AST.TermVariable;
  /**
   * Variables that receive the value an input variable has at each step (`t_step (?input)`),
   * as `[input, target]` pairs.
   */
  readonly stepValues?: readonly (readonly [AST.TermVariable, AST.TermVariable])[];
}

/** Input for a Virtuoso transitive subquery, as returned by {@link transitive}. */
export interface TransitiveInput extends ExtensionPattern {
  /** Identifies the node as a Virtuoso transitive subquery. */
  subType: 'virtuosoTransitive';
  /** The subquery, as `.as()` returns it. */
  subquery: PatternGroupInput<VirtuosoInput>;
  /** Transitivity options. */
  options: TransitiveOptions;
}

/** Virtuoso extension pattern inputs. */
export type VirtuosoInput = DefineInput | TextContainsInput | TransitiveInput;

/** Normalized Virtuoso `DEFINE` pragma. */
export interface DefineAST extends ExtensionPattern {
  /** Identifies the node as a Virtuoso pragma. */
  subType: 'virtuosoDefine';
  /** Pragma name. */
  name: VirtuosoPragmaName;
  /** Pragma value. */
  value: string | number | URL;
}

/** Normalized Virtuoso full-text match. */
export interface TextContainsAST extends ExtensionPattern {
  /** Identifies the node as a Virtuoso full-text match. */
  subType: 'virtuosoTextContains';
  /** Variable bound to the indexed literal. */
  text: AST.TermVariable;
  /** The text expression as a literal. */
  query: AST.Expression;
  /** Variable that receives the match score. */
  score?: AST.TermVariable;
}

/** Normalized Virtuoso transitive subquery. */
export interface TransitiveAST extends ExtensionPattern {
  /** Identifies the node as a Virtuoso transitive subquery. */
  subType: 'virtuosoTransitive';
  /** The group holding the subquery. */
  subquery: VirtuosoGroup;
  /** Transitivity options. */
  options: TransitiveOptions;
}

/** Normalized Virtuoso extension patterns. */
export type VirtuosoAST = DefineAST | TextContainsAST | TransitiveAST;

/** A group graph pattern containing Virtuoso patterns. */
export interface VirtuosoGroup extends Omit<AST.PatternGroup, 'patterns'> {
  /** The nested patterns. */
  patterns: VirtuosoPattern[];
}

/** A graph pattern accepted by the Virtuoso generator. */
export type VirtuosoPattern = WithDialectPatterns<AST.Pattern, VirtuosoAST>;

/** A query or update containing Virtuoso patterns. */
export type VirtuosoQuery = WithDialectPatterns<AST.SparqlQuery, VirtuosoAST>;
