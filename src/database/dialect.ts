import type * as AST from '@traqula/rules-sparql-1-1';
import { Generator } from '@traqula/generator-sparql-1-1';
import type { ExpressionInput, FactoryFunctions, PatternInput } from '../helpers/types.js';

/** Custom patterns use distinct subtypes, just like Traqula's built-in nodes. */
export interface ExtensionPattern {
  type: 'pattern';
  subType: string;
  loc: AST.Pattern['loc'];
}

/** Preserve the query shape while adding custom patterns at every nesting level. */
export type WithDialectPatterns<T, P> = [P] extends [never]
  ? T
  : [AST.Pattern] extends [T]
  ? P | { [K in keyof T]: WithDialectPatterns<T[K], P> }
  : T extends object
  ? { [K in keyof T]: WithDialectPatterns<T[K], P> }
  : T;

export interface PatternNormalizationContext<
  P extends ExtensionPattern,
  A extends ExtensionPattern = never
> {
  readonly factory: FactoryFunctions;
  pattern(value: PatternInput<P>): WithDialectPatterns<AST.Pattern, A>;
  expression(value: ExpressionInput): AST.Expression;
}

/** A dialect couples accepted input nodes, normalization, and generation. */
export interface SparqlDialect<
  P extends ExtensionPattern = never,
  A extends ExtensionPattern = never
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
  readonly patterns: {
    is(value: unknown): boolean;
    normalize(value: any, context: PatternNormalizationContext<any, any>): ExtensionPattern;
  };
  readonly generator: { generate(query: any): string };
}
export type DialectPattern<D extends AnySparqlDialect> = D extends SparqlDialect<infer P, any>
  ? P
  : never;
export type DialectAST<D extends AnySparqlDialect, T> = D extends SparqlDialect<any, infer A>
  ? WithDialectPatterns<T, A>
  : never;

export function defineDialect<P extends ExtensionPattern, A extends ExtensionPattern>(
  dialect: SparqlDialect<P, A>
): SparqlDialect<P, A> {
  return dialect;
}

export const sparql11Dialect: SparqlDialect = {
  patterns: {
    is: (_value): _value is never => false,
    normalize: () => {
      throw new Error('The SPARQL 1.1 dialect does not support custom patterns.');
    },
  },
  generator: new Generator(),
};
