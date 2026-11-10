import { GeneratorBuilder } from '@traqula/core';
import * as AST from '@traqula/rules-sparql-1-1';
import { sparkqlGeneratorBuilder } from '../database/generator.js';
import type { ArqPattern, ArqQuery } from './types.js';

const standardPattern = sparkqlGeneratorBuilder.getRule('generatePattern');
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
        // Print the group like OPTIONAL does, so nesting and indentation match.
        helpers.PRINT_WORD('LATERAL');
        helpers.SUBRULE(
          AST.gram.groupGraphPattern,
          context.astFactory.patternGroup(node.patterns as unknown as AST.Pattern[], node.loc)
        );
      } else {
        // Traqula's existing rule signatures still describe the standard AST.
        // Nested calls dispatch to the patched generatePattern implementation.
        fallback(node as unknown as AST.Pattern, context);
      }
    };
  },
};
type StandardRules =
  typeof sparkqlGeneratorBuilder extends GeneratorBuilder<
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

/** @internal Generator builder for ARQ patterns. */
export const arqGeneratorBuilder: ArqGeneratorBuilder = GeneratorBuilder.create(
  sparkqlGeneratorBuilder
)
  .patchRule(arqPattern)
  .typePatch<{ queryOrUpdate: [ArqQuery] }>();
/** @internal Generator for ARQ patterns. */
export const arqGenerator: ReturnType<ArqGeneratorBuilder['build']> = arqGeneratorBuilder.build();
