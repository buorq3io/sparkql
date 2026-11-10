import type * as AST from '@traqula/rules-sparql-1-1';
import type {
  DefaultQueryReturnType,
  ExpressionInput,
  PatternInput,
  TermVariableTransform,
} from '../helpers/types.js';
import type { ExtensionPattern } from './dialect.js';
import { SparkqlError } from './errors.js';
import { type MergePlaceholders, Placeholder, type PlaceholderCarrier } from './prepared.js';

const loc = { sourceLocationType: 'autoGenerate' } as const;

/**
 * A value interpolated into a `sparql` template. Values are never spliced as
 * text: terms, strings and numbers become RDF terms, builder expressions and
 * patterns are normalized as usual, and nested templates compose.
 */
export type RawValue =
  | ExpressionInput
  | AST.TermBlank
  | PatternInput<ExtensionPattern>
  | RawExpressionInput
  | RawPatternInput;

// Object type literals rather than interfaces: builder guards narrow inputs
// through index-signature types, which interfaces are not assignable to.

/** Input node for a raw expression, usable wherever an expression is. */
export type RawExpressionInput<T = DefaultQueryReturnType> = {
  readonly type: 'expression';
  readonly subType: 'raw';
  readonly loc: AST.Expression['loc'];
  /** Verbatim SPARQL text; always one entry longer than `values`. */
  readonly strings: readonly string[];
  readonly values: readonly RawValue[];
  transform?: TermVariableTransform<T>;
};

/** Input node for a raw graph pattern, usable wherever a pattern is. */
export type RawPatternInput = {
  readonly type: 'pattern';
  readonly subType: 'raw';
  readonly loc: AST.Pattern['loc'];
  readonly strings: readonly string[];
  readonly values: readonly RawValue[];
};

/** Normalized values: canonical AST nodes. */
export type RawASTValue = AST.Term | AST.Expression | AST.Pattern | RawExpression | RawPattern;

/** Normalized raw expression, printed in parentheses at expression positions. */
export type RawExpression = {
  type: 'expression';
  subType: 'raw';
  loc: AST.Expression['loc'];
  strings: readonly string[];
  values: readonly RawASTValue[];
};

/** Normalized raw pattern, printed verbatim as group content. */
export type RawPattern = {
  type: 'pattern';
  subType: 'raw';
  loc: AST.Pattern['loc'];
  strings: readonly string[];
  values: readonly RawASTValue[];
};

/** Placeholder names required by interpolated values, when they could be inferred. */
type RawCarrier<V extends readonly unknown[]> = RawValue[] extends V
  ? {}
  : PlaceholderCarrier<MergePlaceholders<V[number]>>;

/** A raw expression returned by the `sparql` tag. */
export type SparqlRawExpression<T = DefaultQueryReturnType> = RawExpressionInput<T> & {
  /**
   * Decode selected values with `transform`, like the `castX()` helpers.
   * Returns a new expression; the original keeps its transform.
   */
  mapWith<U>(transform: TermVariableTransform<U>): SparqlRawExpression<U>;
};

export function isRawExpression(value: unknown): value is RawExpressionInput | RawExpression {
  return isRaw(value, 'expression');
}

export function isRawPattern(value: unknown): value is RawPatternInput | RawPattern {
  return isRaw(value, 'pattern');
}

function isRaw(value: unknown, type: 'expression' | 'pattern'): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === type &&
    (value as { subType?: unknown }).subType === 'raw'
  );
}

function templateStrings(strings: TemplateStringsArray): string[] {
  if (!Array.isArray(strings) || !Array.isArray((strings as { raw?: unknown }).raw)) {
    throw new SparkqlError({
      message: 'sparql must be used as a template tag; use sparql.raw() for plain strings.',
    });
  }
  return strings.map(text => {
    if (typeof text !== 'string') {
      throw new SparkqlError({ message: 'sparql templates must not contain invalid escapes.' });
    }
    return text;
  });
}

function checkValues(values: readonly unknown[]): RawValue[] {
  return values.map(value => {
    if (Array.isArray(value)) {
      // Drizzle renders embedded arrays as value lists; sparkql refuses to guess.
      throw new SparkqlError({
        message: 'Arrays cannot be interpolated into sparql templates; use sparql.join().',
      });
    }
    if (value === undefined || value === null) {
      throw new SparkqlError({ message: 'sparql template values must not be null or undefined.' });
    }
    return value as RawValue;
  });
}

function createExpression<T>(
  strings: readonly string[],
  values: readonly RawValue[],
  transform?: TermVariableTransform<T>
): SparqlRawExpression<T> {
  const node: RawExpressionInput<T> = {
    type: 'expression',
    subType: 'raw',
    loc,
    strings,
    values,
    ...(transform ? { transform } : {}),
  };
  // Non-enumerable, so nodes stay plain data for spreads, clones and placeholders.
  Object.defineProperty(node, 'mapWith', {
    value: <U>(next: TermVariableTransform<U>) => createExpression(strings, values, next),
  });
  return node as SparqlRawExpression<T>;
}

function createPattern(strings: readonly string[], values: readonly RawValue[]): RawPatternInput {
  return { type: 'pattern', subType: 'raw', loc, strings, values };
}

/**
 * Raw SPARQL expression. Text written in the template is emitted verbatim;
 * every interpolated value is normalized into a safe RDF term or AST node.
 *
 * The type argument declares the selected result type without converting it;
 * use `.mapWith(transform)` to decode values at runtime.
 *
 * @example
 * sparql<number>`<http://example.org/fn#score>(${doc}, ${'query text'})`
 */
function sparqlTag<T = DefaultQueryReturnType, const V extends readonly RawValue[] = RawValue[]>(
  strings: TemplateStringsArray,
  ...values: V
): SparqlRawExpression<T> & RawCarrier<V> {
  return createExpression<T>(
    templateStrings(strings),
    checkValues(values)
  ) as SparqlRawExpression<T> & RawCarrier<V>;
}

/** Raw SPARQL graph pattern, spliced into the enclosing group. */
function pattern<const V extends readonly RawValue[] = RawValue[]>(
  strings: TemplateStringsArray,
  ...values: V
): RawPatternInput & RawCarrier<V> {
  return createPattern(templateStrings(strings), checkValues(values)) as RawPatternInput &
    RawCarrier<V>;
}

/**
 * **Unsafe**: emits `text` verbatim, without escaping. Never pass untrusted
 * input; interpolate values with the `sparql` tag instead.
 */
function raw<T = DefaultQueryReturnType>(text: string): SparqlRawExpression<T> {
  if (typeof text !== 'string') {
    throw new SparkqlError({ message: 'sparql.raw() expects a string.' });
  }
  return createExpression<T>([text], []);
}

/**
 * Joins values into one raw fragment, optionally separated by a raw fragment.
 *
 * @example
 * sparql`?s IN (${sparql.join([a, b], sparql`, `)})`
 */
function join<T = DefaultQueryReturnType>(
  values: readonly RawValue[],
  separator?: RawExpressionInput | RawPatternInput
): SparqlRawExpression<T> {
  const items: RawValue[] = [];
  checkValues(values).forEach((value, index) => {
    if (index > 0 && separator) items.push(separator);
    items.push(value);
  });
  return createExpression<T>(
    Array.from({ length: items.length + 1 }, () => ''),
    items
  );
}

/** Creates a named value supplied when a prepared query executes. */
function placeholder<Name extends string, Value = unknown>(name: Name): Placeholder<Name, Value> {
  return new Placeholder(name);
}

/**
 * The `sparql` template tag and its helpers: raw expressions and patterns,
 * `raw` text, `join` lists and prepared-query placeholders.
 */
export const sparql: typeof sparqlTag & {
  pattern: typeof pattern;
  raw: typeof raw;
  join: typeof join;
  placeholder: typeof placeholder;
} = Object.assign(sparqlTag, { pattern, raw, join, placeholder });
