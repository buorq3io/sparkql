import { termIriRegistry, termBlankRegistry, termLiteralRegistry } from './utilities.js';

declare module './types.js' {
  interface LiteralFormatMap {
    string: string;
    regex: RegExp;
    number: number;
    bigint: bigint;
    boolean: boolean;
    date: Date;
  }

  interface NamedNodeFormatMap {
    url: URL;
  }

  interface BlankFormatMap {
    tuple: [];
  }
}

termLiteralRegistry.register('string', {
  test: (value): value is string => typeof value === 'string',
  format: value =>
    ({
      type: 'term',
      subType: 'literal',
      value: value,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      langOrIri: undefined,
    } as const),
});

termLiteralRegistry.register('regex', {
  test: (value): value is RegExp => value instanceof RegExp,
  format: value =>
    ({
      type: 'term',
      subType: 'literal',
      value: value.source,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      langOrIri: undefined,
    } as const),
});

termLiteralRegistry.register('number', {
  test: (value): value is number => typeof value === 'number',
  format: value =>
    ({
      type: 'term',
      subType: 'literal',
      value: String(value),
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      langOrIri: Number.isInteger(value)
        ? 'http://www.w3.org/2001/XMLSchema#integer'
        : 'http://www.w3.org/2001/XMLSchema#decimal',
    } as const),
});

termLiteralRegistry.register('bigint', {
  test: (value): value is bigint => typeof value === 'bigint',
  format: value =>
    ({
      type: 'term',
      subType: 'literal',
      value: String(value),
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      langOrIri: 'http://www.w3.org/2001/XMLSchema#integer',
    } as const),
});

termLiteralRegistry.register('date', {
  test: (value): value is Date => value instanceof Date,
  format: value =>
    ({
      type: 'term',
      subType: 'literal',
      value: value.toISOString(),
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      langOrIri: 'http://www.w3.org/2001/XMLSchema#datetime',
    } as const),
});

termLiteralRegistry.register('boolean', {
  test: (value): value is boolean => typeof value === 'boolean',
  format: value =>
    ({
      type: 'term',
      subType: 'literal',
      value: String(value),
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      langOrIri: 'http://www.w3.org/2001/XMLSchema#boolean',
    } as const),
});

termIriRegistry.register('url', {
  test: (value): value is URL => value instanceof URL,
  format: value =>
    ({
      type: 'term',
      subType: 'namedNode',
      value: value.toString(),
      loc: {
        sourceLocationType: 'autoGenerate',
      },
    } as const),
});

termBlankRegistry.register('tuple', {
  test: (value): value is [] => Array.isArray(value) && value.length === 0,
  format: value =>
    ({
      type: 'term',
      subType: 'blankNode',
      label: value.toString(),
      loc: {
        sourceLocationType: 'autoGenerate',
      },
    } as const),
});
