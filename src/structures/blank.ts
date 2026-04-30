import { FactoryFunctions, TermBlankInput } from "../helpers/types.js";

export type BlankProxy = Record<string, TermBlankInput | (() => TermBlankInput)>;

export type BlankManager<K extends string> = {
  __: () => TermBlankInput;
} & { [P in `${K}${number}`]: undefined } & {
    [key: string]: TermBlankInput;
  };

export function createBlankManager<K extends string>(
  factoryFunctions: FactoryFunctions
): BlankManager<K> {
  return createBlankProxy(factoryFunctions) as BlankManager<K>;
}

export function createBlankProxy(
  factoryFunctions: FactoryFunctions
): BlankProxy {
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
