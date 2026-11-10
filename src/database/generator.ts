import { GeneratorBuilder } from '@traqula/core';
import { sparql11GeneratorBuilder } from '@traqula/generator-sparql-1-1';
import * as AST from '@traqula/rules-sparql-1-1';
import { isRawExpression, isRawPattern, type RawASTValue, type RawExpression } from './raw.js';

type Helpers = Parameters<AST.SparqlGeneratorRule<'expression', AST.Expression>['gImpl']>[0];
type Raw = Pick<RawExpression, 'strings' | 'values'>;

/** Prints a raw node's text verbatim and its values through the grammar rules. */
function printRaw(helpers: Helpers, node: Raw): void {
  node.strings.forEach((text, index) => {
    if (text) helpers.PRINT(text);
    if (index < node.values.length) printValue(helpers, node.values[index]);
  });
}

function printValue(helpers: Helpers, value: RawASTValue): void {
  // Nested templates are inlined like drizzle's nested `sql`, without parentheses.
  if (isRawExpression(value) || isRawPattern(value)) printRaw(helpers, value);
  else if (value.type === 'pattern' || value.type === 'query') {
    // Rules dispatch by name, so dialect patches of generatePattern apply here too.
    helpers.SUBRULE(AST.gram.generatePattern, value as AST.Pattern);
  } else helpers.SUBRULE(AST.gram.expression, value as AST.Expression);
}

/**
 * Whether a raw pattern's output ends open, like a triple without its dot,
 * so that a following triple would run into it.
 */
function ending(node: Raw): 'closed' | 'open' | 'empty' {
  for (let index = node.strings.length - 1; index >= 0; index--) {
    const text = node.strings[index].trimEnd();
    if (text) return text.endsWith('.') || text.endsWith('}') ? 'closed' : 'open';
    const value = node.values[index - 1];
    if (value === undefined) continue;
    if (isRawExpression(value) || isRawPattern(value)) {
      const nested = ending(value);
      if (nested !== 'empty') return nested;
    } else if (value.type === 'pattern' && value.subType === 'bgp') {
      // triplesBlock terminates every triple with a dot; an empty one prints nothing.
      if (value.triples.length > 0) return 'closed';
    } else if (value.type === 'pattern' || value.type === 'query') {
      // Other patterns print a closing brace or a FILTER/BIND parenthesis.
      return 'closed';
    } else return 'open';
  }
  return 'empty';
}

const standardExpression = sparql11GeneratorBuilder.getRule('expression');
const standardPattern = sparql11GeneratorBuilder.getRule('generatePattern');

/** Raw expressions print in parentheses, so operator precedence never leaks. */
export const rawExpressionRule: AST.SparqlGeneratorRule<'expression', AST.Expression> = {
  name: 'expression',
  gImpl: helpers => {
    const fallback = standardExpression.gImpl(helpers);
    return (node, context) => {
      if (!isRawExpression(node)) return fallback(node, context);
      helpers.PRINT_WORD('(');
      printRaw(helpers, node as unknown as RawExpression);
      helpers.PRINT_WORD(')');
    };
  },
};

/**
 * Raw patterns print as group content. A dot is added when the output ends
 * open (not with `.` or `}`), so following triples stay separate.
 */
export const rawPatternRule: AST.SparqlGeneratorRule<'generatePattern', AST.Pattern> = {
  name: 'generatePattern',
  gImpl: helpers => {
    const fallback = standardPattern.gImpl(helpers);
    return (node, context) => {
      if (!isRawPattern(node)) return fallback(node, context);
      printRaw(helpers, node);
      if (ending(node) === 'open') helpers.PRINT_WORD('.');
      helpers.NEW_LINE();
    };
  },
};

/**
 * Traqula's SPARQL 1.1 generator with support for the raw `sparql` nodes.
 * Dialect generators copy this builder (never mutate it) before patching rules.
 */
export const sparkqlGeneratorBuilder: typeof sparql11GeneratorBuilder = GeneratorBuilder.create(
  sparql11GeneratorBuilder
)
  .patchRule(rawExpressionRule)
  .patchRule(rawPatternRule);

const generator = sparkqlGeneratorBuilder.build();

/** Generates a query or update from a normalized sparkql AST. */
export function generateSparql(query: AST.SparqlQuery): string {
  return generator.queryOrUpdate(query, AST.completeGeneratorContext({})).trim();
}
