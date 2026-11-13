import type * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';
import type { PatternGroupInput } from '../helpers/types.js';
import type {
  TransitiveInput,
  TransitiveOptions,
  VirtuosoGroup,
  VirtuosoInput,
  VirtuosoPattern,
} from './types.js';

const loc = { sourceLocationType: 'autoGenerate' } as const;

function fail(message: string): never {
  throw new SparkqlError({ message: `Invalid Virtuoso transitive option: ${message}` });
}

const isVariable = (value: unknown): value is AST.TermVariable =>
  typeof value === 'object' &&
  value !== null &&
  (value as AST.TermVariable).type === 'term' &&
  (value as AST.TermVariable).subType === 'variable';

function checkOptions(options: TransitiveOptions): void {
  const { in: inputs, out: outputs } = options;
  if (!Array.isArray(inputs) || inputs.length === 0 || !inputs.every(isVariable)) {
    fail('`in` must list at least one variable.');
  }
  if (!Array.isArray(outputs) || outputs.length !== inputs.length || !outputs.every(isVariable)) {
    fail('`out` must list as many variables as `in`.');
  }
  if (options.noCycles && options.cyclesOnly)
    fail('`noCycles` and `cyclesOnly` exclude each other.');
  for (const key of ['min', 'max'] as const) {
    const value = options[key];
    if (value !== undefined && !(Number.isSafeInteger(value) && value >= 0)) {
      fail(`\`${key}\` must be a non-negative integer.`);
    }
  }
  if (options.min !== undefined && options.max !== undefined && options.min > options.max) {
    fail('`min` must not exceed `max`.');
  }
  if (options.direction !== undefined && !(options.direction in directions)) {
    fail('`direction` must be forward, backward or both.');
  }
  for (const key of ['stepNumber', 'pathId'] as const) {
    if (options[key] !== undefined && !isVariable(options[key]))
      fail(`\`${key}\` must be a variable.`);
  }
  const names = new Set(inputs.map(variable => variable.value));
  for (const pair of options.stepValues ?? []) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(isVariable)) {
      fail('each `stepValues` entry must be an [input, target] pair of variables.');
    }
    if (!names.has(pair[0].value)) fail(`?${pair[0].value} in \`stepValues\` is not an input.`);
  }
}

/** @internal `t_direction` numbers by direction name. */
export const directions = { forward: 1, backward: 2, both: 3 } as const;

/**
 * Turns a subquery into a Virtuoso transitive subquery, which Virtuoso repeats by feeding each
 * step's outputs back in as the next step's inputs.
 *
 * Prints the subquery in braces followed by `OPTION (TRANSITIVE, t_in (...), t_out (...), ...)`.
 * The subquery must project every `in` and `out` variable. Bind the start or the end, for
 * example with `FILTER` or `VALUES` next to the pattern, so Virtuoso does not walk the whole
 * graph. Only databases created from `sparkql/virtuoso` accept it. See
 * [Transitivity](https://docs.openlinksw.com/virtuoso/rdfsparqlimplementatiotrans/).
 *
 * @param subquery - A SELECT subquery, as `.as()` returns it, describing one step.
 * @param options - Input and output variables, bounds, and the variables for step details.
 * @throws {@link SparkqlError} When an option is invalid: `in` empty or `out` of another length,
 * `noCycles` with `cyclesOnly`, a negative or fractional bound, `min` above `max`, or a
 * `stepValues` input that is not in `in`. Generating the query also fails when the subquery does
 * not project an `in` or `out` variable.
 *
 * @example
 * Find everyone Ada knows directly or through up to three others, with the distance.
 *
 * ```ts
 * import { eq, filter, SparqlDatabase, transitive, triples } from 'sparkql/virtuoso';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const step = db
 *   .select({ person: v.person, friend: v.friend })
 *   .where(triples(v.person, n.foaf.knows, v.friend))
 *   .as();
 * const network = db.select({ friend: v.friend, distance: v.distance }).where(
 *   transitive(step, {
 *     in: [v.person],
 *     out: [v.friend],
 *     distinct: true,
 *     min: 1,
 *     max: 4,
 *     stepNumber: v.distance,
 *   }),
 *   filter(eq(v.person, db.iri('https://example.org/people/ada')))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?friend ?distance WHERE {
 *   {
 *     SELECT ?person ?friend WHERE {
 *       ?person foaf:knows ?friend .
 *     }
 *   } OPTION (TRANSITIVE, t_in (?person), t_out (?friend), t_distinct, t_min (1), t_max (4), t_step ('step_no') AS ?distance)
 *   FILTER ( ( ?person = <https://example.org/people/ada> ) )
 * }
 * ```
 */
export function transitive(
  subquery: PatternGroupInput<VirtuosoInput>,
  options: TransitiveOptions
): TransitiveInput {
  checkOptions(options);
  return { type: 'pattern', subType: 'virtuosoTransitive', loc, subquery, options };
}

/** @internal Checks that a normalized group holds one SELECT projecting the transitive variables. */
export function checkTransitiveSubquery(group: VirtuosoGroup, options: TransitiveOptions): void {
  const [query, ...rest] = group.patterns as (VirtuosoPattern | AST.QuerySelect)[];
  if (rest.length > 0 || query?.type !== 'query' || query.subType !== 'select') {
    throw new SparkqlError({
      message: 'A Virtuoso transitive pattern needs a single SELECT subquery, as `.as()` returns.',
    });
  }
  const projected = query.variables;
  if (projected.length === 1 && projected[0].type === 'wildcard') return;
  const names = new Set(
    projected.map(item =>
      item.type === 'term' ? item.value : (item as AST.PatternBind).variable.value
    )
  );
  for (const variable of [...options.in, ...options.out]) {
    if (!names.has(variable.value)) {
      throw new SparkqlError({
        message: `The transitive subquery does not project ?${variable.value}.`,
      });
    }
  }
}

/** A piece of the transitive option clause: literal text or a variable to print. */
export type TransitiveToken = string | AST.TermVariable;

/**
 * @internal Lists the `OPTION (...)` clause of a transitive subquery as text and variables, so
 * the generator prints variables through its own rules.
 */
export function transitiveOptionTokens(options: TransitiveOptions): TransitiveToken[][] {
  const list = (values: readonly AST.TermVariable[]) =>
    values.flatMap((value, index) => (index === 0 ? [value] : [', ', value]));
  const parts: TransitiveToken[][] = [
    ['TRANSITIVE'],
    ['t_in (', ...list(options.in), ')'],
    ['t_out (', ...list(options.out), ')'],
  ];
  if (options.distinct) parts.push(['t_distinct']);
  if (options.exists) parts.push(['t_exists']);
  if (options.noCycles) parts.push(['t_no_cycles']);
  if (options.cyclesOnly) parts.push(['t_cycles_only']);
  if (options.shortestOnly) parts.push(['t_shortest_only']);
  if (options.min !== undefined) parts.push([`t_min (${options.min})`]);
  if (options.max !== undefined) parts.push([`t_max (${options.max})`]);
  if (options.direction) parts.push([`t_direction ${directions[options.direction]}`]);
  if (options.stepNumber) parts.push(["t_step ('step_no') AS ", options.stepNumber]);
  if (options.pathId) parts.push(["t_step ('path_id') AS ", options.pathId]);
  for (const [input, target] of options.stepValues ?? []) {
    parts.push(['t_step (', input, ') AS ', target]);
  }
  return parts;
}
