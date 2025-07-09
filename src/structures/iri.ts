import { iri } from './expression';
import { IriTerm, SparqlQuery } from '../generic';

export type IriManagerConfig = Record<
  string,
  { uri: string; fields: readonly string[] }
>;

export type IriProxy = Record<string, IriTerm>;

export type IriManager<T extends IriManagerConfig> = {
  [P in keyof T]: {
    [F in T[P]['fields'][number]]: IriTerm;
  } & {
    [key: string]: IriTerm;
  };
};

export function createIriManager<T extends IriManagerConfig>(
  nodes: T
): IriManager<T> {
  const result: Record<string, Record<string, IriTerm>> = {};
  for (const [prefix, { uri }] of Object.entries(nodes)) {
    result[prefix] = {};
    result[prefix] = createIriProxy(uri);
  }
  return result as IriManager<T>;
}

export function createIriProxy(uri: string): IriProxy {
  const cache: IriProxy = {};
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

export function transformIntoPrefixObject<T extends IriManagerConfig>(
  nodes: T
): SparqlQuery['prefixes'] {
  const result = {} as SparqlQuery['prefixes'];
  for (const [prefix, { uri }] of Object.entries(nodes)) {
    result[prefix] = uri;
  }
  return result;
}
