import { SparkqlError } from '../database/errors.js';

/** Preamble hints only; scope hints require placement inside a graph pattern. */
export interface StardogPreambleHints {
  'plan.cache': 'on' | 'off';
  'paths.evaluation': 'lazy' | 'eager';
}

const values: { [K in keyof StardogPreambleHints]: readonly StardogPreambleHints[K][] } = {
  'plan.cache': ['on', 'off'],
  'paths.evaluation': ['lazy', 'eager'],
};

/** Pass the returned single line to `.comment()` (which supplies the `#`). */
export function pragma<K extends keyof StardogPreambleHints>(
  name: K,
  value: StardogPreambleHints[K]
): string {
  // Validate at runtime too, for JavaScript callers and values from outside TypeScript.
  if (!Object.keys(values).includes(name) || !(values[name] as readonly string[]).includes(value)) {
    throw new SparkqlError({ message: 'Unsupported Stardog preamble hint or value.' });
  }
  return `pragma ${name} ${value}`;
}

export const stardogHints = { pragma } as const;
