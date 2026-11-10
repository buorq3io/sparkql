import {
  type FactoryFunctions,
  type QueryInput,
  Strictness,
  type TermIriInput,
} from '../helpers/types.js';

/**
 * Prefix definitions for an IRI manager.
 *
 * Each `uri` defines the prefix IRI, while `fields` supplies known local names for
 * autocomplete. In strict mode only those fields are available; loose mode also
 * accepts other local names. Pass the configuration to {@link SparqlDatabase.createManagers}.
 */
export type IriManagerConfig = Record<
  Exclude<string, '__'>,
  { uri: string; fields: readonly string[] }
>;

/** A proxy that maps local names to IRI terms. */
export type IriProxy = Record<string, TermIriInput>;

/**
 * A manager of prefixed IRI terms, normally obtained from {@link SparqlDatabase.createManagers}.
 *
 * Access `n.prefix.local` for a prefixed IRI. The `__` proxy creates unprefixed IRIs.
 * Configured fields provide autocomplete; strict mode restricts access to those fields.
 *
 * @typeParam T - Prefix definitions and their known fields.
 * @typeParam K - Whether access is strict or loose.
 */
export type IriManager<T extends IriManagerConfig, K extends Strictness> = {
  [P in keyof T]: {
    [F in T[P]['fields'][number]]: TermIriInput;
  } & (K extends Strictness.loose ? { [key: string]: TermIriInput } : {});
} & { __: IriProxy };

/**
 * Creates a manager of prefixed IRI proxies.
 *
 * Each proxy caches terms by local name. Usually obtain this manager through
 * {@link SparqlDatabase.createManagers}.
 *
 * @param nodes - Prefix definitions and known local names.
 * @param mode - Whether to restrict access to configured fields.
 * @param factoryFunctions - Factories used to construct terms.
 *
 * @example
 * Find people and their names using manager terms.
 *
 * ```ts
 * const [variables, iris] = db.createManagers([], prefixes);
 * db.select({ name: variables.name }).where(triples(variables.person, iris.foaf.name, variables.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function createIriManager<T extends IriManagerConfig, K extends Strictness>(
  nodes: T,
  mode: K,
  factoryFunctions: FactoryFunctions
): IriManager<T, K> {
  const result: Record<string, IriProxy> = {};
  for (const [prefix, { fields }] of Object.entries(nodes)) {
    result[prefix] = {};
    result[prefix] = createIriProxy(
      prefix,
      factoryFunctions,
      mode === Strictness.strict ? fields : undefined
    );
  }
  result.__ = createIriProxy(undefined, factoryFunctions);
  return result as IriManager<T, K>;
}

/**
 * Creates a proxy that caches IRI terms by local name.
 *
 * When fields are supplied, other properties return `undefined`. Managers are normally
 * obtained from {@link SparqlDatabase.createManagers}.
 *
 * @param prefix - Prefix for generated IRIs, or `undefined` for full IRIs.
 * @param factoryFunctions - Factories used to construct terms.
 * @param fields - Optional allowed local names.
 *
 * @example
 * Access the FOAF name IRI through a manager proxy.
 *
 * ```ts
 * const [, iris] = db.createManagers([], prefixes);
 * iris.foaf.name;
 * ```
 */
export function createIriProxy(
  prefix: string | undefined,
  factoryFunctions: FactoryFunctions,
  fields?: readonly string[]
): IriProxy {
  const cache: IriProxy = {};
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          if (fields !== undefined && !fields.includes(prop)) {
            return Reflect.get(target, prop, receiver);
          }
          if (!cache[prop]) {
            cache[prop] = factoryFunctions.iri(prop, prefix);
          }
          return cache[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );
}

/**
 * Converts prefix definitions into query context entries.
 *
 * The `uri` of each entry supplies its prefix IRI; fields are ignored.
 *
 * @param nodes - Prefix definitions to convert.
 *
 * @example
 * Convert the configured prefixes.
 *
 * ```ts
 * transformIntoPrefixObject(prefixes);
 * ```
 */
export function transformIntoPrefixObject<T extends IriManagerConfig>(
  nodes: T
): QueryInput['context'] {
  const result = [] as QueryInput['context'];

  for (const [prefix, { uri }] of Object.entries(nodes)) {
    result.push({
      type: 'contextDef',
      subType: 'prefix',
      key: prefix,
      value: {
        type: 'term',
        value: uri,
        subType: 'namedNode',
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      },
      loc: {
        sourceLocationType: 'autoGenerate',
      },
    });
  }
  return result;
}
