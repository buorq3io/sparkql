import { completeGeneratorContext, type Term, type TermIri } from '@traqula/rules-sparql-1-1';
import { isObjectLike, term } from '../helpers/utilities.js';
import { entityKind, is } from './entity.js';
import { SparkqlError } from './errors.js';
import { sparkqlGeneratorBuilder } from './generator.js';
import type { QueryModuleContext } from './query-module.js';

/** Type-only metadata carried by composed inputs and fluent builders. */
export declare const placeholderTypes: unique symbol;
/** @internal Carries the placeholder values an input or builder needs, at the type level only. */
export type PlaceholderCarrier<V extends object> = { readonly [placeholderTypes]?: V };
/** @internal The placeholder values one input needs, by placeholder name. */
export type PlaceholderValues<T> =
  T extends Placeholder<infer N, infer V>
    ? Record<N, V>
    : T extends PlaceholderCarrier<infer V>
      ? V
      : {};
/** @internal Intersects the placeholder values of several inputs. */
export type MergePlaceholders<T> = (
  T extends unknown
    ? (value: PlaceholderValues<T>) => void
    : never
) extends (value: infer V extends object) => void
  ? V
  : {};

/**
 * A named value supplied to a prepared query.
 *
 * The value is formatted when the prepared query is filled.
 *
 * @typeParam Name - The placeholder name.
 * @typeParam Value - The accepted value type.
 */
export class Placeholder<Name extends string = string, Value = unknown> {
  static readonly [entityKind]: string = 'Placeholder';

  static [Symbol.hasInstance](value: unknown): boolean {
    return is(value, this);
  }

  declare protected value: Value;
  /** The name used to look up the supplied value. */
  constructor(readonly name: Name) {}
}

type Arguments<V extends object> = keyof V extends never ? [values?: V] : [values: V];

/**
 * A client-side prepared query.
 *
 * Generated text is cached, but results are not. Each execution sends a new request.
 *
 * @typeParam Result - The result returned by execution.
 * @typeParam Values - The named placeholder values required by the query.
 */
export class PreparedQuery<Result, Values extends object = {}> {
  constructor(
    private readonly fill: (values: Record<string, unknown>) => string,
    private readonly run: (sparql: string) => Promise<Result>
  ) {}

  /**
   * Returns the SPARQL with placeholder values substituted.
   *
   * Missing names and invalid values throw during substitution. No request is sent.
   *
   * @param args - Placeholder values, required when the query has inferred names.
   * @throws {@link SparkqlError} When a placeholder value is missing or invalid.
   *
   * @example
   * Look people up by name, with the name and page size supplied later.
   *
   * ```ts
   * const byName = db
   *   .select({ person: v.person })
   *   .where(triples(v.person, n.foaf.name, sparql.placeholder<'name', string>('name')))
   *   .limit(sparql.placeholder<'limit', number>('limit'))
   *   .prepare();
   *
   * byName.toSPARQL({ name: 'Ada', limit: 10 });
   * ```
   *
   * ```sparql
   * SELECT ?person WHERE {
   *   ?person foaf:name "Ada" .
   * }
   * LIMIT 10
   * ```
   */
  toSPARQL(...args: Arguments<Values>): string {
    return this.fill((args[0] ?? {}) as Record<string, unknown>);
  }

  /**
   * Executes the prepared query with placeholder values.
   *
   * Each call sends a new request. Missing or invalid values reject before the request.
   *
   * @param args - Placeholder values, required when the query has inferred names.
   *
   * @example
   * Run the same prepared query with different values.
   *
   * ```ts
   * const byName = db
   *   .select({ person: v.person })
   *   .where(triples(v.person, n.foaf.name, sparql.placeholder<'name', string>('name')))
   *   .prepare();
   *
   * const ada = await byName.execute({ name: 'Ada' });
   * const alan = await byName.execute({ name: 'Alan' }); // a second request
   * ```
   *
   * ```sparql
   * SELECT ?person WHERE {
   *   ?person foaf:name "Ada" .
   * }
   * ```
   */
  async execute(...args: Arguments<Values>): Promise<Result> {
    return this.run(this.fill((args[0] ?? {}) as Record<string, unknown>));
  }
}

const loc = { sourceLocationType: 'autoGenerate' } as const;
// The shared generator escapes IRIs and refuses invalid language tags and blank
// node labels, so prepared values print exactly as the builder would print them.
const termGenerator = sparkqlGeneratorBuilder.build();
const termContext = completeGeneratorContext({});

function safeIri(iri: TermIri, context: QueryModuleContext): TermIri {
  if (!('prefix' in iri)) return { ...iri, loc };
  const prefix = context.context.find(
    entry => entry.subType === 'prefix' && entry.key === iri.prefix
  );
  if (!prefix)
    throw new SparkqlError({ message: `Unknown placeholder IRI prefix "${iri.prefix}".` });
  const base = prefix.value instanceof URL ? String(prefix.value) : prefix.value.value;
  return context.factory.iri(base + iri.value);
}

function serialize(value: unknown, context: QueryModuleContext): string {
  let formatted: Term | undefined;
  for (const kind of ['iri', 'literal', 'blank'] as const) {
    for (const formatter of context.formats?.[kind] ?? []) {
      if (formatter.test(value)) {
        formatted = formatter.format(value, context.factory);
        break;
      }
    }
    if (formatted) break;
  }
  const parsed = formatted ?? term.parseOrThrow(value, context.factory);
  let safe: Term;
  switch (parsed.subType) {
    case 'namedNode':
      safe = safeIri(parsed, context);
      break;
    case 'literal': {
      const language = parsed.langOrIri;
      safe = {
        ...parsed,
        loc,
        langOrIri: typeof language === 'object' ? safeIri(language, context) : language,
      };
      break;
    }
    case 'blankNode':
      safe = { ...parsed, loc };
      break;
    default:
      throw new SparkqlError({ message: 'Placeholder values must be RDF terms, not variables.' });
  }
  return termGenerator.varOrTerm(safe, termContext).trim();
}

/** @internal Whether a plain input tree contains a {@link Placeholder} anywhere. */
export function containsPlaceholder(input: unknown): boolean {
  if (input instanceof Placeholder) return true;
  if (Array.isArray(input)) return input.some(containsPlaceholder);
  if (isObjectLike(input) && Object.getPrototypeOf(input) === Object.prototype) {
    return Object.values(input).some(containsPlaceholder);
  }
  return false;
}

/**
 * @internal Clones the input tree with opaque markers in place of placeholders, generates
 * SPARQL once, and returns a function that splices escaped values into the markers.
 */
export function prepareTemplate<Config>(
  input: Config,
  context: QueryModuleContext,
  generate: (config: Config) => string
): (values: Record<string, unknown>) => string {
  const slots: { marker: string; name: string; numeric: boolean }[] = [];
  const nonce = crypto.randomUUID();
  function replace(value: unknown, key?: string): unknown {
    if (value instanceof Placeholder) {
      const numeric = key === 'limit' || key === 'offset';
      const id = `urn:sparkql:placeholder:${nonce}:${slots.length}`;
      slots.push({ marker: numeric ? id : `<${id}>`, name: value.name, numeric });
      return numeric ? id : context.factory.iri(id);
    }
    if (Array.isArray(value)) return value.map(item => replace(item));
    if (isObjectLike(value) && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, replace(item, key)])
      );
    }
    return value;
  }
  const generated = generate(replace(input) as Config);
  // Split once, with exact occurrence checks. A collision (including one from a
  // custom formatter/dialect) fails preparation instead of corrupting user text.
  const pieces: (string | (typeof slots)[number])[] = [];
  const positions = slots
    .map(slot => {
      const index = generated.indexOf(slot.marker);
      if (index < 0 || generated.indexOf(slot.marker, index + slot.marker.length) >= 0) {
        throw new SparkqlError({
          message: 'Dialect did not preserve a unique placeholder marker.',
        });
      }
      return { slot, index };
    })
    .sort((a, b) => a.index - b.index);
  let end = 0;
  for (const { slot, index } of positions) {
    pieces.push(generated.slice(end, index), slot);
    end = index + slot.marker.length;
  }
  pieces.push(generated.slice(end));
  return values => {
    for (const slot of slots) {
      // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn requires ES2022; this package targets ES2020.
      if (!Object.prototype.hasOwnProperty.call(values, slot.name)) {
        throw new SparkqlError({
          message: `No value for placeholder "${slot.name}" was provided.`,
        });
      }
    }
    const terms = new Map<string, string>();
    return pieces
      .map(piece => {
        if (typeof piece === 'string') return piece;
        const value = values[piece.name];
        if (piece.numeric) {
          if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
            throw new SparkqlError({
              message: `Placeholder "${piece.name}" must be a non-negative safe integer.`,
            });
          }
          return String(value);
        }
        if (!terms.has(piece.name)) terms.set(piece.name, serialize(value, context));
        return terms.get(piece.name);
      })
      .join('');
  };
}
