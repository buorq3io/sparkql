import {
  IriTerm,
  BlankTerm,
  LiteralTerm,
  VariableTerm,
  Pattern,
  Expression,
  OperationExpression,
} from '../generic.js';
import {
  transformIri,
  transformBlank,
  transformString,
  transformNumber,
  transformBoolean,
  transformLiteral,
} from '../structures/index.js';
import { op } from './utils.js';

// FUNCTIONAL FORMS

export function bound(...args: [VariableTerm]): OperationExpression<boolean> {
  return op('bound', args, transformBoolean);
}

export function ternary(...args: [Expression, Expression, Expression]): OperationExpression {
  return op('if', args);
}

export function coalesce(...args: [Expression, ...Expression[]]): OperationExpression {
  return op('coalesce', args);
}

export function exists(...args: [Pattern]): OperationExpression<boolean> {
  return op('exists', args, transformBoolean);
}

export function notExists(...args: [Pattern]): OperationExpression<boolean> {
  return op('notexists', args, transformBoolean);
}

export function sameTerm(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('sameterm', args, transformBoolean);
}

export function inArray(...args: [Expression, Expression[]]): OperationExpression<boolean> {
  return op('in', args, transformBoolean);
}

export function notinArray(...args: [Expression, Expression[]]): OperationExpression<boolean> {
  return op('notin', args, transformBoolean);
}

// FUNCTIONS ON RDF TERMS

export function isIRI(...args: [Expression]): OperationExpression<boolean> {
  return op('isiri', args, transformBoolean);
}

export function isURI(...args: [Expression]): OperationExpression<boolean> {
  return op('isuri', args, transformBoolean);
}

export function isBlank(...args: [Expression]): OperationExpression<boolean> {
  return op('isblank', args, transformBoolean);
}

export function isLiteral(...args: [Expression]): OperationExpression<boolean> {
  return op('isliteral', args, transformBoolean);
}

export function isNumeric(...args: [Expression]): OperationExpression<boolean> {
  return op('isnumeric', args, transformBoolean);
}

export function str(...args: [Expression]): OperationExpression<string> {
  return op('str', args, transformString);
}

export function lang(...args: [Expression]): OperationExpression<string> {
  return op('lang', args, transformString);
}

export function datatype(...args: [Expression]): OperationExpression<IriTerm> {
  return op('datatype', args, transformIri);
}

export function uri(...args: [Expression]): OperationExpression<IriTerm> {
  return op('uri', args, transformIri);
}

export function bnode(...args: [Expression] | []): OperationExpression<BlankTerm> {
  return op('bnode', args, transformBlank);
}

export function strdt(...args: [Expression, Expression]): OperationExpression<LiteralTerm> {
  return op('strdt', args, transformLiteral);
}

export function strlang(...args: [Expression, Expression]): OperationExpression<LiteralTerm> {
  return op('strlang', args, transformLiteral);
}

export function uuid(): OperationExpression<IriTerm> {
  return op('uuid', [], transformIri);
}

export function struuid(): OperationExpression<string> {
  return op('struuid', [], transformString);
}

// FUNCTIONS ON STRINGS

export function strlen(...args: [Expression]): OperationExpression<number> {
  return op('strlen', args, transformNumber);
}

export function substr(
  ...args: [Expression, Expression, ...([Expression] | [])]
): OperationExpression<LiteralTerm> {
  return op('substr', args, transformLiteral);
}

export function ucase(...args: [Expression]): OperationExpression<LiteralTerm> {
  return op('ucase', args, transformLiteral);
}

export function lcase(...args: [Expression]): OperationExpression<LiteralTerm> {
  return op('lcase', args, transformLiteral);
}

export function strstarts(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('strstarts', args, transformBoolean);
}

export function strends(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('strends', args, transformBoolean);
}

export function contains(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('contains', args, transformBoolean);
}

export function strbefore(...args: [Expression, Expression]): OperationExpression<LiteralTerm> {
  return op('strbefore', args, transformLiteral);
}

export function strafter(...args: [Expression, Expression]): OperationExpression<LiteralTerm> {
  return op('strafter', args, transformLiteral);
}

export function encodeForURI(...args: [Expression]): OperationExpression<string> {
  return op('encode_for_uri', args, transformString);
}

export function concat(...args: Expression[]): OperationExpression<LiteralTerm> {
  return op('concat', args, transformLiteral);
}

export function langMatches(...args: [Expression, Expression]): OperationExpression<boolean> {
  return op('langmatches', args, transformBoolean);
}

export function regex(
  ...args: [Expression, Expression, ...([Expression] | [])]
): OperationExpression<boolean> {
  return op('regex', args, transformBoolean);
}

export function replace(
  ...args: [Expression, Expression, Expression, ...([Expression] | [])]
): OperationExpression<LiteralTerm> {
  return op('replace', args, transformLiteral);
}

// FUNCTIONS ON NUMERICS

export function abs(...args: [Expression]): OperationExpression<number> {
  return op('abs', args, transformNumber);
}

export function round(...args: [Expression]): OperationExpression<number> {
  return op('round', args, transformNumber);
}

export function ceil(...args: [Expression]): OperationExpression<number> {
  return op('ceil', args, transformNumber);
}

export function floor(...args: [Expression]): OperationExpression<number> {
  return op('floor', args, transformNumber);
}

export function rand(): OperationExpression<number> {
  return op('rand', [], transformNumber);
}

// HASH FUNCTIONS

export function md5(...args: [Expression]): OperationExpression<string> {
  return op('md5', args, transformString);
}

export function sha1(...args: [Expression]): OperationExpression<string> {
  return op('sha1', args, transformString);
}

export function sha256(...args: [Expression]): OperationExpression<string> {
  return op('sha256', args, transformString);
}

export function sha384(...args: [Expression]): OperationExpression<string> {
  return op('sha384', args, transformString);
}

export function sha512(...args: [Expression]): OperationExpression<string> {
  return op('sha512', args, transformString);
}
