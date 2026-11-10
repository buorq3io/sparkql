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
   * Decodes selected values with a transform.
   *
   * Returns a new expression; the original keeps its transform.
   *
   * @param transform - Decoder applied to selected values.
   *
   * @example
   * Attach a decoder to an expression.
   *
   * ```ts
   * const length = sparql<number>`STRLEN(${v.name})`.mapWith(transformNumber);
   * ```
   */
  mapWith<U>(transform: TermVariableTransform<U>): SparqlRawExpression<U>;
};

/** @internal Whether a value is a raw expression made by the `sparql` tag. */
export function isRawExpression(value: unknown): value is RawExpressionInput | RawExpression {
  return isRaw(value, 'expression');
}

/** @internal Whether a value is a raw pattern made by `sparql.pattern`. */
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
 * Creates a raw SPARQL expression.
 *
 * Template text is verbatim; interpolated values are normalized as terms or nodes. The type
 * argument declares the result type but does not decode it; use `mapWith()` to decode.
 * Arrays, null and undefined are rejected.
 *
 * @param strings - Template text.
 * @param values - Interpolated values.
 * @throws {@link SparkqlError} When the template or its interpolated values are invalid.
 *
 * @example
 * Filter by the length of a name.
 *
 * ```ts
 * db.select().where(filter(sparql`STRLEN(${v.name}) > ${3}`));
 * ```
 *
 * ```sparql
 * SELECT * WHERE {
 *   FILTER ( ( STRLEN(?name) > "3"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
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

/**
 * Creates a raw graph pattern.
 *
 * Template text is emitted into the enclosing group; interpolated values are normalized.
 *
 * @param strings - Template text.
 * @param values - Interpolated values.
 * @throws {@link SparkqlError} When the template or its interpolated values are invalid.
 *
 * @example
 * Match names with a raw graph pattern.
 *
 * ```ts
 * db.select().where(sparql.pattern`${v.person} ${n.foaf.name} ${v.name} .`);
 * ```
 *
 * ```sparql
 * SELECT * WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
function pattern<const V extends readonly RawValue[] = RawValue[]>(
  strings: TemplateStringsArray,
  ...values: V
): RawPatternInput & RawCarrier<V> {
  return createPattern(templateStrings(strings), checkValues(values)) as RawPatternInput &
    RawCarrier<V>;
}

/**
 * Creates a raw SPARQL expression from text.
 *
 * **Unsafe:** text is emitted verbatim without escaping. Never pass untrusted input;
 * interpolate values with the `sparql` tag instead.
 *
 * @param text - Verbatim SPARQL text.
 *
 * @example
 * Keep solutions with a bound name.
 *
 * ```ts
 * db.select().where(filter(sparql.raw('BOUND(?name)')));
 * ```
 *
 * ```sparql
 * SELECT * WHERE {
 *   FILTER ( ( BOUND(?name) ) )
 * }
 * ```
 */
function raw<T = DefaultQueryReturnType>(text: string): SparqlRawExpression<T> {
  if (typeof text !== 'string') {
    throw new SparkqlError({ message: 'sparql.raw() expects a string.' });
  }
  return createExpression<T>([text], []);
}

/**
 * Joins values into a raw expression.
 *
 * The optional separator is inserted between values. Arrays, null and undefined as items
 * are rejected.
 *
 * @param values - Values to join.
 * @param separator - Raw fragment inserted between values.
 * @throws {@link SparkqlError} When the template or its interpolated values are invalid.
 *
 * @example
 * Match either Ada or Alan by name.
 *
 * ```ts
 * db.select().where(filter(sparql`${v.name} IN (${sparql.join(['Ada', 'Alan'], sparql`, `)})`));
 * ```
 *
 * ```sparql
 * SELECT * WHERE {
 *   FILTER ( ( ?name IN ( "Ada", "Alan") ) )
 * }
 * ```
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

/**
 * Creates a named placeholder for a prepared query.
 *
 * The value type defaults to unknown; preparation checks for missing names at runtime.
 *
 * @param name - Name of the value to supply.
 *
 * @example
 * Supply a name to a prepared query.
 *
 * ```ts
 * db.select().where(triples(v.person, n.foaf.name,
 *   sparql.placeholder<'name', string>('name'))).prepare().toSPARQL({ name: 'Ada' });
 * ```
 *
 * ```sparql
 * SELECT * WHERE {
 *   ?person foaf:name "Ada" .
 * }
 * ```
 */
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
