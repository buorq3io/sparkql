import { FactoryFunctions, Strictness, TermVariableInput } from "../helpers/types.js";

export type VariableManagerConfig<T extends string> = Exclude<T, '__'>;

export type VariableProxy = Record<string, TermVariableInput | (() => TermVariableInput)>;

export type VariableManager<T extends string, K extends Strictness> = {
  [P in T]: TermVariableInput;
} & {
  __: () => TermVariableInput;
} & (K extends Strictness.loose ? { [key: Exclude<string, '__'>]: TermVariableInput } : {});

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
