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
  format: (value, factory) => factory.literal(value),
});

termLiteralRegistry.register('regex', {
  test: (value): value is RegExp => value instanceof RegExp,
  format: (value, factory) => factory.literal(value.source),
});

termLiteralRegistry.register('number', {
  test: (value): value is number => typeof value === 'number',
  format: (value, factory) =>
    factory.literal(
      String(value),
      factory.iri(
        Number.isInteger(value)
          ? 'http://www.w3.org/2001/XMLSchema#integer'
          : 'http://www.w3.org/2001/XMLSchema#decimal'
      )
    ),
});

termLiteralRegistry.register('bigint', {
  test: (value): value is bigint => typeof value === 'bigint',
  format: (value, factory) =>
    factory.literal(String(value), factory.iri('http://www.w3.org/2001/XMLSchema#integer')),
});

termLiteralRegistry.register('date', {
  test: (value): value is Date => value instanceof Date,
  format: (value, factory) =>
    factory.literal(value.toISOString(), factory.iri('http://www.w3.org/2001/XMLSchema#dateTime')),
});

termLiteralRegistry.register('boolean', {
  test: (value): value is boolean => typeof value === 'boolean',
  format: (value, factory) =>
    factory.literal(String(value), factory.iri('http://www.w3.org/2001/XMLSchema#boolean')),
});

termIriRegistry.register('url', {
  test: (value): value is URL => value instanceof URL,
  format: (value, factory) => factory.iri(String(value)),
});

termBlankRegistry.register('tuple', {
  test: (value): value is [] => Array.isArray(value) && value.length === 0,
  format: (_, factory) => factory.blank(),
});
