import { ExpressionInput, ExpressionOperationInput, ExpressionPatternOperationInput, PatternInput, TermVariableInput } from '../helpers/types.js';

import {
  transformIri,
  transformBlank,
  transformString,
  transformNumber,
  transformBoolean,
  transformLiteral,
  transformDate,
  group,
} from '../structures/index.js';
import { createOperationExpression, createPatternOperationExpression } from './utils.js';

// FUNCTIONAL FORMS

export function bound(...args: [TermVariableInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('bound', args, transformBoolean);
}

export function ternary(...args: [ExpressionInput, ExpressionInput, ExpressionInput]): ExpressionOperationInput {
  return createOperationExpression('if', args);
}

export function coalesce(...args: [ExpressionInput, ...ExpressionInput[]]): ExpressionOperationInput {
  return createOperationExpression('coalesce', args);
}

export function exists(...args: [PatternInput]): ExpressionPatternOperationInput<boolean> {
  return createPatternOperationExpression('exists', group(...args), transformBoolean);
}

export function notExists(...args: [PatternInput]): ExpressionPatternOperationInput<boolean> {
  return createPatternOperationExpression('notexists', group(...args), transformBoolean);
}

export function sameTerm(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('sameterm', args, transformBoolean);
}

export function inArray(...args: [ExpressionInput, ExpressionInput[]]): ExpressionOperationInput<boolean> {
  return createOperationExpression('in', [args[0], ...args[1]], transformBoolean);
}

export function notinArray(...args: [ExpressionInput, ExpressionInput[]]): ExpressionOperationInput<boolean> {
  return createOperationExpression('notin', [args[0], ...args[1]], transformBoolean);
}

// FUNCTIONS ON RDF TERMS

export function isIRI(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isiri', args, transformBoolean);
}

export function isURI(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isuri', args, transformBoolean);
}

export function isBlank(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isblank', args, transformBoolean);
}

export function isLiteral(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isliteral', args, transformBoolean);
}

export function isNumeric(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isnumeric', args, transformBoolean);
}

export function str(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('str', args, transformString);
}

export function lang(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('lang', args, transformString);
}

export function datatype(...args: [ExpressionInput]): ExpressionOperationInput<IriTerm> {
  return createOperationExpression('datatype', args, transformIri);
}

export function iri(...args: [ExpressionInput]): ExpressionOperationInput<IriTerm> {
  return createOperationExpression('iri', args, transformIri);
}

export function uri(...args: [ExpressionInput]): ExpressionOperationInput<IriTerm> {
  return createOperationExpression('uri', args, transformIri);
}

export function bnode(...args: [ExpressionInput] | []): ExpressionOperationInput<BlankTerm> {
  return createOperationExpression('bnode', args, transformBlank);
}

export function strdt(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('strdt', args, transformLiteral);
}

export function strlang(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('strlang', args, transformLiteral);
}

export function uuid(): ExpressionOperationInput<IriTerm> {
  return createOperationExpression('uuid', [], transformIri);
}

export function struuid(): ExpressionOperationInput<string> {
  return createOperationExpression('struuid', [], transformString);
}

// FUNCTIONS ON STRINGS

export function strlen(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('strlen', args, transformNumber);
}

export function substr(
  ...args: [ExpressionInput, ExpressionInput, ...([ExpressionInput] | [])]
): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('substr', args, transformLiteral);
}

export function ucase(...args: [ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('ucase', args, transformLiteral);
}

export function lcase(...args: [ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('lcase', args, transformLiteral);
}

export function strstarts(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('strstarts', args, transformBoolean);
}

export function strends(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('strends', args, transformBoolean);
}

export function contains(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('contains', args, transformBoolean);
}

export function strbefore(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('strbefore', args, transformLiteral);
}

export function strafter(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('strafter', args, transformLiteral);
}

export function encodeForURI(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('encode_for_uri', args, transformString);
}

export function concat(...args: ExpressionInput[]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('concat', args, transformLiteral);
}

export function langMatches(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('langmatches', args, transformBoolean);
}

export function regex(
  ...args: [ExpressionInput, ExpressionInput, ...([ExpressionInput] | [])]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('regex', args, transformBoolean);
}

export function replace(
  ...args: [ExpressionInput, ExpressionInput, ExpressionInput, ...([ExpressionInput] | [])]
): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('replace', args, transformLiteral);
}

// FUNCTIONS ON NUMERICS

export function abs(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('abs', args, transformNumber);
}

export function round(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('round', args, transformNumber);
}

export function ceil(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('ceil', args, transformNumber);
}

export function floor(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('floor', args, transformNumber);
}

export function rand(): ExpressionOperationInput<number> {
  return createOperationExpression('rand', [], transformNumber);
}

// FUNCTIONS ON DATES AND TIMES

export function now(): ExpressionOperationInput<Date> {
  return createOperationExpression('now', [], transformDate);
}

export function year(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('year', args, transformNumber);
}

export function month(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('month', args, transformNumber);
}

export function day(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('day', args, transformNumber);
}

export function hours(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('hours', args, transformNumber);
}

export function minutes(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('minutes', args, transformNumber);
}

export function seconds(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('seconds', args, transformNumber);
}

export function timezone(...args: [ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('timezone', args, transformLiteral);
}

export function tz(...args: [ExpressionInput]): ExpressionOperationInput<LiteralTerm> {
  return createOperationExpression('tz', args, transformLiteral);
}

// HASH FUNCTIONS

export function md5(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('md5', args, transformString);
}

export function sha1(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha1', args, transformString);
}

export function sha256(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha256', args, transformString);
}

export function sha384(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha384', args, transformString);
}

export function sha512(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha512', args, transformString);
}
