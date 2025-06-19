import { variable } from './expression';
import { VariableTerm } from '../struct';

export type VariableProxy = Record<string, VariableTerm>;

export type VariableManagerConfig<K extends string> = Exclude<K, '_' | '__'>;

export type VariableManager<K extends string> = Record<
  VariableManagerConfig<K>,
  VariableTerm
> & {
  _: VariableProxy;
  __: () => VariableTerm;
};

export function createVariableProxy(): VariableProxy {
  const cache: VariableProxy = {};
  return new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
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

export function createVariableManager<K extends string>(
  ...keys: VariableManagerConfig<K>[]
): VariableManager<K> {
  const vars = {} as Record<K, VariableTerm>;
  for (const key of keys) {
    vars[key] = variable(key);
  }
  return { ...vars, _: createVariableProxy(), __: createVariableGenerator() };
}

export function createVariableGenerator(prefix = '__t', seed = 0) {
  let counter = seed;
  return () => {
    return variable(`${prefix}${(counter++).toString(36)}`);
  };
}
