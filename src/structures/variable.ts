import { variable } from './expression';
import { VariableTerm } from '../generic';

export type VariableManagerConfig<T extends string> = Exclude<T, '__'>;

export type VariableProxy = Record<string, VariableTerm | (() => VariableTerm)>;

export type VariableManager<T extends string, K extends 'strict' | 'allow'> = {
  [P in T]: VariableTerm;
} & {
  __: () => VariableTerm;
} & (K extends 'allow' ? { [key: Exclude<string, '__'>]: VariableTerm } : {});

export function createVariableManager<
  T extends string,
  K extends 'strict' | 'allow'
>(keys: readonly VariableManagerConfig<T>[], mode: K): VariableManager<T, K> {
  return createVariableProxy(
    mode === 'strict' ? keys : undefined
  ) as VariableManager<T, K>;
}

export function createVariableProxy(keys?: readonly string[]): VariableProxy {
  const cache: VariableProxy = { __: createVariableGenerator() };
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          if (keys !== undefined && ![...keys, '__'].includes(prop)) {
            return Reflect.get(target, prop, receiver);
          }
          if (!cache[prop]) {
            cache[prop] = variable(prop);
          }
          return cache[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );
}

export function createVariableGenerator(prefix = '__v', seed = 0) {
  let counter = seed;
  return () => {
    return variable(`${prefix}${(counter++).toString(36)}`);
  };
}
