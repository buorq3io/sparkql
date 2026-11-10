/**
 * Class identity that survives duplicate copies of the package (CJS and ESM
 * builds, or two versions in one dependency tree). `Symbol.for` puts the key in
 * the global registry, so every copy reads the same property.
 */
export const entityKind = Symbol.for('sparkql:entityKind');

/** A class identity shared across copies of sparkql. */
export interface SparkqlEntity {
  /** The globally registered kind of the entity. */
  [entityKind]: string;
}

/** A constructor carrying a sparkql entity kind. */
export type SparkqlEntityClass<T> = (
  | (abstract new (
      ...args: any[]
    ) => T)
  | (new (
      ...args: any[]
    ) => T)
) &
  SparkqlEntity;

const kindsByConstructor = new WeakMap<object, Set<string>>();

function collectKinds(ctor: object): Set<string> {
  const kinds = new Set<string>();
  for (let cls: any = ctor; cls; cls = Object.getPrototypeOf(cls)) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn requires ES2022; this package targets ES2020.
    if (Object.prototype.hasOwnProperty.call(cls, entityKind)) kinds.add(cls[entityKind]);
  }
  kindsByConstructor.set(ctor, kinds);
  return kinds;
}

const nativeHasInstance = Function.prototype[Symbol.hasInstance];

/**
 * Whether `value` is an instance of `type` or of a class with the same entity
 * kind from another copy of sparkql. Classes that declare an entity kind also
 * route `instanceof` through this check.
 *
 * @param value - The value to check.
 * @param type - The entity class to check against.
 *
 * @example
 * Check an error across package copies.
 *
 * ```ts
 * const error: unknown = new SparkqlError({ message: 'Problem' });
 * const matches = is(error, SparkqlError);
 * ```
 */
export function is<T extends SparkqlEntityClass<any>>(
  value: unknown,
  type: T
): value is InstanceType<T> {
  // `instanceof` would call back into `is` through `Symbol.hasInstance`.
  if (nativeHasInstance.call(type, value)) return true;
  if (value === null || typeof value !== 'object') return false;
  const ctor = Object.getPrototypeOf(value)?.constructor;
  if (typeof ctor !== 'function') return false;
  return (kindsByConstructor.get(ctor) ?? collectKinds(ctor)).has(type[entityKind]);
}
