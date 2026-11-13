import { GeneratorBuilder } from '@traqula/core';
import * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';
import { sparkqlGeneratorBuilder } from '../database/generator.js';
import { printPragmaValue } from './pragmas.js';
import { transitiveOptionTokens } from './transitive.js';
import type { DefineAST, VirtuosoPattern, VirtuosoQuery } from './types.js';

const standardPattern = sparkqlGeneratorBuilder.getRule('generatePattern');
const virtuosoPattern: AST.SparqlGeneratorRule<'generatePattern', VirtuosoPattern> = {
  name: 'generatePattern',
  gImpl: helpers => {
    const fallback = standardPattern.gImpl(helpers);
    return (node, context) => {
      if (node.type === 'pattern' && node.subType === 'virtuosoTextContains') {
        helpers.SUBRULE(AST.gram.var_, node.text);
        helpers.PRINT_WORD('bif:contains');
        helpers.SUBRULE(AST.gram.expression, node.query);
        if (node.score) {
          helpers.PRINT_WORD('OPTION');
          helpers.PRINT_WORD('(score');
          helpers.SUBRULE(AST.gram.var_, node.score);
          helpers.PRINT(')');
        }
        helpers.PRINT_WORD('.');
        helpers.NEW_LINE();
      } else if (node.type === 'pattern' && node.subType === 'virtuosoTransitive') {
        helpers.SUBRULE(AST.gram.groupGraphPattern, node.subquery as unknown as AST.PatternGroup);
        helpers.PRINT_WORD('OPTION');
        helpers.PRINT(' (');
        transitiveOptionTokens(node.options).forEach((part, index) => {
          if (index > 0) helpers.PRINT(', ');
          for (const token of part) {
            if (typeof token === 'string') helpers.PRINT(token);
            else helpers.SUBRULE(AST.gram.var_, token);
          }
        });
        helpers.PRINT(')');
        helpers.NEW_LINE();
      } else if (node.type === 'pattern' && node.subType === 'virtuosoDefine') {
        throw new SparkqlError({
          message:
            'A Virtuoso DEFINE pragma must be in the outermost WHERE clause of a query or update.',
        });
      } else {
        // Nested calls dispatch to this patched rule, so extension patterns print anywhere.
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
type VirtuosoRules = Omit<StandardRules, 'generatePattern' | 'queryOrUpdate'> & {
  generatePattern: AST.SparqlGeneratorRule<'generatePattern', VirtuosoPattern>;
  queryOrUpdate: AST.SparqlGeneratorRule<'queryOrUpdate', VirtuosoQuery>;
};
type VirtuosoGeneratorBuilder = GeneratorBuilder<
  AST.SparqlGeneratorContext,
  keyof VirtuosoRules & string,
  VirtuosoRules
>;

/** @internal Generator builder for Virtuoso patterns. */
export const virtuosoGeneratorBuilder: VirtuosoGeneratorBuilder = GeneratorBuilder.create(
  sparkqlGeneratorBuilder
)
  .patchRule(virtuosoPattern)
  .typePatch<{ queryOrUpdate: [VirtuosoQuery] }>();

const generator = virtuosoGeneratorBuilder.build();

const isDefine = (pattern: { type: string; subType?: string }): pattern is DefineAST =>
  pattern.type === 'pattern' && pattern.subType === 'virtuosoDefine';

type Where = { patterns: VirtuosoPattern[] };

/** Takes the pragmas out of an outermost `WHERE` group, leaving the rest in place. */
function takeDefines(where: Where | undefined, defines: DefineAST[]): Where | undefined {
  if (!where?.patterns.some(isDefine)) return where;
  const rest: VirtuosoPattern[] = [];
  for (const pattern of where.patterns) {
    if (isDefine(pattern)) defines.push(pattern);
    else rest.push(pattern);
  }
  return { ...where, patterns: rest };
}

/**
 * @internal Prints a Virtuoso query or update. `DEFINE` pragmas in the outermost `WHERE` clauses move to
 * the start, before the prologue.
 */
export function generateVirtuoso(query: VirtuosoQuery): string {
  const defines: DefineAST[] = [];
  let stripped: VirtuosoQuery;
  if (query.type === 'update') {
    stripped = {
      ...query,
      updates: query.updates.map(update =>
        update.operation?.subType === 'modify'
          ? {
              ...update,
              operation: {
                ...update.operation,
                where: takeDefines(update.operation.where as Where, defines),
              },
            }
          : update
      ),
    } as VirtuosoQuery;
  } else {
    stripped = {
      ...query,
      where: takeDefines(query.where as Where | undefined, defines),
    } as VirtuosoQuery;
  }
  const text = generator.queryOrUpdate(stripped, AST.completeGeneratorContext({})).trim();
  const prologue = defines.map(item => `DEFINE ${item.name} ${printPragmaValue(item.value)}\n`);
  return prologue.join('') + text;
}
