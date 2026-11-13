import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExtensionPattern } from '../database/dialect.js';
import { SparkqlError } from '../database/errors.js';
import type { ObjectInput, PatternInput, PredicateInput } from '../helpers/types.js';
import { predicates, triples } from '../structures/expression.js';

/** The kinds of QLever extension patterns. */
export type QleverPatternKind =
  | 'qleverContainsWord'
  | 'qleverContainsEntity'
  | 'qleverTextSearch'
  | 'qleverPathSearch'
  | 'qleverSpatialSearch'
  | 'qleverRowNumber';

/**
 * Input for a QLever extension pattern, as returned by {@link containsWord}, {@link textSearch},
 * {@link pathSearch}, {@link spatialSearch} and the other QLever pattern helpers.
 *
 * Each one stands for ordinary triples or a `SERVICE` block that only QLever evaluates, so only
 * databases created from `sparkql/qlever` accept it.
 */
export interface QleverPatternInput extends ExtensionPattern {
  /** Which QLever extension the pattern is. */
  subType: QleverPatternKind;
  /** The standard pattern QLever reads it as. */
  expansion: PatternInput<QleverPatternInput>;
  /** @internal Checks the normalized pattern, for rules that depend on nested queries. */
  check?: (pattern: AST.PatternService) => void;
}

/** Normalized QLever extension patterns: the triples or `SERVICE` block they stand for. */
export type QleverAST = AST.PatternBgp | AST.PatternService;

const kinds: readonly string[] = [
  'qleverContainsWord',
  'qleverContainsEntity',
  'qleverTextSearch',
  'qleverPathSearch',
  'qleverSpatialSearch',
  'qleverRowNumber',
];

/** @internal Returns whether a value is a QLever extension pattern. */
export function isQleverPattern(value: unknown): value is QleverPatternInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'pattern' &&
    'subType' in value &&
    typeof value.subType === 'string' &&
    kinds.includes(value.subType)
  );
}

const loc = { sourceLocationType: 'autoGenerate' } as const;

/** @internal Creates a QLever pattern input. */
export function qleverPattern(
  subType: QleverPatternKind,
  expansion: PatternInput<QleverPatternInput>,
  check?: (pattern: AST.PatternService) => void
): QleverPatternInput {
  return check
    ? { type: 'pattern', subType, loc, expansion, check }
    : { type: 'pattern', subType, loc, expansion };
}

/** @internal A predicate-object pair of a configuration. */
export type Pair = [PredicateInput, ObjectInput];

/** @internal Prints configuration pairs as a standalone blank node property list: `[ p o ; ... ] .` */
export function configuration(pairs: Pair[]) {
  return triples([predicates(...pairs)] as never);
}

/** @internal A blank node property list as the object of a triple. */
export function nested(pairs: Pair[]): ObjectInput {
  return [predicates(...pairs)] as unknown as ObjectInput;
}

/** @internal Throws a QLever input error. */
export function fail(feature: string, message: string): never {
  throw new SparkqlError({ message: `QLever ${feature}: ${message}` });
}

/** @internal Returns whether a value is a variable term. */
export function isVariable(value: unknown): value is AST.TermVariable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'subType' in value &&
    value.subType === 'variable'
  );
}

/** @internal Throws unless the value, when given, is a variable. */
export function checkVariable(feature: string, name: string, value: unknown, required = false) {
  if (value === undefined && !required) return;
  if (!isVariable(value)) fail(feature, `\`${name}\` must be a variable.`);
}

/** @internal Throws unless the value, when given, is an integer of at least `min`. */
export function checkInteger(feature: string, name: string, value: unknown, min: number) {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    fail(feature, `\`${name}\` must be an integer of at least ${min}.`);
  }
}
