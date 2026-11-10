import { sparql11GeneratorBuilder } from '@traqula/generator-sparql-1-1';
import { completeGeneratorContext, lex, type Term, type TermIri } from '@traqula/rules-sparql-1-1';
import { isObjectLike, term } from '../helpers/utilities.js';
import { SparkqlError } from './errors.js';
import type { QueryModuleContext } from './query-module.js';

/** Type-only metadata carried by composed inputs and fluent builders. */
export declare const placeholderTypes: unique symbol;
export type PlaceholderCarrier<V extends object> = { readonly [placeholderTypes]?: V };
export type PlaceholderValues<T> =
  T extends Placeholder<infer N, infer V>
    ? Record<N, V>
    : T extends PlaceholderCarrier<infer V>
      ? V
      : {};
export type MergePlaceholders<T> = (
  T extends unknown
    ? (value: PlaceholderValues<T>) => void
    : never
) extends (value: infer V extends object) => void
  ? V
  : {};

/** A named value, formatted only after execute() supplies its actual value. */
export class Placeholder<Name extends string = string, Value = unknown> {
  declare protected value: Value;
  constructor(readonly name: Name) {}
}

export const sparql = {
  placeholder<Name extends string, Value = unknown>(name: Name): Placeholder<Name, Value> {
    return new Placeholder(name);
  },
};

type Arguments<V extends object> = keyof V extends never ? [values?: V] : [values: V];

/** Client-side preparation: generated text is cached; results are never cached. */
export class PreparedQuery<Result, Values extends object = {}> {
  constructor(
    private readonly fill: (values: Record<string, unknown>) => string,
    private readonly run: (sparql: string) => Promise<Result>
  ) {}

  toSPARQL(...args: Arguments<Values>): string {
    return this.fill((args[0] ?? {}) as Record<string, unknown>);
  }

  async execute(...args: Arguments<Values>): Promise<Result> {
    return this.run(this.fill((args[0] ?? {}) as Record<string, unknown>));
  }
}

const loc = { sourceLocationType: 'autoGenerate' } as const;
const termGenerator = sparql11GeneratorBuilder.build();
const termContext = completeGeneratorContext({});
const blankNodeToken = lex.terminals.blankNodeLabel.PATTERN;
if (!(blankNodeToken instanceof RegExp)) {
  throw new Error('Traqula must expose a regular expression for blank node labels.');
}
const blankNodeLabel = new RegExp(`^(?:${blankNodeToken.source})$`);

// Traqula prints IRI values verbatim. Escape every character forbidden in IRIREF,
// including backslashes, so a supplied value can never terminate the RDF term.
function escapeIri(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: IRIREF excludes ASCII controls.
  return value.replace(/[\u0000-\u0020<>"{}|^`\\]/gu, char => encodeURIComponent(char));
}

function safeIri(iri: TermIri, context: QueryModuleContext): TermIri {
  if (!('prefix' in iri)) return { ...iri, value: escapeIri(iri.value), loc };
  const prefix = context.context.find(
    entry => entry.subType === 'prefix' && entry.key === iri.prefix
  );
  if (!prefix)
    throw new SparkqlError({ message: `Unknown placeholder IRI prefix "${iri.prefix}".` });
  const base = prefix.value instanceof URL ? String(prefix.value) : prefix.value.value;
  return context.factory.iri(escapeIri(base + iri.value));
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
      if (typeof language === 'string' && !/^[a-z]+(?:-[a-z0-9]+)*$/i.test(language)) {
        throw new SparkqlError({ message: 'Invalid placeholder literal language tag.' });
      }
      safe = {
        ...parsed,
        loc,
        langOrIri: typeof language === 'object' ? safeIri(language, context) : language,
      };
      break;
    }
    case 'blankNode':
      if (!blankNodeLabel.test(`_:${parsed.label}`)) {
        throw new SparkqlError({ message: 'Invalid placeholder blank node identifier.' });
      }
      safe = { ...parsed, loc };
      break;
    default:
      throw new SparkqlError({ message: 'Placeholder values must be RDF terms, not variables.' });
  }
  return termGenerator.varOrTerm(safe, termContext).trim();
}

export function containsPlaceholder(input: unknown): boolean {
  if (input instanceof Placeholder) return true;
  if (Array.isArray(input)) return input.some(containsPlaceholder);
  if (isObjectLike(input) && Object.getPrototypeOf(input) === Object.prototype) {
    return Object.values(input).some(containsPlaceholder);
  }
  return false;
}

/** Clone the input tree, substituting opaque markers before normalization. */
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
