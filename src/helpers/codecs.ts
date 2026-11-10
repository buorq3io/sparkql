import type * as AST from '@traqula/rules-sparql-1-1';
import type { Formatter } from './generators.js';
import type { FormatInput, TermFormats } from './term-formats.js';
import type { DefaultQueryReturnType, TermIriOutput, TermLiteralOutput } from './types.js';

const XSD = 'http://www.w3.org/2001/XMLSchema#';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

/** Datatype IRIs of the default codec set. */
export const xsd = {
  string: `${XSD}string`,
  boolean: `${XSD}boolean`,
  integer: `${XSD}integer`,
  decimal: `${XSD}decimal`,
  double: `${XSD}double`,
  float: `${XSD}float`,
  date: `${XSD}date`,
  dateTime: `${XSD}dateTime`,
  langString: RDF_LANG_STRING,
} as const;

/** Datatypes derived from `xsd:integer`; they decode like `xsd:integer`. */
const integerNames = [
  'integer',
  'nonPositiveInteger',
  'negativeInteger',
  'long',
  'int',
  'short',
  'byte',
  'nonNegativeInteger',
  'unsignedLong',
  'unsignedInt',
  'unsignedShort',
  'unsignedByte',
  'positiveInteger',
] as const;
type IntegerDatatype = `${typeof XSD}${(typeof integerNames)[number]}`;
const integerDatatypes = integerNames.map(name => `${XSD}${name}` as IntegerDatatype);

/**
 * How one kind of RDF term becomes a JavaScript value, and optionally back.
 *
 * `decode` receives the RDF/JS term of a bound result variable. `encode` is an
 * input formatter: the database tries it after `formats.literal` and before
 * the built-in conversions, so a value a codec decodes can be passed back into
 * a query.
 */
export interface TermCodec<Output = unknown, Input = never> {
  readonly decode?: (term: DefaultQueryReturnType) => Output;
  readonly encode?: Formatter<Input, AST.TermLiteral>;
}

/**
 * Codecs keyed by datatype IRI (`rdf:langString` for language-tagged
 * strings), plus the pseudo-keys `iri` and `blank` for named and blank nodes.
 * Pseudo-key codecs only decode; use `formats.iri` and `formats.blank` for input.
 */
export type TermCodecs = { readonly [key: string]: TermCodec<any, any> | undefined };

/** The values a codec table's encoders accept. */
export type CodecInput<C extends TermCodecs> = {
  [K in keyof C]: NonNullable<C[K]> extends { readonly encode?: Formatter<infer I, any> }
    ? I
    : never;
}[keyof C];

/** The value a codec table decodes the given key to; the raw term without a decoder. */
export type DecodedValue<C extends TermCodecs, K extends string> = DecoderOutput<
  NonNullable<C[K]> extends { readonly decode?: infer Fn } ? Exclude<Fn, undefined> : never,
  K extends 'iri' ? TermIriOutput : K extends 'blank' ? DefaultQueryReturnType : TermLiteralOutput
>;
type DecoderOutput<Fn, Fallback> = [Fn] extends [never]
  ? Fallback
  : Fn extends (term: any) => infer O
    ? O
    : Fallback;

/** Database input formats widened with the inputs of a codec table's encoders. */
export type WithCodecFormats<F extends TermFormats, C extends TermCodecs> = [
  CodecInput<C>,
] extends [never]
  ? F
  : Omit<F, 'literal'> & {
      literal: readonly Formatter<FormatInput<F, 'literal'> | CodecInput<C>, AST.TermLiteral>[];
    };

/** A decoded `rdf:langString`. */
export type LangString = { value: string; language: string };

/**
 * Merges codec tables, later tables winning per key and per hook. Setting a
 * key or hook to `undefined` removes it, so `refineCodecs(defaults, { [xsd.string]: undefined })`
 * leaves strings as terms.
 */
export function refineCodecs<const Cs extends readonly TermCodecs[]>(
  ...tables: Cs
): RefinedCodecs<Cs> {
  const result: Record<string, TermCodec<any, any> | undefined> = {};
  for (const table of tables) {
    for (const [key, codec] of Object.entries(table)) {
      if (codec === undefined) {
        delete result[key];
        continue;
      }
      const merged: {
        decode?: TermCodec<any, any>['decode'];
        encode?: TermCodec<any, any>['encode'];
      } = {
        ...result[key],
      };
      for (const hook of ['decode', 'encode'] as const) {
        if (!(hook in codec)) continue;
        if (codec[hook] === undefined) delete merged[hook];
        else merged[hook] = codec[hook] as never;
      }
      result[key] = merged;
    }
  }
  return result as RefinedCodecs<Cs>;
}

type Merge<A, B> = Omit<A, keyof B> & {
  [K in keyof B as B[K] extends undefined ? never : K]: K extends keyof A
    ? Omit<A[K], keyof B[K]> & B[K]
    : B[K];
};
export type RefinedCodecs<Cs extends readonly TermCodecs[]> = Cs extends readonly [
  infer A extends TermCodecs,
  ...infer Rest extends readonly TermCodecs[],
]
  ? Rest extends readonly []
    ? A
    : Merge<A, RefinedCodecs<Rest>>
  : {};

/** A codec table resolved for decoding. Builders look decoders up per term. */
export class TermCodecTable {
  private readonly decoders = new Map<string, (term: DefaultQueryReturnType) => unknown>();

  constructor(codecs: TermCodecs = {}) {
    for (const [key, codec] of Object.entries(codecs)) {
      if (codec?.decode) this.decoders.set(key, codec.decode);
      if (codec?.encode && (key === 'iri' || key === 'blank'))
        throw new Error(
          `codecs.${key} cannot encode; configure input for ${key}s with formats.${key}.`
        );
    }
  }

  get size(): number {
    return this.decoders.size;
  }

  /** The decoder for a datatype IRI or the `iri`/`blank` pseudo-keys. */
  decoder(key: string): ((term: DefaultQueryReturnType) => unknown) | undefined {
    return this.decoders.get(key);
  }

  /** Decodes a term by its kind and datatype; returns it unchanged without a decoder. */
  decode(term: DefaultQueryReturnType): unknown {
    const decoder = this.decoders.get(codecKey(term));
    return decoder ? decoder(term) : term;
  }
}

function codecKey(term: DefaultQueryReturnType): string {
  switch (term.termType) {
    case 'NamedNode':
      return 'iri';
    case 'BlankNode':
      return 'blank';
    default:
      return term.datatype.value;
  }
}

/** Input formatters contributed by a codec table's encoders, in key order. */
export function codecFormatters(codecs: TermCodecs = {}): Formatter<any, AST.TermLiteral>[] {
  return Object.values(codecs).flatMap(codec => (codec?.encode ? [codec.encode] : []));
}

// Decoders shared by the default codec set.

export const decodeString = (term: DefaultQueryReturnType): string => term.value;

/** `true`/`1` and `false`/`0`, per the `xsd:boolean` lexical space. */
export const decodeBoolean = (term: DefaultQueryReturnType): boolean => {
  const value = term.value.trim();
  return value === 'true' || value === '1';
};

/** Parses `xsd:double`/`xsd:float`, including `INF`, `-INF` and `NaN`. */
export const decodeDouble = (term: DefaultQueryReturnType): number => {
  const value = term.value.trim();
  if (value === 'INF' || value === '+INF') return Number.POSITIVE_INFINITY;
  if (value === '-INF') return Number.NEGATIVE_INFINITY;
  return Number(value);
};

export const decodeNumber = (term: DefaultQueryReturnType): number => Number(term.value.trim());

export const decodeBigint = (term: DefaultQueryReturnType): bigint =>
  BigInt(term.value.trim().replace(/^\+/, ''));

const timezone = /(?:Z|[+-]\d{2}:\d{2})$/;

/** `xsd:dateTime`; a value without a timezone is read as UTC, not local time. */
export const decodeDateTime = (term: DefaultQueryReturnType): Date => {
  const value = term.value.trim();
  return new Date(timezone.test(value) ? value : `${value}Z`);
};

/** `xsd:date` as midnight at its timezone, or UTC midnight without one. */
export const decodeDate = (term: DefaultQueryReturnType): Date => {
  const value = term.value.trim();
  const zone = value.match(timezone)?.[0];
  const date = zone ? value.slice(0, -zone.length) : value;
  return new Date(`${date}T00:00:00${zone ?? 'Z'}`);
};

export const decodeLangString = (term: DefaultQueryReturnType): LangString => ({
  value: term.value,
  language: term.termType === 'Literal' ? term.language : '',
});

const langStringFormatter: Formatter<LangString, AST.TermLiteral> = {
  test: (value): value is LangString =>
    typeof value === 'object' &&
    value !== null &&
    !('termType' in value) &&
    !('type' in value) &&
    typeof (value as LangString).value === 'string' &&
    typeof (value as LangString).language === 'string' &&
    (value as LangString).language !== '',
  format: (value, factory) => factory.literal(value.value, value.language),
};

export interface DefaultCodecsOptions<
  I extends 'number' | 'bigint' = 'number' | 'bigint',
  N extends 'number' | 'string' = 'number' | 'string',
> {
  /** `xsd:integer` and its derived types. `number` loses precision past 2^53. */
  integer: I;
  /** `xsd:decimal`. `number` loses precision; `string` keeps the lexical form. */
  decimal: N;
}

export type DefaultCodecs<I extends 'number' | 'bigint', N extends 'number' | 'string'> = {
  readonly [xsd.string]: TermCodec<string>;
  readonly [xsd.boolean]: TermCodec<boolean>;
  readonly [xsd.decimal]: TermCodec<N extends 'string' ? string : number>;
  readonly [xsd.double]: TermCodec<number>;
  readonly [xsd.float]: TermCodec<number>;
  readonly [xsd.date]: TermCodec<Date>;
  readonly [xsd.dateTime]: TermCodec<Date>;
  readonly [xsd.langString]: TermCodec<LangString, LangString>;
} & { readonly [K in IntegerDatatype]: TermCodec<I extends 'bigint' ? bigint : number> };

/**
 * The default codec set. Opt in with `SparqlDatabase.create({ codecs: defaultCodecs(...) })`;
 * without `codecs`, unannotated variables return RDF/JS terms.
 *
 * Decodes `xsd:string` to a string, `xsd:boolean` to a boolean, `xsd:integer`
 * (and derived types) and `xsd:decimal` as chosen, `xsd:double`/`xsd:float` to
 * a number, `xsd:dateTime`/`xsd:date` to a `Date` and `rdf:langString` to
 * `{ value, language }`, which it also accepts as input. IRIs, blank nodes and
 * other datatypes stay terms.
 */
export function defaultCodecs<I extends 'number' | 'bigint', N extends 'number' | 'string'>(
  options: DefaultCodecsOptions<I, N>
): DefaultCodecs<I, N> {
  const integer: TermCodec<unknown> = {
    decode: options.integer === 'bigint' ? decodeBigint : decodeNumber,
  };
  const codecs: Record<string, TermCodec<any, any>> = {
    [xsd.string]: { decode: decodeString },
    [xsd.boolean]: { decode: decodeBoolean },
    [xsd.decimal]: { decode: options.decimal === 'string' ? decodeString : decodeNumber },
    [xsd.double]: { decode: decodeDouble },
    [xsd.float]: { decode: decodeDouble },
    [xsd.date]: { decode: decodeDate },
    [xsd.dateTime]: { decode: decodeDateTime },
    [xsd.langString]: { decode: decodeLangString, encode: langStringFormatter },
  };
  for (const datatype of integerDatatypes) codecs[datatype] = integer;
  return codecs as DefaultCodecs<I, N>;
}
