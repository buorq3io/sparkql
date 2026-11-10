import { SparkqlError } from '../database/errors.js';
import type { FactoryFunctions } from './types.js';

type Guard<T> = (value: unknown) => value is T;
type Parser<T> = (value: unknown, factoryFunctions: FactoryFunctions) => T | null;

type Guarded<G> = G extends Guard<infer T> ? T : never;
type Parsed<P> = P extends Parser<infer T> ? T : never;

/**
 * A custom input format: a type guard plus a conversion to an RDF term.
 *
 * Pass formatters in the `formats` option of {@link SparqlDatabase.create}, or as a codec's
 * `encode`. The database tries custom formatters before the built-in ones and uses the first
 * whose `test` passes. Each formatter also widens the input types of that database's
 * `iri`, `literal` or `blank` method.
 *
 * @typeParam T - The JavaScript values the formatter accepts.
 * @typeParam R - The term it produces, such as `AST.TermLiteral`.
 *
 * @example
 * Write prices as `xsd:decimal` literals with two decimal places.
 *
 * ```ts
 * class Price {
 *   constructor(readonly amount: number) {}
 * }
 * const library = SparqlDatabase.create({
 *   managerConfig: prefixes,
 *   formats: {
 *     literal: [
 *       {
 *         test: (value): value is Price => value instanceof Price,
 *         format: (value, factory) =>
 *           factory.literal(value.amount.toFixed(2), factory.iri(xsd.decimal)),
 *       },
 *     ],
 *   },
 * });
 * library.literal(new Price(12.5)); // "12.50"^^xsd:decimal
 * ```
 */
export type Formatter<T, R> = {
  /** Returns `true` for the values this formatter converts. */
  test(value: unknown): value is T;
  /** Converts a value that passed `test`, building terms with the supplied factories. */
  format(value: T, factoryFunctions: FactoryFunctions): R;
};

type FormatterInput<F> = F extends Formatter<infer I, any> ? I : never;
type FormatterInputs<Fs extends readonly Formatter<any, any>[]> = FormatterInput<Fs[number]>;

type DefinedType<Output, Input = Output> = {
  is: Guard<Output>;
  accepts: (value: unknown) => value is Input;
  assert: (value: unknown) => asserts value is Output;
  parse: Parser<Output>;
  canParse: (value: unknown) => boolean;
  parseOrThrow: (value: unknown, factoryFunctions: FactoryFunctions) => Output;
};

type OutputOf<D> = D extends DefinedType<infer O, any> ? O : never;
type InputOf<D> = D extends DefinedType<any, infer I> ? I : never;

/**
 * Creates the guards and parsers for a term type and the input formats that convert to it.
 *
 * The result has `is` (the value already has the type), `accepts` (it has the type or a
 * formatter in `from` accepts it), `assert` (throws `assertMessage` unless `is` passes, even
 * for values `accepts` allows), `parse` (returns the value, its formatted form, or `null`),
 * `canParse` (same as `accepts`) and `parseOrThrow` (throws `parseMessage` instead of
 * returning `null`). Formatters are tried in order. {@link termIri} and {@link termLiteral}
 * are built this way.
 *
 * @param options - The type guard `is`, the formatters `from`, and the messages of the
 * errors `assert` and `parseOrThrow` throw.
 *
 * @example
 * Accept IRI terms and `URL` objects, converting URLs to IRI terms.
 *
 * ```ts
 * const iris = defineType({
 *   is: isTermIri,
 *   from: [
 *     {
 *       test: (value): value is URL => value instanceof URL,
 *       format: (value: URL, factory: FactoryFunctions) => factory.iri(value.href),
 *     },
 *   ],
 *   assertMessage: 'Expected an IRI term.',
 *   parseMessage: 'Expected an IRI term or a URL.',
 * });
 * iris.accepts(new URL('http://xmlns.com/foaf/0.1/name')); // true
 * iris.is(new URL('http://xmlns.com/foaf/0.1/name')); // false: not a term yet
 * ```
 */
export function defineType<
  T,
  Fs extends readonly Formatter<any, T>[] = readonly Formatter<never, T>[],
>(options: {
  is: Guard<T>;
  from?: Fs;
  assertMessage: string;
  parseMessage: string;
}): DefinedType<T, T | FormatterInputs<Fs>> {
  const is = options.is;
  const from = (options.from ?? []) as Fs;

  type Input = T | FormatterInputs<Fs>;

  const accepts = (value: unknown): value is Input => {
    if (is(value)) {
      return true;
    }

    for (const formatter of from) {
      if (formatter.test(value)) {
        return true;
      }
    }

    return false;
  };

  const assert = (value: unknown): asserts value is T => {
    if (!is(value)) {
      throw new SparkqlError({ message: options.assertMessage });
    }
  };

  const parse: Parser<T> = (value: unknown, factoryFunctions: FactoryFunctions) => {
    if (is(value)) {
      return value;
    }

    for (const formatter of from) {
      if (formatter.test(value)) {
        return formatter.format(value, factoryFunctions);
      }
    }

    return null;
  };

  const canParse = (value: unknown): boolean => {
    return accepts(value);
  };

  const parseOrThrow = (value: unknown, factoryFunctions: FactoryFunctions): T => {
    const result = parse(value, factoryFunctions);

    if (result !== null) {
      return result;
    }

    throw new SparkqlError({ message: options.parseMessage });
  };

  return {
    is,
    accepts,
    assert,
    parse,
    canParse,
    parseOrThrow,
  };
}

/**
 * Combines types created by {@link defineType} into one that accepts any of them.
 *
 * The result has the same members as a defined type. `is` and `accepts` pass if they pass
 * for any member. `parse` returns the result of the first member, in order, that can parse
 * the value, so with overlapping inputs the earlier member wins.
 *
 * @param options - The member types and the messages of the errors `assert` and
 * `parseOrThrow` throw.
 *
 * @example
 * Accept the terms that can name a graph: IRIs and variables.
 *
 * ```ts
 * const graphNames = defineUnionType({
 *   members: [termIri, termVariable] as const,
 *   assertMessage: 'Expected an IRI or a variable.',
 *   parseMessage: 'Expected an IRI, a URL or a variable.',
 * });
 * graphNames.accepts(v.graph); // true
 * graphNames.accepts('Ada'); // false: strings are literals
 * ```
 */
export function defineUnionType<Ds extends readonly DefinedType<any, any>[]>(options: {
  members: Ds;
  assertMessage: string;
  parseMessage: string;
}): DefinedType<OutputOf<Ds[number]>, InputOf<Ds[number]>> {
  type Output = OutputOf<Ds[number]>;
  type Input = InputOf<Ds[number]>;

  const { members, assertMessage, parseMessage } = options;

  const is = (value: unknown): value is Output => {
    return members.some(member => member.is(value));
  };

  const accepts = (value: unknown): value is Input => {
    return members.some(member => member.accepts(value));
  };

  const assert = (value: unknown): asserts value is Output => {
    if (!is(value)) {
      throw new SparkqlError({ message: assertMessage });
    }
  };

  const parse: Parser<Output> = (value: unknown, factoryFunctions: FactoryFunctions) => {
    for (const member of members) {
      const result = member.parse(value, factoryFunctions);
      if (result !== null) {
        return result as Output;
      }
    }

    return null;
  };

  const canParse = (value: unknown): boolean => {
    return accepts(value);
  };

  const parseOrThrow = (value: unknown, factoryFunctions: FactoryFunctions): Output => {
    const result = parse(value, factoryFunctions);

    if (result !== null) {
      return result;
    }

    throw new SparkqlError({ message: parseMessage });
  };

  return {
    is,
    accepts,
    assert,
    parse,
    canParse,
    parseOrThrow,
  };
}

/**
 * Combines parsers into one that returns the first non-null result, or `null`.
 *
 * Parsers are tried in order. A parser that throws stops the search, so pass `parse` rather
 * than `parseOrThrow` functions.
 *
 * @param parsers - Parsers that return `null` for values they cannot parse.
 *
 * @example
 * Parse a value as an IRI term or, failing that, as a literal.
 *
 * ```ts
 * const parseValue = oneOf(termIri.parse, termLiteral.parse);
 * parseValue(n.foaf.name, {} as FactoryFunctions); // the foaf:name term, returned unchanged
 * ```
 */
export function oneOf<Ps extends readonly Parser<any>[]>(
  ...parsers: Ps
): Parser<Parsed<Ps[number]>> {
  return (value: unknown, factoryFunctions: FactoryFunctions) => {
    for (const parser of parsers) {
      const result = parser(value, factoryFunctions);
      if (result !== null) {
        return result as Parsed<Ps[number]>;
      }
    }

    return null;
  };
}

/**
 * Combines type guards into one that passes when any of them passes.
 *
 * @param guards - The type guards to try.
 *
 * @example
 * Check for an IRI or literal term.
 *
 * ```ts
 * const isValueTerm = anyOf(isTermIri, isTermLiteral);
 * isValueTerm(n.foaf.name); // true
 * isValueTerm(v.name); // false
 * ```
 */
export function anyOf<Gs extends readonly Guard<any>[]>(...guards: Gs): Guard<Guarded<Gs[number]>> {
  return (value: unknown): value is Guarded<Gs[number]> => {
    return guards.some(guard => guard(value));
  };
}

/**
 * Creates an assertion function that throws an `Error` when a type guard fails.
 *
 * @param guard - The type guard to check.
 * @param message - The message of the thrown error.
 *
 * @example
 * Narrow an unknown value to an IRI term, or throw.
 *
 * ```ts
 * const check: (value: unknown) => asserts value is TermIriInput = assertWith(
 *   isTermIri, 'Expected an IRI'
 * );
 * check(n.foaf.name);
 * ```
 */
export function assertWith<T>(
  guard: Guard<T>,
  message: string
): (value: unknown) => asserts value is T {
  return (value: unknown): asserts value is T => {
    if (!guard(value)) {
      throw new SparkqlError({ message: message });
    }
  };
}

/**
 * Wraps a parser so that it throws an `Error` instead of returning `null`.
 *
 * @param parser - A parser that returns `null` for values it cannot parse.
 * @param message - The message of the thrown error.
 *
 * @example
 * Parse a value as an IRI term, or throw.
 *
 * ```ts
 * const parseIri = expect(termIri.parse, 'Expected an IRI');
 * parseIri(n.foaf.name, {} as FactoryFunctions); // the foaf:name term
 * parseIri('Ada', {} as FactoryFunctions); // throws Error: Expected an IRI
 * ```
 */
export function expect<T>(
  parser: Parser<T>,
  message: string
): (value: unknown, factoryFunctions: FactoryFunctions) => T {
  return (value: unknown, factoryFunctions: FactoryFunctions): T => {
    const result = parser(value, factoryFunctions);
    if (result !== null) {
      return result;
    }

    throw new SparkqlError({ message: message });
  };
}
