import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExpressionInput, FactoryFunctions, PatternInput } from '../helpers/types.js';
import { generateSparql } from './generator.js';
import type { QueryFactories } from './query-module.js';

/**
 * The base shape of a dialect's extension pattern, such as ARQ's `LET`: a `pattern` node whose
 * `subType` differs from every SPARQL 1.1 pattern subtype.
 */
export interface ExtensionPattern {
  /** Marks the node as a graph pattern. */
  type: 'pattern';
  /** A subtype distinct from built-in pattern subtypes, such as `'let'`. */
  subType: string;
  /** Source location metadata. */
  loc: AST.Pattern['loc'];
}

type NodeSubtypes<T> = T extends { subType: infer S } ? S : never;
type DeepDialectPatterns<T, P> = T extends readonly unknown[]
  ? { [K in keyof T]: WithDialectPatterns<T[K], P> }
  : T extends object
    ? { [K in keyof T]: DeepDialectPatterns<T[K], P> }
    : T;

/** @internal Preserves node shapes while widening pattern unions. */
export type WithDialectPatterns<T, P> = [P] extends [never]
  ? T
  : [AST.Pattern['subType']] extends [NodeSubtypes<T>]
    ? P | DeepDialectPatterns<T, P>
    : DeepDialectPatterns<T, P>;

/**
 * Helpers passed to a dialect's `patterns.normalize`, for normalizing the patterns and
 * expressions nested inside an extension pattern.
 *
 * @typeParam P - Extension pattern inputs of the dialect.
 * @typeParam A - Normalized extension patterns of the dialect.
 */
export interface PatternNormalizationContext<
  P extends ExtensionPattern,
  A extends ExtensionPattern = never,
> {
  /** Factory for canonical RDF terms. */
  readonly factory: FactoryFunctions;
  /**
   * Normalizes a nested graph pattern, including the dialect's own extension patterns.
   *
   * @param value - Graph pattern nested in the extension pattern.
   *
   * @example
   * Normalize the patterns inside an ARQ `LATERAL` group, as the ARQ dialect does.
   *
   * ```ts
   * import type { ArqAST, ArqInput, LateralInput, PatternNormalizationContext } from 'sparkql/arq';
   *
   * function normalizeLateral(
   *   value: LateralInput,
   *   context: PatternNormalizationContext<ArqInput, ArqAST>
   * ) {
   *   return value.patterns.map(pattern => context.pattern(pattern));
   * }
   * ```
   */
  pattern(value: PatternInput<P>): WithDialectPatterns<AST.Pattern, A>;
  /**
   * Normalizes an expression nested in the extension pattern.
   *
   * @param value - Expression, variable or literal value to normalize.
   *
   * @example
   * Normalize the expression of an ARQ `LET` binding, as the ARQ dialect does.
   *
   * ```ts
   * import type { ArqInput, LetInput, PatternNormalizationContext } from 'sparkql/arq';
   *
   * function normalizeLet(value: LetInput, context: PatternNormalizationContext<ArqInput>) {
   *   return { ...value, expression: context.expression(value.expression) };
   * }
   * ```
   */
  expression(value: ExpressionInput): AST.Expression;
}

/**
 * A SPARQL dialect: the extension patterns it accepts, how they normalize, and the generator
 * that prints them.
 *
 * Pass one to `SparqlDatabase.create({ dialect })`. Builders then accept its extension
 * patterns wherever a graph pattern is expected.
 *
 * @typeParam P - Extension pattern inputs the dialect accepts.
 * @typeParam A - The normalized form of those patterns, as the generator receives them.
 */
export interface SparqlDialect<
  P extends ExtensionPattern = never,
  A extends ExtensionPattern = never,
> {
  /** Recognition and normalization of extension patterns. */
  readonly patterns: {
    /** Returns whether a pattern input is one of this dialect's extension patterns. */
    is(value: unknown): value is P;
    /**
     * Converts an extension pattern input to its AST, normalizing nested patterns and
     * expressions through `context`.
     */
    normalize(value: P, context: PatternNormalizationContext<P, A>): A;
  };
  /** Generator for complete normalized queries and updates. */
  readonly generator: {
    /** Prints a normalized query or update, extension patterns included, as SPARQL text. */
    generate: (query: WithDialectPatterns<AST.SparqlQuery, A>) => string;
  };
}

/** Runtime shape used to carry a concrete dialect through generic builders. */
export interface AnySparqlDialect {
  /** Factories for extra database methods, such as `db.json()` in `sparkql/arq`. */
  readonly queries?: QueryFactories;
  /** Recognition and normalization of extension patterns. */
  readonly patterns: {
    is(value: unknown): boolean;
    normalize(value: any, context: PatternNormalizationContext<any, any>): ExtensionPattern;
  };
  /** Generator for normalized queries and updates. */
  readonly generator: { generate(query: any): string };
}
/** The extension pattern inputs a dialect accepts. */
export type DialectPattern<D extends AnySparqlDialect> =
  D extends SparqlDialect<infer P, any> ? P : never;
/** The AST type `T` with pattern positions widened to a dialect’s normalized patterns. */
export type DialectAST<D extends AnySparqlDialect, T> =
  D extends SparqlDialect<any, infer A> ? WithDialectPatterns<T, A> : never;

/**
 * Defines a dialect with extra database methods.
 *
 * The object is returned unchanged; the function only infers the dialect's types. Its generator
 * must print every normalized extension pattern. Each key of `queries` becomes a method on
 * databases created with the dialect, and must not be `then` or the name of an existing
 * database member: `SparqlDatabase.create` throws otherwise.
 *
 * @param dialect - Pattern handlers, generator and query factories.
 *
 * @example
 * Add a `db.namesQuery()` method that prints a prepared query.
 *
 * ```ts
 * const dialect = defineDialect({
 *   ...sparql11Dialect,
 *   queries: {
 *     namesQuery: context => () =>
 *       context.normalizer().where(triples(v.person, n.foaf.name, v.name)).toSPARQL(),
 *   },
 * });
 * const custom = SparqlDatabase.create({ managerConfig: prefixes, dialect });
 * custom.namesQuery();
 * ```
 *
 * ```sparql
 * SELECT * WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function defineDialect<
  P extends ExtensionPattern,
  A extends ExtensionPattern,
  Q extends QueryFactories,
>(
  dialect: SparqlDialect<P, A> & { readonly queries: Q }
): SparqlDialect<P, A> & { readonly queries: Q };
/**
 * Defines a dialect without extra database methods.
 *
 * See the first overload for details.
 *
 * @param dialect - Pattern handlers and generator.
 */
export function defineDialect<P extends ExtensionPattern, A extends ExtensionPattern>(
  dialect: SparqlDialect<P, A>
): SparqlDialect<P, A>;
export function defineDialect(dialect: AnySparqlDialect): AnySparqlDialect {
  return dialect;
}

/** The default SPARQL 1.1 dialect, with no extension patterns and no extra database methods. */
export const sparql11Dialect: SparqlDialect = {
  patterns: {
    is: (_value): _value is never => false,
    normalize: () => {
      throw new Error('The SPARQL 1.1 dialect does not support custom patterns.');
    },
  },
  generator: { generate: generateSparql },
};
