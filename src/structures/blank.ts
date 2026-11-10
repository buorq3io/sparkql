import type { FactoryFunctions, TermBlankInput } from '../helpers/types.js';

/** A proxy that maps labels to blank nodes and exposes a generator at `__`. */
export type BlankProxy = Record<string, TermBlankInput | (() => TermBlankInput)>;

/**
 * A blank node manager, normally obtained from {@link SparqlDatabase.createManagers}.
 *
 * Named properties return cached blank nodes; `__()` creates a fresh blank node.
 *
 * @typeParam K - Prefix reserved for generated blank node labels.
 */
export type BlankManager<K extends string> = {
  __: () => TermBlankInput;
} & { [P in `${K}${number}`]: undefined } & {
  [key: string]: TermBlankInput;
};

/**
 * Creates a manager of blank nodes.
 *
 * Named nodes are cached, while `__()` calls the blank node factory each time.
 * Usually obtain this manager through {@link SparqlDatabase.createManagers}.
 *
 * @param factoryFunctions - Factories used to construct terms.
 *
 * @example
 * Access named and generated blank nodes.
 *
 * ```ts
 * const [, , blanks] = db.createManagers([], prefixes);
 * blanks.person;
 * blanks.__();
 * ```
 */
export function createBlankManager<K extends string>(
  factoryFunctions: FactoryFunctions
): BlankManager<K> {
  return createBlankProxy(factoryFunctions) as BlankManager<K>;
}

/**
 * Creates a proxy that caches blank nodes by label.
 *
 * Its `__()` function calls the blank node factory without a label on each call.
 * Obtain a manager through {@link SparqlDatabase.createManagers} for normal use.
 *
 * @param factoryFunctions - Factories used to construct terms.
 *
 * @example
 * Access a blank node through a manager proxy.
 *
 * ```ts
 * const [, , blanks] = db.createManagers([], prefixes);
 * blanks.person;
 * ```
 */
export function createBlankProxy(factoryFunctions: FactoryFunctions): BlankProxy {
  const cache: BlankProxy = { __: () => factoryFunctions.blank() };
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          if (!cache[prop]) {
            cache[prop] = factoryFunctions.blank(prop);
          }
          return cache[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );
}
