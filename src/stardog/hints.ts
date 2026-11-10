import { SparkqlError } from '../database/errors.js';

/**
 * Stardog query hints that {@link pragma} can place before a query, with their allowed values.
 *
 * Only preamble hints are listed: scope hints must be placed inside a graph pattern, which
 * sparkql does not support.
 */
export interface StardogPreambleHints {
  /** Whether Stardog may cache and reuse the plan of this query. */
  'plan.cache': 'on' | 'off';
  /** Whether paths are evaluated lazily or eagerly. */
  'paths.evaluation': 'lazy' | 'eager';
}

const values: { [K in keyof StardogPreambleHints]: readonly StardogPreambleHints[K][] } = {
  'plan.cache': ['on', 'off'],
  'paths.evaluation': ['lazy', 'eager'],
};

/**
 * Formats a Stardog query hint as a `pragma` line for the query preamble.
 *
 * Pass the result to `.comment()`, which adds the `#` and places the line before the query.
 * Only the preamble hints in {@link StardogPreambleHints} are supported.
 *
 * @param name - Hint name.
 * @param value - Value for the hint.
 * @throws {@link SparkqlError} When the hint or value is unsupported, which only untyped
 * (JavaScript or `any`) callers can reach.
 *
 * @example
 * Run a query about people without caching its plan.
 *
 * ```ts
 * import { pragma, SparqlDatabase, triples } from 'sparkql/stardog';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const names = db
 *   .select({ name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name))
 *   .comment(pragma('plan.cache', 'off'));
 * ```
 *
 * ```sparql
 * #pragma plan.cache off
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
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

/** Stardog query hint helpers, also available as `stardogDialect.hints`. */
export const stardogHints = { pragma } as const;
