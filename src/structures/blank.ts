import { FactoryFunctions, BlankTerm, ExcludePrefix } from '../generic.js';

export type BlankProxy = Record<string, BlankTerm | (() => BlankTerm)>;

export type BlankManager<K extends string> = {
  __: () => BlankTerm;
} & { [P in `${K}${number}`]: undefined } & {
    [key: string]: BlankTerm;
  };

export function createBlankManager<K extends string>(
  factoryFunctions: FactoryFunctions<K>
): BlankManager<K> {
  return createBlankProxy(factoryFunctions) as BlankManager<K>;
}

export function createBlankProxy<K extends string>(
  factoryFunctions: FactoryFunctions<K>
): BlankProxy {
  const cache: BlankProxy = { __: () => factoryFunctions.blank() };
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          if (!cache[prop]) {
            cache[prop] = factoryFunctions.blank(prop as ExcludePrefix<typeof prop, K>);
          }
          return cache[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );
}
