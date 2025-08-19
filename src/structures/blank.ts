import { FactoryFunctions, BlankTerm } from '../generic.js';

export type BlankProxy = Record<string, BlankTerm | (() => BlankTerm)>;

export type BlankManager = {
  __: () => BlankTerm;
} & { [K in `e_${string}` | `g_${string}`]: undefined } & {
    [key: string]: BlankTerm;
  };

export function createBlankManager(factoryFunctions: FactoryFunctions): BlankManager {
  return createBlankProxy(factoryFunctions) as BlankManager;
}

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
