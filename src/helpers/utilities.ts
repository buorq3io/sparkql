import type * as AST from '@traqula/rules-sparql-1-1';
import {
  createTripleCollectionBlankNodePropertiesInputSyntaxFormatter,
  createTripleCollectionListInputSyntaxFormatter,
} from './formatters.js';
import { defineType, defineUnionType } from './generators.js';
import { defaultTermFormats } from './term-formats.js';
import type {
  TripleCollectionBlankNodePropertiesInputBase,
  TripleCollectionListInputBase,
  WildcardInput,
} from './types.js';

/**
 * Tests for a non-null object, arrays included, so its properties can be read safely.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Read a property from an unknown value only when it is an object.
 *
 * ```ts
 * const input: unknown = JSON.parse('{ "name": "Ada" }');
 * const name = isObjectLike(input) ? input.name : undefined; // 'Ada'
 * ```
 */
export function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * An object with the `type` and optional `subType` discriminators that every sparkql AST node
 * carries, such as `{ type: 'term', subType: 'variable' }` for a variable.
 */
export interface Typed<Type extends string = string> {
  /** The node kind, such as `'term'`, `'pattern'` or `'query'`. */
  type: Type;
  /** The variant within the kind, such as `'variable'` or `'literal'` for terms. */
  subType?: string;
}

/**
 * Tests for an object with a string `type` and an optional string `subType`, the shape of an
 * AST node.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell AST nodes, such as variables, from plain JavaScript inputs.
 *
 * ```ts
 * isTyped(v.name); // true: { type: 'term', subType: 'variable', ... }
 * isTyped('Ada'); // false
 * ```
 */
export function isTyped<T>(value: T): value is Extract<T, Typed> {
  return (
    isObjectLike(value) &&
    typeof value.type === 'string' &&
    (typeof value.subType === 'string' || typeof value.subType === 'undefined')
  );
}

/**
 * Tests for an IRI term, full or prefixed. A `URL` is not a term, so it fails.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell IRI terms from URLs.
 *
 * ```ts
 * isTermIri(n.foaf.name); // true
 * isTermIri(new URL('http://xmlns.com/foaf/0.1/name')); // false
 * ```
 */
export function isTermIri(value: unknown): value is AST.TermIri {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'namedNode' &&
    typeof value.value === 'string'
  );
}

/**
 * Tests for a literal term. JavaScript values that would become literals, such as strings
 * and numbers, fail until they are converted.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell literal terms from the strings they are made from.
 *
 * ```ts
 * isTermLiteral(db.literal('Ada')); // true
 * isTermLiteral('Ada'); // false
 * ```
 */
export function isTermLiteral(value: unknown): value is AST.TermLiteral {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'literal' &&
    typeof value.value === 'string'
  );
}

/**
 * Tests for a blank node term. The `[]` input, which becomes a fresh blank node, fails until
 * it is converted.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell blank node terms from the `[]` input.
 *
 * ```ts
 * isTermBlank(db.blank()); // true
 * isTermBlank([]); // false
 * ```
 */
export function isTermBlank(value: unknown): value is AST.TermBlank {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'blankNode' &&
    typeof value.label === 'string'
  );
}

/**
 * Tests for a variable term, such as one from the variable manager or `db.variable()`.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell variables from IRIs.
 *
 * ```ts
 * isTermVariable(v.name); // true
 * isTermVariable(n.foaf.name); // false
 * ```
 */
export function isTermVariable(value: unknown): value is AST.TermVariable {
  return (
    isObjectLike(value) &&
    value.type === 'term' &&
    value.subType === 'variable' &&
    typeof value.value === 'string'
  );
}

/**
 * Tests for an RDF list in AST form (`type: 'tripleCollection'`, `subType: 'list'`). The
 * `[[a, b]]` tuple syntax fails; see {@link isTripleCollectionListInputSyntax}.
 *
 * Only the discriminators are checked.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Recognize a list collection by its discriminators.
 *
 * ```ts
 * isTripleCollectionListInputBase({ type: 'tripleCollection', subType: 'list' }); // true
 * ```
 */
export function isTripleCollectionListInputBase(
  value: unknown
): value is TripleCollectionListInputBase {
  return isObjectLike(value) && value.type === 'tripleCollection' && value.subType === 'list';
}

/**
 * Tests for a blank node property list in AST form (`type: 'tripleCollection'`,
 * `subType: 'blankNodeProperties'`). The tuple syntax fails; see
 * {@link isTripleCollectionBlankNodePropertiesInputSyntax}.
 *
 * Only the discriminators are checked.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Recognize a blank node property list by its discriminators.
 *
 * ```ts
 * isTripleCollectionBlankNodePropertiesInputBase({
 *   type: 'tripleCollection',
 *   subType: 'blankNodeProperties',
 * }); // true
 * ```
 */
export function isTripleCollectionBlankNodePropertiesInputBase(
  value: unknown
): value is TripleCollectionBlankNodePropertiesInputBase {
  return (
    isObjectLike(value) &&
    value.type === 'tripleCollection' &&
    value.subType === 'blankNodeProperties'
  );
}

/**
 * Tests for an array holding exactly one wildcard, the projection of `SELECT *` and the
 * argument of `COUNT(*)`.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell a `*` projection from a list of variables.
 *
 * ```ts
 * isWildCardInputArray([createWildCardInput()]); // true
 * isWildCardInputArray([v.name]); // false
 * ```
 */
export function isWildCardInputArray(value: unknown): value is [WildcardInput] {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    isObjectLike(value[0]) &&
    value[0].type === 'wildcard'
  );
}

/** Guards and parsers for IRI terms; also accepts `URL` objects and converts them. */
export const termIri = defineType({
  is: isTermIri,
  from: defaultTermFormats.iri,
  assertMessage: 'Expected an iri term.',
  parseMessage: 'Unsupported iri term value provided.',
});

/**
 * Guards and parsers for literal terms; also accepts the built-in literal inputs.
 *
 * Strings become plain literals, a `RegExp` a plain literal of its `source`, integral numbers
 * and bigints `xsd:integer`, other numbers `xsd:decimal`, a `Date` an `xsd:dateTime` in UTC,
 * and booleans `xsd:boolean`. A database's custom `formats` and codec encoders are not included.
 */
export const termLiteral = defineType({
  is: isTermLiteral,
  from: defaultTermFormats.literal,
  assertMessage: 'Expected a literal term.',
  parseMessage: 'Unsupported literal term value provided.',
});

/** Guards and parsers for blank node terms; also accepts `[]` and converts it to a fresh one. */
export const termBlank = defineType({
  is: isTermBlank,
  from: defaultTermFormats.blank,
  assertMessage: 'Expected a blank term.',
  parseMessage: 'Unsupported blank term value provided.',
});

/** Guards and parsers for variable terms. No other input converts to a variable. */
export const termVariable = defineType({
  is: isTermVariable,
  from: [],
  assertMessage: 'Expected a variable term.',
  parseMessage: 'Unsupported variable term value provided.',
});

/** Guards and parsers for RDF lists; also accepts and converts the `[[a, b]]` tuple syntax. */
export const tripleCollectionListInputBase = defineType({
  is: isTripleCollectionListInputBase,
  from: [createTripleCollectionListInputSyntaxFormatter()],
  assertMessage: 'Expected a list term.',
  parseMessage: 'Unsupported list term value provided.',
});

/**
 * Guards and parsers for blank node property lists; also accepts and converts the
 * `[predicate, object]` tuple syntax.
 */
export const tripleCollectionBlankNodePropertiesInputBase = defineType({
  is: isTripleCollectionBlankNodePropertiesInputBase,
  from: [createTripleCollectionBlankNodePropertiesInputSyntaxFormatter()],
  assertMessage: 'Expected a blank node property list.',
  parseMessage: 'Unsupported blank node property list value provided.',
});

/** Guards and parsers for RDF lists and blank node property lists, in AST or tuple syntax. */
export const tripleCollectionInput = defineUnionType({
  members: [tripleCollectionListInputBase, tripleCollectionBlankNodePropertiesInputBase] as const,
  assertMessage: 'Expected a triple collection.',
  parseMessage: 'Unsupported triple collection value provided.',
});

/** Guards and parsers for variable, IRI, literal and blank node terms and their inputs. */
export const term = defineUnionType({
  members: [termVariable, termIri, termLiteral, termBlank] as const,
  assertMessage: 'Expected a variable, IRI, literal or blank node term.',
  parseMessage: 'Unsupported variable, IRI, literal or blank node term value provided.',
});

/** Guards and parsers for the terms that can be an expression: variables, IRIs and literals. */
export const termExpression = defineUnionType({
  members: [termVariable, termIri, termLiteral] as const,
  assertMessage: 'Expected an expression term.',
  parseMessage: 'Unsupported expression term value provided.',
});

/** Guards and parsers for variables and IRIs, the terms that can be a predicate or graph name. */
export const termGraph = defineUnionType({
  members: [termVariable, termIri] as const,
  assertMessage: 'Expected a variable or IRI term.',
  parseMessage: 'Unsupported variable or IRI term value provided.',
});

/** Guards and parsers for concrete values, IRIs and literals, such as `VALUES` entries. */
export const termValues = defineUnionType({
  members: [termIri, termLiteral] as const,
  assertMessage: 'Expected an IRI or literal term.',
  parseMessage: 'Unsupported IRI or literal term value provided.',
});
