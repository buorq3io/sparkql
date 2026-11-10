import { describe, expect, test } from 'vitest';
import {
  type FactoryFunctions,
  parseOrThrowTermExpressionInput,
  SparqlDatabase,
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
