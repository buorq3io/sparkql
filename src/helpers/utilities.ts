import * as AST from '@traqula/rules-sparql-1-1';
import { createFormatRegistry, defineType, defineUnionType } from './generators.js';
import {
  BlankFormatMap,
  NamedNodeFormatMap,
  LiteralFormatMap,
  WildcardInput,
  TripleCollectionListInputBase,
  TripleCollectionBlankNodePropertiesInputBase,
} from './types.js';
import {
  createTripleCollectionBlankNodePropertiesInputSyntaxFormatter,
  createTripleCollectionListInputSyntaxFormatter,
} from './formatters.js';

export function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface Typed<Type extends string = string> {
  type: Type;
  subType?: string;
}

export function isTyped<T>(value: T): value is Extract<T, Typed> {
  return (
    isObjectLike(value) &&
    typeof value.type === 'string' &&
    (typeof value.subType === 'string' || typeof value.subType === 'undefined')
  );
}

export function isTermIri(value: unknown): value is AST.TermIri {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'namedNode' &&
    typeof value.value === 'string'
  );
}

export function isTermLiteral(value: unknown): value is AST.TermLiteral {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'literal' &&
    typeof value.value === 'string'
  );
}

export function isTermBlank(value: unknown): value is AST.TermBlank {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'blankNode' &&
    typeof value.label === 'string'
  );
}

export function isTermVariable(value: unknown): value is AST.TermVariable {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'variable' &&
    typeof value.value === 'string'
  );
}

export function isTripleCollectionListInputBase(
  value: unknown
): value is TripleCollectionListInputBase {
  return isObjectLike(value) && value.type === 'tripleCollection' && value.subType === 'list';
}

export function isTripleCollectionBlankNodePropertiesInputBase(
  value: unknown
): value is TripleCollectionBlankNodePropertiesInputBase {
  return (
    isObjectLike(value) &&
    value.type === 'tripleCollection' &&
    value.subType === 'blankNodeProperties'
  );
}

export function isWildCardInputArray(value: unknown): value is [WildcardInput] {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    isObjectLike(value[0]) &&
    value[0].type === 'wildcard'
  );
}

export const termIriRegistry = createFormatRegistry<NamedNodeFormatMap, AST.TermIri>();

export const termLiteralRegistry = createFormatRegistry<LiteralFormatMap, AST.TermLiteral>();

export const termBlankRegistry = createFormatRegistry<BlankFormatMap, AST.TermBlank>();

export const termIri = defineType({
  is: isTermIri,
  from: termIriRegistry.formatters,
  assertMessage: 'Expected an iri term.',
  parseMessage: 'Unsupported iri term value provided.',
});

export const termLiteral = defineType({
  is: isTermLiteral,
  from: termLiteralRegistry.formatters,
  assertMessage: 'Expected a literal term.',
  parseMessage: 'Unsupported literal term value provided.',
});

export const termBlank = defineType({
  is: isTermBlank,
  from: termBlankRegistry.formatters,
  assertMessage: 'Expected a blank term.',
  parseMessage: 'Unsupported blank term value provided.',
});

export const termVariable = defineType({
  is: isTermVariable,
  from: [],
  assertMessage: 'Expected a variable term.',
  parseMessage: 'Unsupported variable term value provided.',
});

export const tripleCollectionListInputBase = defineType({
  is: isTripleCollectionListInputBase,
  from: [createTripleCollectionListInputSyntaxFormatter()],
  assertMessage: 'Expected a list term.',
  parseMessage: 'Unsupported list term value provided.',
});

export const tripleCollectionBlankNodePropertiesInputBase = defineType({
  is: isTripleCollectionBlankNodePropertiesInputBase,
  from: [createTripleCollectionBlankNodePropertiesInputSyntaxFormatter()],
  assertMessage: 'Expected a blank term.',
  parseMessage: 'Unsupported blank term provided.',
});

export const tripleCollectionInput = defineUnionType({
  members: [tripleCollectionListInputBase, tripleCollectionBlankNodePropertiesInputBase] as const,
  assertMessage: 'Expected a triple collection.',
  parseMessage: 'Unsupported triple collection value provided.',
});

export const term = defineUnionType({
  members: [termVariable, termIri, termLiteral, termBlank] as const,
  assertMessage: 'Expected an describe variable term..',
  parseMessage: 'Unsupported describe variable term value provided.',
});

export const termExpression = defineUnionType({
  members: [termVariable, termIri, termLiteral] as const,
  assertMessage: 'Expected an expression term..',
  parseMessage: 'Unsupported expression term value provided.',
});

export const termGraph = defineUnionType({
  members: [termVariable, termIri] as const,
  assertMessage: 'Expected an describe variable term..',
  parseMessage: 'Unsupported describe variable term value provided.',
});

export const termValues = defineUnionType({
  members: [termIri, termLiteral] as const,
  assertMessage: 'Expected an describe variable term..',
  parseMessage: 'Unsupported describe variable term value provided.',
});
