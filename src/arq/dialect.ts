import { GeneratorBuilder } from '@traqula/core';
import { sparql11GeneratorBuilder } from '@traqula/generator-sparql-1-1';
import * as AST from '@traqula/rules-sparql-1-1';
import type { ExpressionInput, PatternInput } from '../helpers/types.js';
import {
  defineDialect,
  type ExtensionPattern,
  type WithDialectPatterns,
} from '../database/dialect.js';

export type LetInput = ExtensionPattern & {
  subType: 'let';
  variable: AST.TermVariable;
  expression: ExpressionInput;
};
export type LateralInput = ExtensionPattern & {
  subType: 'lateral';
  patterns: PatternInput<ArqInput>[];
};
export type ArqInput = LetInput | LateralInput;
type LetAST = Omit<LetInput, 'expression'> & { expression: AST.Expression };
type LateralAST = Omit<LateralInput, 'patterns'> & {
  patterns: WithDialectPatterns<AST.Pattern, ArqAST>[];
};
export type ArqAST = LetAST | LateralAST;
type ArqQuery = WithDialectPatterns<AST.SparqlQuery, ArqAST>;

const loc = { sourceLocationType: 'autoGenerate' } as const;
const standardPattern = sparql11GeneratorBuilder.getRule('generatePattern');
const arqPattern: AST.SparqlGeneratorRule<
  'generatePattern',
  WithDialectPatterns<AST.Pattern, ArqAST>
> = {
  name: 'generatePattern',
  gImpl: helpers => {
    const fallback = standardPattern.gImpl(helpers);
    return (node, context) => {
      if (node.type === 'pattern' && node.subType === 'let') {
        helpers.PRINT_WORD('LET');
        helpers.PRINT('(');
        helpers.SUBRULE(AST.gram.var_, node.variable);
        helpers.PRINT(' := ');
        helpers.SUBRULE(AST.gram.expression, node.expression);
        helpers.PRINT(')');
      } else if (node.type === 'pattern' && node.subType === 'lateral') {
        helpers.PRINT_WORD('LATERAL');
        helpers.PRINT('{');
        for (const child of node.patterns) helpers.SUBRULE(arqPattern, child);
        helpers.PRINT('}');
      } else {
        // Traqula's existing rule signatures still describe the standard AST.
        // Nested calls dispatch to the patched generatePattern implementation.
        fallback(node as AST.Pattern, context);
      }
    };
  },
};
const generator = GeneratorBuilder.create(sparql11GeneratorBuilder)
  .patchRule(arqPattern)
  .typePatch<{ queryOrUpdate: [ArqQuery] }>()
  .build();

export const arqDialect = defineDialect<ArqInput, ArqAST>({
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
        : { ...value, patterns: value.patterns.map(pattern => context.pattern(pattern)) },
  },
  generator: {
    generate: query => generator.queryOrUpdate(query, AST.completeGeneratorContext({})).trim(),
  },
});

export function letBinding(expression: ExpressionInput, variable: AST.TermVariable): LetInput {
  return { type: 'pattern', subType: 'let', loc, variable, expression };
}

export function lateral(...patterns: PatternInput<ArqInput>[]): LateralInput {
  return { type: 'pattern', subType: 'lateral', loc, patterns };
}
