import type {
  PathAlternativeLimitedInput,
  PathInput,
  PathModifiedInput,
  PathNegatedEltInput,
  PathNegatedInput,
  PropertyPathChainInput,
  TermIriInput,
} from '../helpers/types.js';

function path(subtype: '/' | '|', items: PathInput[]): PropertyPathChainInput;
function path(subtype: '?' | '*' | '+' | '^', items: [PathInput]): PathModifiedInput;
function path(
  subtype: '!',
  items: [TermIriInput | PathNegatedEltInput | PathAlternativeLimitedInput]
): PathNegatedInput;
function path(subtype: '/' | '|' | '?' | '*' | '+' | '^' | '!', items: PathInput[]): PathInput {
  return {
    type: 'path',
    subType: subtype,
    items: items,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  } as PathInput;
}

/**
 * Creates a sequence property path (`/`).
 *
 * @param items - Paths to follow in order.
 *
 * @example
 * Find the names of people known by each person.
 *
 * ```ts
 * const path = seq(n.foaf.knows, n.foaf.name);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (foaf:knows/foaf:name) ?name .
 * }
 * ```
 */
export function seq(...items: PathInput[]) {
  return path('/', items);
}

/**
 * Creates an alternative property path (`|`).
 *
 * @param items - Paths to match as alternatives.
 *
 * @example
 * Match either name property for each person.
 *
 * ```ts
 * const path = alt(n.foaf.name, n.schema.name);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (foaf:name|schema:name) ?name .
 * }
 * ```
 */
export function alt(...items: (TermIriInput | PathNegatedEltInput)[]): PathAlternativeLimitedInput;
/**
 * Creates an alternative property path (`|`).
 *
 * See the first overload for details.
 *
 * @param items - Paths to match as alternatives.
 *
 * @example
 * Match either name property for each person.
 *
 * ```ts
 * const path = alt(n.foaf.name, n.schema.name);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (foaf:name|schema:name) ?name .
 * }
 * ```
 */
export function alt(...items: PathInput[]): PropertyPathChainInput;
export function alt(...items: PathInput[]) {
  return path('|', items);
}

/**
 * Creates an optional property path (`?`).
 *
 * @param items - Path to match zero or one time.
 *
 * @example
 * Find each person or someone they know directly.
 *
 * ```ts
 * const path = zeroOrOne(n.foaf.knows);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (foaf:knows?) ?name .
 * }
 * ```
 */
export function zeroOrOne(items: PathInput) {
  return path('?', [items]);
}

/**
 * Creates a repeated property path (`*`).
 *
 * @param items - Path to match zero or more times.
 *
 * @example
 * Find everyone reachable through zero or more knows links.
 *
 * ```ts
 * const path = zeroOrMore(n.foaf.knows);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (foaf:knows*) ?name .
 * }
 * ```
 */
export function zeroOrMore(items: PathInput) {
  return path('*', [items]);
}

/**
 * Creates a repeated property path (`+`).
 *
 * @param items - Path to match one or more times.
 *
 * @example
 * Find everyone reachable through one or more knows links.
 *
 * ```ts
 * const path = oneOrMore(n.foaf.knows);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (foaf:knows+) ?name .
 * }
 * ```
 */
export function oneOrMore(items: PathInput) {
  return path('+', [items]);
}

/**
 * Creates an inverse property path (`^`).
 *
 * @param items - Path to traverse in reverse.
 *
 * @example
 * Find who knows each person.
 *
 * ```ts
 * const path = inv(n.foaf.knows);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (^foaf:knows) ?name .
 * }
 * ```
 */
export function inv(items: TermIriInput): PathNegatedEltInput;
/**
 * Creates an inverse property path (`^`).
 *
 * See the first overload for details.
 *
 * @param items - Path to traverse in reverse.
 *
 * @example
 * Find who knows each person.
 *
 * ```ts
 * const path = inv(n.foaf.knows);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (^foaf:knows) ?name .
 * }
 * ```
 */
export function inv(items: PathInput): PathModifiedInput;
export function inv(items: PathInput) {
  return path('^', [items]);
}

/**
 * Creates a negated property set (`!`).
 *
 * @param items - IRI, inverse IRI or alternative set to exclude.
 *
 * @example
 * Find values connected by a property other than foaf:knows.
 *
 * ```ts
 * const path = neg(n.foaf.knows);
 * db.select({ name: v.name }).where(triples(v.person, path, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person (!(foaf:knows)) ?name .
 * }
 * ```
 */
export function neg(
  items: TermIriInput | PathNegatedEltInput | PathAlternativeLimitedInput
): PathNegatedInput {
  return path('!', [items]);
}
