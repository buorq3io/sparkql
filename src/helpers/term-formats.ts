import type * as AST from '@traqula/rules-sparql-1-1';
import type { Formatter } from './generators.js';

const stringFormatter: Formatter<string, AST.TermLiteral> = {
  test: (value): value is string => typeof value === 'string',
  format: (value, factory) => factory.literal(value),
};

const regexFormatter: Formatter<RegExp, AST.TermLiteral> = {
  test: (value): value is RegExp => value instanceof RegExp,
  format: (value, factory) => factory.literal(value.source),
};

const numberFormatter: Formatter<number, AST.TermLiteral> = {
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
};

const bigintFormatter: Formatter<bigint, AST.TermLiteral> = {
  test: (value): value is bigint => typeof value === 'bigint',
  format: (value, factory) =>
    factory.literal(String(value), factory.iri('http://www.w3.org/2001/XMLSchema#integer')),
};

const dateFormatter: Formatter<Date, AST.TermLiteral> = {
  test: (value): value is Date => value instanceof Date,
  format: (value, factory) =>
    factory.literal(value.toISOString(), factory.iri('http://www.w3.org/2001/XMLSchema#dateTime')),
};

const booleanFormatter: Formatter<boolean, AST.TermLiteral> = {
  test: (value): value is boolean => typeof value === 'boolean',
  format: (value, factory) =>
    factory.literal(String(value), factory.iri('http://www.w3.org/2001/XMLSchema#boolean')),
};

const urlFormatter: Formatter<URL, AST.TermIri> = {
  test: (value): value is URL => value instanceof URL,
  format: (value, factory) => factory.iri(String(value)),
};

const tupleFormatter: Formatter<[], AST.TermBlank> = {
  test: (value): value is [] => Array.isArray(value) && value.length === 0,
  format: (_, factory) => factory.blank(),
};

/** Custom input formats belong to the database that receives them. */
export type TermFormats = {
  iri?: readonly Formatter<any, AST.TermIri>[];
  literal?: readonly Formatter<any, AST.TermLiteral>[];
  blank?: readonly Formatter<any, AST.TermBlank>[];
};

export type FormatInput<F extends TermFormats, K extends keyof TermFormats> =
  NonNullable<F[K]> extends readonly Formatter<infer I, any>[] ? I : never;

export const defaultTermFormats = {
  iri: Object.freeze([urlFormatter]),
  literal: Object.freeze([
    stringFormatter,
    regexFormatter,
    numberFormatter,
    bigintFormatter,
    dateFormatter,
    booleanFormatter,
  ]),
  blank: Object.freeze([tupleFormatter]),
} as const;
