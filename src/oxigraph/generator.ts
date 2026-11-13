import { GeneratorBuilder } from '@traqula/core';
import * as AST from '@traqula/rules-sparql-1-1';
import { printLateral } from '../arq/generator.js';
import { sparkqlGeneratorBuilder } from '../database/generator.js';
import type { OxigraphPattern, OxigraphQuery } from './types.js';

const standardPattern = sparkqlGeneratorBuilder.getRule('generatePattern');
const oxigraphPattern: AST.SparqlGeneratorRule<'generatePattern', OxigraphPattern> = {
  name: 'generatePattern',
  gImpl: helpers => {
    const fallback = standardPattern.gImpl(helpers);
    return (node, context) => {
      if (node.type === 'pattern' && node.subType === 'lateral') {
        printLateral(helpers, node, context);
      } else {
        // Nested calls dispatch to this patched rule, so LATERAL prints at any depth.
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
type OxigraphRules = Omit<StandardRules, 'generatePattern' | 'queryOrUpdate'> & {
  generatePattern: AST.SparqlGeneratorRule<'generatePattern', OxigraphPattern>;
  queryOrUpdate: AST.SparqlGeneratorRule<'queryOrUpdate', OxigraphQuery>;
};
type OxigraphGeneratorBuilder = GeneratorBuilder<
  AST.SparqlGeneratorContext,
  keyof OxigraphRules & string,
  OxigraphRules
>;

const generator = (
  GeneratorBuilder.create(sparkqlGeneratorBuilder)
    .patchRule(oxigraphPattern)
    .typePatch<{ queryOrUpdate: [OxigraphQuery] }>() as OxigraphGeneratorBuilder
).build();

/** @internal Prints an Oxigraph query or update. */
export function generateOxigraph(query: OxigraphQuery): string {
  return generator.queryOrUpdate(query, AST.completeGeneratorContext({})).trim();
}
