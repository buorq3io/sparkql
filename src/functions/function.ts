import {
  IriTerm,
  BlankTerm,
  LiteralTerm,
  VariableTerm,
  QueryReturnType,
  PatternOrTriple,
  OperationExpression,
  ExpressionOrPrimitive,
} from '../generic';
import {
  transform_iri,
  transform_blank,
  transform_string,
  transform_boolean,
  transform_literal,
  transform_number,
} from '../structures';
import { op } from './utils';

type P = PatternOrTriple;
type V<T = QueryReturnType> = VariableTerm<T>;
type E<T = QueryReturnType> = ExpressionOrPrimitive<T>;

// FUNCTIONAL FORMS

export function bound(...args: [V]): OperationExpression<boolean> {
  return op('bound', args, transform_boolean);
}

export function ternary(...args: [E, E, E]): OperationExpression {
  return op('if', args);
}

export function coalesce(...args: [E, ...E[]]): OperationExpression {
  return op('coalesce', args);
}

export function exists(...args: [P]): OperationExpression<boolean> {
  return op('exists', args, transform_boolean);
}

export function notExists(...args: [P]): OperationExpression<boolean> {
  return op('notexists', args, transform_boolean);
}

export function sameTerm(...args: [E, E]): OperationExpression<boolean> {
  return op('sameterm', args, transform_boolean);
}

export function inArray(...args: [E, E[]]): OperationExpression<boolean> {
  return op('in', args, transform_boolean);
}

export function notinArray(...args: [E, E[]]): OperationExpression<boolean> {
  return op('notin', args, transform_boolean);
}

// FUNCTIONS ON RDF TERMS

export function isURI(...args: [E]): OperationExpression<boolean> {
  return op('isuri', args, transform_boolean);
}

export function isBlank(...args: [E]): OperationExpression<boolean> {
  return op('isblank', args, transform_boolean);
}

export function isLiteral(...args: [E]): OperationExpression<boolean> {
  return op('isliteral', args, transform_boolean);
}

export function isNumeric(...args: [E]): OperationExpression<boolean> {
  return op('isnumeric', args, transform_boolean);
}

export function str(...args: [E]): OperationExpression<string> {
  return op('str', args, transform_string);
}

export function lang(...args: [E]): OperationExpression<string> {
  return op('lang', args, transform_string);
}

export function datatype(...args: [E]): OperationExpression<IriTerm> {
  return op('datatype', args, transform_iri);
}

export function uri(...args: [E]): OperationExpression<IriTerm> {
  return op('uri', args, transform_iri);
}

export function bnode(...args: [E] | []): OperationExpression<BlankTerm> {
  return op('bnode', args, transform_blank);
}

export function strdt(...args: [E, E]): OperationExpression<LiteralTerm> {
  return op('strdt', args, transform_literal);
}

export function strlang(...args: [E, E]): OperationExpression<LiteralTerm> {
  return op('strlang', args, transform_literal);
}

export function uuid(): OperationExpression<IriTerm> {
  return op('uuid', [], transform_iri);
}

export function struuid(): OperationExpression<string> {
  return op('struuid', [], transform_string);
}

// FUNCTIONS ON STRINGS

export function strlen(...args: [E]): OperationExpression<number> {
  return op('strlen', args, transform_number);
}

export function substr(
  ...args: [E, E, ...([E] | [])]
): OperationExpression<LiteralTerm> {
  return op('substr', args, transform_literal);
}

export function ucase(...args: [E]): OperationExpression<LiteralTerm> {
  return op('ucase', args, transform_literal);
}

export function lcase(...args: [E]): OperationExpression<LiteralTerm> {
  return op('lcase', args, transform_literal);
}

export function strstarts(...args: [E, E]): OperationExpression<boolean> {
  return op('strstarts', args, transform_boolean);
}

export function strends(...args: [E, E]): OperationExpression<boolean> {
  return op('strends', args, transform_boolean);
}

export function contains(...args: [E, E]): OperationExpression<boolean> {
  return op('contains', args, transform_boolean);
}

export function strbefore(...args: [E, E]): OperationExpression<LiteralTerm> {
  return op('strbefore', args, transform_literal);
}

export function strafter(...args: [E, E]): OperationExpression<LiteralTerm> {
  return op('strafter', args, transform_literal);
}

export function encodeForURI(...args: [E]): OperationExpression<string> {
  return op('encode_for_uri', args, transform_string);
}

export function concat(...args: E[]): OperationExpression<LiteralTerm> {
  return op('concat', args, transform_literal);
}

export function langMatches(...args: [E, E]): OperationExpression<boolean> {
  return op('langmatches', args, transform_boolean);
}

export function regex(
  ...args: [E, E, ...([E] | [])]
): OperationExpression<boolean> {
  return op('regex', args, transform_boolean);
}

export function replace(
  ...args: [E, E, E, ...([E] | [])]
): OperationExpression<LiteralTerm> {
  return op('replace', args, transform_literal);
}

// FUNCTIONS ON NUMERICS

export function abs(...args: [E]): OperationExpression<number> {
  return op('abs', args, transform_number);
}

export function round(...args: [E]): OperationExpression<number> {
  return op('round', args, transform_number);
}

export function ceil(...args: [E]): OperationExpression<number> {
  return op('ceil', args, transform_number);
}

export function floor(...args: [E]): OperationExpression<number> {
  return op('floor', args, transform_number);
}

export function rand(): OperationExpression<number> {
  return op('rand', [], transform_number);
}

// HASH FUNCTIONS

export function md5(...args: [E]): OperationExpression<string> {
  return op('md5', args, transform_string);
}

export function sha1(...args: [E]): OperationExpression<string> {
  return op('sha1', args, transform_string);
}

export function sha256(...args: [E]): OperationExpression<string> {
  return op('sha256', args, transform_string);
}

export function sha384(...args: [E]): OperationExpression<string> {
  return op('sha384', args, transform_string);
}

export function sha512(...args: [E]): OperationExpression<string> {
  return op('sha512', args, transform_string);
}
