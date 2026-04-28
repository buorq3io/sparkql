import { FactoryFunctions, QueryInput, Strictness, TermIriInput } from '../helpers/types.js';

export type IriManagerConfig = Record<
  Exclude<string, '__'>,
  { uri: string; fields: readonly string[] }
>;

export type IriProxy = Record<string, TermIriInput>;

export type IriManager<T extends IriManagerConfig, K extends Strictness> = {
  [P in keyof T]: {
    [F in T[P]['fields'][number]]: TermIriInput;
  } & (K extends Strictness.loose ? { [key: string]: TermIriInput } : {});
} & { __: IriProxy };

export function createIriManager<T extends IriManagerConfig, K extends Strictness>(
  nodes: T,
  mode: K,
  factoryFunctions: FactoryFunctions
): IriManager<T, K> {
  const result: Record<string, IriProxy> = {};
  for (const [prefix, { uri, fields }] of Object.entries(nodes)) {
    result[prefix] = {};
    result[prefix] = createIriProxy(
      uri,
      factoryFunctions,
      mode === Strictness.strict ? fields : undefined
    );
  }
  result.__ = createIriProxy('', factoryFunctions);
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
