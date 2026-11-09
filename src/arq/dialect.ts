import * as AST from '@traqula/rules-sparql-1-1';
import { defineDialect } from '../database/dialect.js';
import type { ExpressionInput, PatternInput } from '../helpers/types.js';
import { arqGenerator } from './generator.js';
import { arqQueries } from './queries.js';
import type { ArqAST, ArqInput, ArqPattern, LateralInput, LetInput } from './types.js';

export * from './types.js';

const loc = { sourceLocationType: 'autoGenerate' } as const;
export const arqDialect = defineDialect<ArqInput, ArqAST, typeof arqQueries>({
  queries: arqQueries,
  patterns: {
    is: (value): value is ArqInput =>
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'pattern' &&
      'subType' in value &&
      (value.subType === 'let' || value.subType === 'lateral'),
    normalize: (value, context) =>
      value.subType === 'let'
        ? { ...value, expression: context.expression(value.expression) }
        : {
            ...value,
            patterns: value.patterns.map(pattern =>
              context.pattern(pattern)
            ) as unknown as ArqPattern[],
          },
  },
  generator: {
    generate: query => arqGenerator.queryOrUpdate(query, AST.completeGeneratorContext({})).trim(),
  },
});

export function letBinding(expression: ExpressionInput, variable: AST.TermVariable): LetInput {
  return { type: 'pattern', subType: 'let', loc, variable, expression };
}

export function lateral(...patterns: PatternInput<ArqInput>[]): LateralInput {
  return { type: 'pattern', subType: 'lateral', loc, patterns };
}
