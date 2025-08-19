import { FactoryFunctions, IriTerm, SparqlQuery } from '../generic.js';

export type IriManagerConfig = Record<string, { uri: string; fields: readonly string[] }>;

export type IriProxy = Record<string, IriTerm>;

export type IriManager<T extends IriManagerConfig, K extends 'strict' | 'allow'> = {
  [P in keyof T]: {
    [F in T[P]['fields'][number]]: IriTerm;
  } &
    (K extends 'allow' ? { [key: string]: IriTerm } : {});
};

export function createIriManager<T extends IriManagerConfig, K extends 'strict' | 'allow'>(
  nodes: T,
  mode: K,
  factoryFunctions: FactoryFunctions
): IriManager<T, K> {
  const result: Record<string, IriProxy> = {};
  for (const [prefix, { uri, fields }] of Object.entries(nodes)) {
    result[prefix] = {};
    result[prefix] = createIriProxy(uri, factoryFunctions, mode === 'strict' ? fields : undefined);
  }
  return result as IriManager<T, K>;
}

export function createIriProxy(
  uri: string,
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
            cache[prop] = factoryFunctions.iri(uri + prop);
          }
          return cache[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );
}

export function transformIntoPrefixObject<T extends IriManagerConfig>(
  nodes: T
): SparqlQuery['prefixes'] {
  const result = {} as SparqlQuery['prefixes'];
  for (const [prefix, { uri }] of Object.entries(nodes)) {
    result[prefix] = uri;
  }
  return result;
}
