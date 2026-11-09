import { GeneratorBuilder } from '@traqula/core';
import { sparql11GeneratorBuilder } from '@traqula/generator-sparql-1-1';
import * as AST from '@traqula/rules-sparql-1-1';
import type { ArqPattern, ArqQuery } from './types.js';

const standardPattern = sparql11GeneratorBuilder.getRule('generatePattern');
const arqPattern: AST.SparqlGeneratorRule<'generatePattern', ArqPattern> = {
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
        fallback(node as unknown as AST.Pattern, context);
      }
    };
  },
};
type StandardRules =
  typeof sparql11GeneratorBuilder extends GeneratorBuilder<
    AST.SparqlGeneratorContext,
    any,
    infer Rules
  >
    ? Rules
    : never;
type ArqRules = Omit<StandardRules, 'generatePattern' | 'queryOrUpdate'> & {
  generatePattern: AST.SparqlGeneratorRule<'generatePattern', ArqPattern>;
  queryOrUpdate: AST.SparqlGeneratorRule<'queryOrUpdate', ArqQuery>;
};
type ArqGeneratorBuilder = GeneratorBuilder<
  AST.SparqlGeneratorContext,
  keyof ArqRules & string,
  ArqRules
>;

export const arqGeneratorBuilder: ArqGeneratorBuilder = GeneratorBuilder.create(
  sparql11GeneratorBuilder
)
  .patchRule(arqPattern)
  .typePatch<{ queryOrUpdate: [ArqQuery] }>();
export const arqGenerator: ReturnType<ArqGeneratorBuilder['build']> = arqGeneratorBuilder.build();
