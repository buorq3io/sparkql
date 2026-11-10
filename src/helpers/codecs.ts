import type * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';
import type { Formatter } from './generators.js';
import type { FormatInput, TermFormats } from './term-formats.js';
import type { DefaultQueryReturnType, TermIriOutput, TermLiteralOutput } from './types.js';

const XSD = 'http://www.w3.org/2001/XMLSchema#';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';

/**
 * Full datatype IRIs for use as codec table keys, such as `xsd.integer`.
 *
 * `xsd.langString` is `rdf:langString`, the datatype of language-tagged strings. The types
 * derived from `xsd:integer` (`xsd:int`, `xsd:long`, ...) are decoded by {@link defaultCodecs}
 * too but have no entry here.
 */
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
 *
 * @typeParam Output - The value `decode` returns.
 * @typeParam Input - The values `encode` accepts; `never` for a codec that only decodes.
 */
export interface TermCodec<Output = unknown, Input = never> {
  /**
   * Converts the RDF/JS term of a bound variable to a result value. Unbound variables stay
   * `undefined` without calling it. If it throws, the query rejects with a `SparkqlQueryError`.
   */
  readonly decode?: (term: DefaultQueryReturnType) => Output;
  /** Input formatter that turns matching JavaScript values into literal terms. */
  readonly encode?: Formatter<Input, AST.TermLiteral>;
}

/**
 * Codecs keyed by datatype IRI (`rdf:langString` for language-tagged
 * strings), plus the pseudo-keys `iri` and `blank` for named and blank nodes.
 * Pseudo-key codecs only decode; use `formats.iri` and `formats.blank` for input.
 */
export type TermCodecs = { readonly [key: string]: TermCodec<any, any> | undefined };

/** @internal The union of the input types a codec table's encoders accept. */
export type CodecInput<C extends TermCodecs> = {
  [K in keyof C]: NonNullable<C[K]> extends { readonly encode?: Formatter<infer I, any> }
    ? I
    : never;
}[keyof C];

/**
 * The static type a codec table decodes the given key to.
 *
 * Codecs change runtime values only: a bare variable is still typed as an RDF/JS term. Use this
 * type to name the decoded type, for example to annotate a row. Without a decoder for the key it
 * is the raw term type: {@link TermIriOutput} for `iri`, any RDF/JS term for `blank`, and
 * {@link TermLiteralOutput} for datatype keys.
 *
 * @typeParam C - The codec table.
 * @typeParam K - A datatype IRI, or the `iri`/`blank` pseudo-key.
 *
 * @example
 * Name the type ages decode to under bigint integers.
 *
 * ```ts
 * const codecs = defaultCodecs({ integer: 'bigint', decimal: 'string' });
 * type Age = DecodedValue<typeof codecs, typeof xsd.integer>; // bigint
 * type Price = DecodedValue<typeof codecs, typeof xsd.decimal>; // string
 * ```
 */
export type DecodedValue<C extends TermCodecs, K extends string> = DecoderOutput<
  NonNullable<C[K]> extends { readonly decode?: infer Fn } ? Exclude<Fn, undefined> : never,
  K extends 'iri' ? TermIriOutput : K extends 'blank' ? DefaultQueryReturnType : TermLiteralOutput
>;
type DecoderOutput<Fn, Fallback> = [Fn] extends [never]
  ? Fallback
  : Fn extends (term: any) => infer O
    ? O
    : Fallback;

/**
 * Every value the decoders of a codec table can produce; `never` for a table without decoders.
 *
 * @typeParam C - The codec table.
 */
export type CodecOutput<C extends TermCodecs> = {
  [K in keyof C]-?: NonNullable<C[K]> extends {
    readonly decode?: (term: any) => infer O;
  }
    ? O
    : never;
}[keyof C];

/**
 * A SELECT row type as a database with the codec table `C` returns it.
 *
 * A field typed as a raw RDF/JS term ({@link DefaultQueryReturnType}) is a projected variable
 * without a cast. Codecs decode it by the datatype of each bound term, which is only known at
 * runtime, so the field becomes the raw term or any value a decoder of `C` returns. Other
 * fields, and every field when `C` has no decoders, keep their type.
 *
 * @typeParam Row - The row type inferred from the projection.
 * @typeParam C - The database's codec table.
 *
 * @example
 * Type a row the way a database configured with these codecs returns it.
 *
 * ```ts
 * const codecs = defaultCodecs({ integer: 'number', decimal: 'number' });
 * type Row = CodecRow<{ age: DefaultQueryReturnType }, typeof codecs>;
 * // { age: DefaultQueryReturnType | string | number | boolean | Date | LangString }
 * ```
 */
export type CodecRow<Row, C extends TermCodecs> = [CodecOutput<C>] extends [never]
  ? Row
  : { [K in keyof Row]: CodecField<Row[K], CodecOutput<C>> };
type CodecField<V, O> = [Exclude<V, undefined>] extends [DefaultQueryReturnType]
  ? [DefaultQueryReturnType] extends [Exclude<V, undefined>]
    ? V | O
    : V
  : V;

/** @internal Database `formats` with `literal` widened to the inputs of the codec encoders. */
export type WithCodecFormats<F extends TermFormats, C extends TermCodecs> = [
  CodecInput<C>,
] extends [never]
  ? F
  : Omit<F, 'literal'> & {
      literal: readonly Formatter<FormatInput<F, 'literal'> | CodecInput<C>, AST.TermLiteral>[];
    };

/**
 * A language-tagged string: `value` is the text and `language` the tag, such as `en`.
 *
 * {@link decodeLangString} returns this shape, and the `rdf:langString` codec of
 * {@link defaultCodecs} accepts it back as input when `language` is not empty.
 */
export type LangString = { value: string; language: string };

/**
 * Merges codec tables, later tables winning per key and per hook.
 *
 * Hooks merge separately, so a later `{ decode }` replaces an earlier decoder and keeps the
 * earlier `encode`. Setting a key or a hook to `undefined` removes it. The result type tracks
 * the merge, so the database's literal inputs reflect the encoders that remain.
 *
 * @param tables - Codec tables, merged left to right.
 *
 * @example
 * Keep plain strings as RDF/JS literals and decode IRIs as `URL` objects.
 *
 * ```ts
 * const people = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: refineCodecs(defaultCodecs({ integer: 'number', decimal: 'number' }), {
 *     [xsd.string]: undefined,
 *     iri: { decode: term => new URL(term.value) },
 *   }),
 * });
 * const rows = await people
 *   .select({ person: v.person, name: v.name, age: v.age })
 *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.age, v.age));
 * // [{ person: URL { href: 'https://example.org/ada' }, name: Literal { value: 'Ada' },
 * //    age: 36 }, ...]
 * ```
 *
 * @example
 * Read language-tagged names as plain text, still accepting `{ value, language }` as input.
 *
 * ```ts
 * const people = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: refineCodecs(defaultCodecs({ integer: 'number', decimal: 'number' }), {
 *     [xsd.langString]: { decode: term => term.value },
 *   }),
 * });
 * const rows = await people
 *   .select({ name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * // [{ name: 'Ada Lovelace' }, ...] for "Ada Lovelace"@en
 * people.literal({ value: 'Ada Lovelace', language: 'en' }); // "Ada Lovelace"@en
 * ```
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
/** @internal The merged type of codec tables. */
export type RefinedCodecs<Cs extends readonly TermCodecs[]> = Cs extends readonly [
  infer A extends TermCodecs,
  ...infer Rest extends readonly TermCodecs[],
]
  ? Rest extends readonly []
    ? A
    : Merge<A, RefinedCodecs<Rest>>
  : {};

/**
 * The decoders of a codec table, indexed for lookup while results are read.
 *
 * {@link SparqlDatabase.create} builds one from its `codecs` option and hands it to query
 * builders and query modules. Encoders are not part of the table: the database adds them to
 * its literal input formats instead.
 */
export class TermCodecTable {
  private readonly decoders = new Map<string, (term: DefaultQueryReturnType) => unknown>();

  /**
   * Indexes the decoders of a codec table.
   *
   * @param codecs - Codecs keyed by datatype IRI or by the `iri`/`blank` pseudo-keys.
   * @throws {@link SparkqlError} When the `iri` or `blank` codec has an `encode` hook; configure those
   * inputs with `formats.iri` and `formats.blank`.
   *
   * @example
   * Index the default codecs.
   *
   * ```ts
   * const table = new TermCodecTable(defaultCodecs({ integer: 'number', decimal: 'number' }));
   * table.size; // 21: one decoder per datatype, counting the 13 integer types
   * ```
   */
  constructor(codecs: TermCodecs = {}) {
    for (const [key, codec] of Object.entries(codecs)) {
      if (codec?.decode) this.decoders.set(key, codec.decode);
      if (codec?.encode && (key === 'iri' || key === 'blank'))
        throw new SparkqlError({
          message: `codecs.${key} cannot encode; configure input for ${key}s with formats.${key}.`,
        });
    }
  }

  /** The number of keys that have a decoder. */
  get size(): number {
    return this.decoders.size;
  }

  /**
   * Returns the decoder registered for a key, or `undefined` if there is none.
   *
   * @param key - A datatype IRI, or the `iri`/`blank` pseudo-key.
   *
   * @example
   * Check whether IRIs are decoded.
   *
   * ```ts
   * const table = new TermCodecTable(defaultCodecs({ integer: 'number', decimal: 'number' }));
   * table.decoder(xsd.integer); // decodeNumber
   * table.decoder('iri'); // undefined: IRIs stay NamedNode terms
   * ```
   */
  decoder(key: string): ((term: DefaultQueryReturnType) => unknown) | undefined {
    return this.decoders.get(key);
  }

  /**
   * Decodes a term with the decoder for its datatype, or returns it unchanged if there is none.
   *
   * Named nodes are looked up under `iri`, blank nodes under `blank`, and literals under their
   * datatype IRI (`rdf:langString` for language-tagged strings).
   *
   * @param term - The RDF/JS term of a bound result variable.
   *
   * @example
   * Decode ages read without codecs the way a database with the default codecs would.
   *
   * ```ts
   * const table = new TermCodecTable(defaultCodecs({ integer: 'number', decimal: 'number' }));
   * const rows = await db.select({ age: v.age }).where(triples(v.person, n.foaf.age, v.age));
   * table.decode(rows[0].age); // 36 for "36"^^xsd:integer
   * ```
   */
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

/** @internal Collects the `encode` formatters of a codec table, in key order. */
export function codecFormatters(codecs: TermCodecs = {}): Formatter<any, AST.TermLiteral>[] {
  return Object.values(codecs).flatMap(codec => (codec?.encode ? [codec.encode] : []));
}

// Decoders shared by the default codec set.

/**
 * Decodes a term to its lexical form, `term.value`, unchanged.
 *
 * {@link defaultCodecs} uses it for `xsd:string`, and for `xsd:decimal` with `decimal: 'string'`.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read names as plain strings instead of RDF/JS literals.
 *
 * ```ts
 * const people = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.string]: { decode: decodeString } },
 * });
 * const rows = await people.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
 * // [{ name: 'Ada' }, ...]
 * ```
 */
export const decodeString = (term: DefaultQueryReturnType): string => term.value;

/**
 * Decodes an `xsd:boolean` literal: `true` and `1` give `true`, any other value gives `false`.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read whether books are abridged as booleans.
 *
 * ```ts
 * const library = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.boolean]: { decode: decodeBoolean } },
 * });
 * const rows = await library
 *   .select({ abridged: v.abridged })
 *   .where(triples(v.book, n.schema.abridged, v.abridged));
 * // [{ abridged: true }, ...] for "1"^^xsd:boolean or "true"^^xsd:boolean
 * ```
 */
export const decodeBoolean = (term: DefaultQueryReturnType): boolean => {
  const value = term.value.trim();
  return value === 'true' || value === '1';
};

/**
 * Decodes an `xsd:double` or `xsd:float` literal to a number, including `INF`, `-INF` and `NaN`.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read review ratings stored as doubles.
 *
 * ```ts
 * const library = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.double]: { decode: decodeDouble } },
 * });
 * const rows = await library
 *   .select({ rating: v.rating })
 *   .where(triples(v.review, n.schema.ratingValue, v.rating));
 * // [{ rating: 4.5 }, ...] for "4.5E0"^^xsd:double
 * ```
 */
export const decodeDouble = (term: DefaultQueryReturnType): number => {
  const value = term.value.trim();
  if (value === 'INF' || value === '+INF') return Number.POSITIVE_INFINITY;
  if (value === '-INF') return Number.NEGATIVE_INFINITY;
  return Number(value);
};

/**
 * Decodes a numeric literal to a number with `Number()`, after trimming whitespace.
 *
 * {@link defaultCodecs} uses it for `integer: 'number'` and `decimal: 'number'`. Integers past
 * 2^53 and long decimals lose precision; use {@link decodeBigint} or {@link decodeString} to
 * keep them exact.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read book prices as numbers.
 *
 * ```ts
 * const library = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.decimal]: { decode: decodeNumber } },
 * });
 * const rows = await library
 *   .select({ price: v.price })
 *   .where(triples(v.book, n.schema.price, v.price));
 * // [{ price: 12.5 }, ...] for "12.50"^^xsd:decimal
 * ```
 */
export const decodeNumber = (term: DefaultQueryReturnType): number => Number(term.value.trim());

/**
 * Decodes an integer literal to a bigint, after trimming whitespace and a leading `+`.
 *
 * {@link defaultCodecs} uses it for `integer: 'bigint'`. A value with a fraction, such as
 * `"1.5"`, makes `BigInt` throw, so the query rejects.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read ages as bigints.
 *
 * ```ts
 * const people = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.integer]: { decode: decodeBigint } },
 * });
 * const rows = await people.select({ age: v.age }).where(triples(v.person, n.foaf.age, v.age));
 * // [{ age: 36n }, ...]
 * ```
 */
export const decodeBigint = (term: DefaultQueryReturnType): bigint =>
  BigInt(term.value.trim().replace(/^\+/, ''));

const timezone = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Decodes an `xsd:dateTime` literal to a `Date`. A value without a timezone is read as UTC,
 * not local time.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read publication timestamps as dates.
 *
 * ```ts
 * const library = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.dateTime]: { decode: decodeDateTime } },
 * });
 * const rows = await library
 *   .select({ published: v.published })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * // [{ published: 2020-05-01T09:30:00.000Z }, ...] for "2020-05-01T09:30:00"^^xsd:dateTime
 * ```
 */
export const decodeDateTime = (term: DefaultQueryReturnType): Date => {
  const value = term.value.trim();
  return new Date(timezone.test(value) ? value : `${value}Z`);
};

/**
 * Decodes an `xsd:date` literal to a `Date` at midnight in its timezone, or at UTC midnight
 * when it has none.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read publication dates as dates.
 *
 * ```ts
 * const library = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.date]: { decode: decodeDate } },
 * });
 * const rows = await library
 *   .select({ published: v.published })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * // [{ published: 1843-10-01T00:00:00.000Z }, ...] for "1843-10-01"^^xsd:date
 * ```
 */
export const decodeDate = (term: DefaultQueryReturnType): Date => {
  const value = term.value.trim();
  const zone = value.match(timezone)?.[0];
  const date = zone ? value.slice(0, -zone.length) : value;
  return new Date(`${date}T00:00:00${zone ?? 'Z'}`);
};

/**
 * Decodes a language-tagged literal to a {@link LangString}, `{ value, language }`.
 *
 * The language is `''` for a term that is not a literal.
 *
 * @param term - The RDF/JS term of a bound result variable.
 *
 * @example
 * Read language-tagged names with their language.
 *
 * ```ts
 * const people = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: { [xsd.langString]: { decode: decodeLangString } },
 * });
 * const rows = await people.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
 * // [{ name: { value: 'Ada Lovelace', language: 'en' } }, ...]
 * ```
 */
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

/** How {@link defaultCodecs} decodes integers and decimals. Both choices are required. */
export interface DefaultCodecsOptions<
  I extends 'number' | 'bigint' = 'number' | 'bigint',
  N extends 'number' | 'string' = 'number' | 'string',
> {
  /**
   * Decoding of `xsd:integer` and its derived types (`xsd:int`, `xsd:long`, ...). `number`
   * loses precision past 2^53; `bigint` is exact.
   */
  integer: I;
  /** Decoding of `xsd:decimal`. `number` can lose precision; `string` keeps the lexical form. */
  decimal: N;
}

/** The codec table type {@link defaultCodecs} returns for the given numeric choices. */
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
 * Returns the built-in codec table, for the `codecs` option of {@link SparqlDatabase.create}.
 *
 * Decodes `xsd:string` to a string, `xsd:boolean` to a boolean, `xsd:integer`
 * (and derived types) and `xsd:decimal` as chosen, `xsd:double`/`xsd:float` to
 * a number, `xsd:dateTime`/`xsd:date` to a `Date` and `rdf:langString` to
 * `{ value, language }`, which it also accepts as input. IRIs, blank nodes and
 * other datatypes stay terms. Without `codecs`, nothing is decoded. Adjust the table
 * with {@link refineCodecs}.
 *
 * @param options - How to decode integers and decimals.
 *
 * @example
 * Read ages as exact bigints and prices in their lexical form.
 *
 * ```ts
 * const library = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   codecs: defaultCodecs({ integer: 'bigint', decimal: 'string' }),
 * });
 * const rows = await library
 *   .select({ title: v.title, price: v.price, published: v.published })
 *   .where(
 *     triples(v.book, n.schema.name, v.title),
 *     triples(v.book, n.schema.price, v.price),
 *     triples(v.book, n.schema.datePublished, v.published)
 *   );
 * // [{ title: 'Emma', price: '12.50', published: 1815-12-23T00:00:00.000Z }, ...]
 * ```
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
