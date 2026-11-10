import { describe, expect, test } from 'vitest';
import {
  type FactoryFunctions,
  isGraphNodeInput,
  isTripleCollectionBlankNodePropertiesInputSyntax,
  parseOrThrowTermExpressionInput,
  SparqlDatabase,
  term,
  termExpression,
  termGraph,
  termValues,
  tripleCollectionBlankNodePropertiesInputBase,
} from '#src/index.js';

const db = SparqlDatabase.create();
const factory: FactoryFunctions = {
  variable: value => db.variable(value),
  iri: (value, prefix) => (prefix === undefined ? db.iri(value) : db.iri(value, prefix)),
  blank: value => db.blank(value),
  literal: (value, lang) => db.literal(value, lang),
};

describe('parseOrThrowTermExpressionInput', () => {
  test('parses variables, IRIs and literals', () => {
    const name = db.variable('name');
    const iri = db.iri('http://xmlns.com/foaf/0.1/name');
    expect(parseOrThrowTermExpressionInput(name, factory)).toBe(name);
    expect(parseOrThrowTermExpressionInput(iri, factory)).toBe(iri);
    expect(
      parseOrThrowTermExpressionInput(new URL('https://schema.org/Book'), factory)
    ).toMatchObject({ subType: 'namedNode', value: 'https://schema.org/Book' });
    expect(parseOrThrowTermExpressionInput('Ada', factory)).toMatchObject({
      subType: 'literal',
      value: 'Ada',
    });
    expect(parseOrThrowTermExpressionInput(36, factory)).toMatchObject({
      subType: 'literal',
      value: '36',
    });
  });

  test('throws when no term kind accepts the value', () => {
    expect(() => parseOrThrowTermExpressionInput(db.blank(), factory)).toThrow(
      'Unsupported expression term value provided.'
    );
    expect(() => parseOrThrowTermExpressionInput({ name: 'Ada' }, factory)).toThrow(
      'Unsupported expression term value provided.'
    );
  });
});

describe('isTripleCollectionBlankNodePropertiesInputSyntax', () => {
  test('rejects arrays with a nullish or missing first element', () => {
    for (const value of [[], [undefined], [null]]) {
      expect(isTripleCollectionBlankNodePropertiesInputSyntax(value)).toBe(false);
    }
    for (const value of [
      [undefined, 'Ada'],
      [null, db.variable('name')],
    ]) {
      expect(isTripleCollectionBlankNodePropertiesInputSyntax(value)).toBe(false);
      expect(isGraphNodeInput(value)).toBe(false);
    }
  });

  test('accepts a predicate and an object', () => {
    const name = db.iri('http://xmlns.com/foaf/0.1/name');
    expect(isTripleCollectionBlankNodePropertiesInputSyntax([name, 'Ada'])).toBe(true);
  });
});

describe('term type error messages', () => {
  test.each([
    [term, 'Expected a variable, IRI, literal or blank node term.', {}],
    [termExpression, 'Expected an expression term.', db.blank()],
    [termGraph, 'Expected a variable or IRI term.', 'Ada'],
    [termValues, 'Expected an IRI or literal term.', db.variable('name')],
    [tripleCollectionBlankNodePropertiesInputBase, 'Expected a blank node property list.', {}],
  ] as const)('%#: assert names the accepted kinds', (type, message, value) => {
    expect(() => type.assert(value)).toThrow(message);
  });

  test.each([
    [term, 'Unsupported variable, IRI, literal or blank node term value provided.', {}],
    [termExpression, 'Unsupported expression term value provided.', db.blank()],
    [termGraph, 'Unsupported variable or IRI term value provided.', 'Ada'],
    [termValues, 'Unsupported IRI or literal term value provided.', db.variable('name')],
    [
      tripleCollectionBlankNodePropertiesInputBase,
      'Unsupported blank node property list value provided.',
      {},
    ],
  ] as const)('%#: parseOrThrow names the accepted kinds', (type, message, value) => {
    expect(() => type.parseOrThrow(value, factory)).toThrow(message);
  });
});
