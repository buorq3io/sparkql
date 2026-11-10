import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExpressionInput, FactoryFunctions, PatternInput } from '../helpers/types.js';
import { generateSparql } from './generator.js';
import type { QueryFactories } from './query-module.js';

/** Custom patterns use distinct subtypes, just like Traqula's built-in nodes. */
export interface ExtensionPattern {
  type: 'pattern';
  subType: string;
  loc: AST.Pattern['loc'];
}

type NodeSubtypes<T> = T extends { subType: infer S } ? S : never;
type DeepDialectPatterns<T, P> = T extends readonly unknown[]
  ? { [K in keyof T]: WithDialectPatterns<T[K], P> }
  : T extends object
    ? { [K in keyof T]: DeepDialectPatterns<T[K], P> }
    : T;

/** Preserve concrete node shapes; widen only complete pattern unions in arrays. */
export type WithDialectPatterns<T, P> = [P] extends [never]
  ? T
  : [AST.Pattern['subType']] extends [NodeSubtypes<T>]
    ? P | DeepDialectPatterns<T, P>
    : DeepDialectPatterns<T, P>;

export interface PatternNormalizationContext<
  P extends ExtensionPattern,
  A extends ExtensionPattern = never,
> {
  readonly factory: FactoryFunctions;
  pattern(value: PatternInput<P>): WithDialectPatterns<AST.Pattern, A>;
  expression(value: ExpressionInput): AST.Expression;
}

/** A dialect couples accepted input nodes, normalization, and generation. */
export interface SparqlDialect<
  P extends ExtensionPattern = never,
  A extends ExtensionPattern = never,
> {
  readonly patterns: {
    is(value: unknown): value is P;
    normalize(value: P, context: PatternNormalizationContext<P, A>): A;
  };
  readonly generator: {
    generate: (query: WithDialectPatterns<AST.SparqlQuery, A>) => string;
  };
}

/** Runtime shape used to carry a concrete dialect through generic builders. */
export interface AnySparqlDialect {
  readonly queries?: QueryFactories;
  readonly patterns: {
    is(value: unknown): boolean;
    normalize(value: any, context: PatternNormalizationContext<any, any>): ExtensionPattern;
  };
  readonly generator: { generate(query: any): string };
}
export type DialectPattern<D extends AnySparqlDialect> =
  D extends SparqlDialect<infer P, any> ? P : never;
export type DialectAST<D extends AnySparqlDialect, T> =
  D extends SparqlDialect<any, infer A> ? WithDialectPatterns<T, A> : never;

export function defineDialect<
  P extends ExtensionPattern,
  A extends ExtensionPattern,
  Q extends QueryFactories,
>(
  dialect: SparqlDialect<P, A> & { readonly queries: Q }
): SparqlDialect<P, A> & { readonly queries: Q };
export function defineDialect<P extends ExtensionPattern, A extends ExtensionPattern>(
  dialect: SparqlDialect<P, A>
): SparqlDialect<P, A>;
export function defineDialect(dialect: AnySparqlDialect): AnySparqlDialect {
  return dialect;
}

export const sparql11Dialect: SparqlDialect = {
  patterns: {
    is: (_value): _value is never => false,
    normalize: () => {
      throw new Error('The SPARQL 1.1 dialect does not support custom patterns.');
    },
  },
  generator: { generate: generateSparql },
};
