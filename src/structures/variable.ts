import { type FactoryFunctions, Strictness, type TermVariableInput } from '../helpers/types.js';

/** A variable name accepted by a manager, excluding the reserved `__` name. */
export type VariableManagerConfig<T extends string> = Exclude<T, '__'>;

/** A proxy that maps names to variable terms and exposes a generator at `__`. */
export type VariableProxy = Record<string, TermVariableInput | (() => TermVariableInput)>;

/**
 * A variable manager, normally obtained from {@link SparqlDatabase.createManagers}.
 *
 * Access `v.name` for `?name` or call `v.__()` for a fresh generated name.
 * Strict mode limits named access to configured keys; loose mode allows any name.
 *
 * @typeParam T - Configured variable names.
 * @typeParam K - Whether access is strict or loose.
 */
export type VariableManager<T extends string, K extends Strictness> = {
  [P in T]: TermVariableInput;
} & {
  __: () => TermVariableInput;
} & (K extends Strictness.loose ? { [key: Exclude<string, '__'>]: TermVariableInput } : {});

/**
 * Creates a manager of variable terms.
 *
 * Named terms are cached; `__()` generates names with an independent counter.
 * Usually obtain this manager through {@link SparqlDatabase.createManagers}.
 *
 * @param keys - Known variable names.
 * @param mode - Whether to restrict access to known names.
 * @param factoryFunctions - Factories used to construct terms.
 *
 * @example
 * Access named and generated variables.
 *
 * ```ts
 * const [variables] = db.createManagers(['person'], prefixes);
 * variables.person;
 * variables.__();
 * ```
 */
export function createVariableManager<T extends string, K extends Strictness>(
  keys: readonly VariableManagerConfig<T>[],
  mode: K,
  factoryFunctions: FactoryFunctions
): VariableManager<T, K> {
  return createVariableProxy(
    factoryFunctions,
    mode === Strictness.strict ? keys : undefined
  ) as VariableManager<T, K>;
}

/**
 * Creates a proxy that caches variables by name.
 *
 * When keys are supplied, other properties except `__` return `undefined`.
 * Obtain a manager through {@link SparqlDatabase.createManagers} for normal use.
 *
 * @param factoryFunctions - Factories used to construct terms.
 * @param keys - Optional allowed variable names.
 *
 * @example
 * Access a variable through a manager proxy.
 *
 * ```ts
 * const [variables] = db.createManagers([], prefixes);
 * variables.person;
 * ```
 */
export function createVariableProxy(
  factoryFunctions: FactoryFunctions,
  keys?: readonly string[]
): VariableProxy {
  const cache: VariableProxy = { __: createVariableGenerator(factoryFunctions.variable) };
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          if (keys !== undefined && ![...keys, '__'].includes(prop)) {
            return Reflect.get(target, prop, receiver);
          }
          if (!cache[prop]) {
            cache[prop] = factoryFunctions.variable(prop);
          }
          return cache[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );
}

/**
 * Creates a function that generates variable terms with successive names.
 *
 * Names combine the prefix with a base-36 counter, starting at the seed and
 * incrementing after each call. Managers from {@link SparqlDatabase.createManagers}
 * expose a generator as `v.__()`.
 *
 * @param generator - Factory called with each generated name.
 * @param prefix - Prefix for generated names, defaulting to `__v`.
 * @param seed - Initial counter value, defaulting to `0`.
 *
 * @example
 * Generate two variables.
 *
 * ```ts
 * const next = createVariableGenerator(name => db.variable(name));
 * next(); // ?__v0
 * next(); // ?__v1
 * ```
 */
export function createVariableGenerator(
  generator: (value: string) => TermVariableInput,
  prefix = '__v',
  seed = 0
) {
  let counter = seed;
  return () => {
    return generator(`${prefix}${(counter++).toString(36)}`);
  };
}
