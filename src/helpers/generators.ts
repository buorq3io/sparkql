type Guard<T> = (value: unknown) => value is T;
type Parser<T> = (value: unknown) => T | null;

type Guarded<G> = G extends Guard<infer T> ? T : never;
type Parsed<P> = P extends Parser<infer T> ? T : never;

type Formatter<T, R> = {
  test(value: unknown): value is T;
  format(value: T): R;
};

type FormatterInput<F> = F extends Formatter<infer I, any> ? I : never;
type FormatterInputs<Fs extends readonly Formatter<any, any>[]> = FormatterInput<Fs[number]>;

type DefinedType<Output, Input = Output> = {
  is: Guard<Output>;
  accepts: (value: unknown) => value is Input;
  assert: (value: unknown) => asserts value is Output;
  parse: Parser<Output>;
  canParse: (value: unknown) => boolean;
  parseOrThrow: (value: unknown) => Output;
};

type OutputOf<D> = D extends DefinedType<infer O, any> ? O : never;
type InputOf<D> = D extends DefinedType<any, infer I> ? I : never;

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
      throw new Error(options.assertMessage);
    }
  };

  const parse: Parser<T> = (value: unknown) => {
    if (is(value)) {
      return value;
    }

    for (const formatter of from) {
      if (formatter.test(value)) {
        return formatter.format(value);
      }
    }

    return null;
  };

  const canParse = (value: unknown): boolean => {
    return accepts(value);
  };

  const parseOrThrow = (value: unknown): T => {
    const result = parse(value);

    if (result !== null) {
      return result;
    }

    throw new Error(options.parseMessage);
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

export function defineUnionType<Ds extends readonly DefinedType<any, any>[]>(options: {
  members: Ds;
  assertMessage: string;
  parseMessage: string;
}): DefinedType<OutputOf<Ds[number]>, InputOf<Ds[number]>> {
  type Output = OutputOf<Ds[number]>;
  type Input = InputOf<Ds[number]>;

  const { members, assertMessage, parseMessage } = options;

  const is = (value: unknown): value is Output => {
    return members.some((member) => member.is(value));
  };

  const accepts = (value: unknown): value is Input => {
    return members.some((member) => member.accepts(value));
  };

  const assert = (value: unknown): asserts value is Output => {
    if (!is(value)) {
      throw new Error(assertMessage);
    }
  };

  const parse: Parser<Output> = (value: unknown) => {
    for (const member of members) {
      const result = member.parse(value);
      if (result !== null) {
        return result as Output;
      }
    }

    return null;
  };

  const canParse = (value: unknown): boolean => {
    return accepts(value);
  };

  const parseOrThrow = (value: unknown): Output => {
    const result = parse(value);

    if (result !== null) {
      return result;
    }

    throw new Error(parseMessage);
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

export function oneOf<Ps extends readonly Parser<any>[]>(
  ...parsers: Ps
): Parser<Parsed<Ps[number]>> {
  return (value: unknown) => {
    for (const parser of parsers) {
      const result = parser(value);
      if (result !== null) {
        return result as Parsed<Ps[number]>;
      }
    }

    return null;
  };
}

export function anyOf<Gs extends readonly Guard<any>[]>(
  ...guards: Gs
): Guard<Guarded<Gs[number]>> {
  return (value: unknown): value is Guarded<Gs[number]> => {
    return guards.some((guard) => guard(value));
  };
}

export function assertWith<T>(
  guard: Guard<T>,
  message: string,
): (value: unknown) => asserts value is T {
  return (value: unknown): asserts value is T => {
    if (!guard(value)) {
      throw new Error(message);
    }
  };
}

export function expect<T>(
  parser: Parser<T>,
  message: string,
): (value: unknown) => T {
  return (value: unknown): T => {
    const result = parser(value);
    if (result !== null) {
      return result;
    }

    throw new Error(message);
  };
}

type Values<M> = M[keyof M];

export function createFormatRegistry<M extends object, O>() {
  type Input = Values<M>;

  const formatters: Formatter<any, O>[] = [];

  const register = <K extends keyof M>(
    _key: K,
    formatter: Formatter<M[K], O>
  ): void => {
    formatters.push(formatter);
  };

  return {
    register,
    formatters: formatters as readonly Formatter<Input, O>[],
  };
}
