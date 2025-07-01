import { iri } from './expression';
import { IriTerm, SparqlQuery } from '../generic';

export type IriManagerConfig = Record<
  string,
  { uri: string; fields: readonly string[] }
>;

export type IriManager<T extends IriManagerConfig> = {
  [P in keyof T]: {
    [F in T[P]['fields'][number]]: IriTerm;
  };
};

export function createIriManager<T extends IriManagerConfig>(
  nodes: T
): IriManager<T> {
  const result: Record<string, Record<string, ReturnType<typeof iri>>> = {};
  for (const [prefix, { uri, fields }] of Object.entries(nodes)) {
    result[prefix] = {};
    for (const field of fields) {
      result[prefix][field] = iri(uri + field);
    }
  }
  return result as IriManager<T>;
}

export type PrefixProxy = Record<string, IriTerm>;

export type PrefixManager<T extends IriManagerConfig> = {
  [P in keyof T]: PrefixProxy;
};

export function createPrefixProxy(uri: string): PrefixProxy {
  const cache: PrefixProxy = {};
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          if (!cache[prop]) {
            cache[prop] = iri(uri + prop);
          }
          return cache[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );
}

export function createPrefixManager<T extends IriManagerConfig>(
  nodes: T
): PrefixManager<T> {
  const result: Record<string, PrefixProxy> = {};
  for (const [prefix, { uri }] of Object.entries(nodes)) {
    result[prefix] = createPrefixProxy(uri);
  }
  return result as PrefixManager<T>;
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
