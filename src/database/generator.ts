import { GeneratorBuilder } from '@traqula/core';
import { sparql11GeneratorBuilder } from '@traqula/generator-sparql-1-1';
import * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from './errors.js';
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
const standardLiteral = sparql11GeneratorBuilder.getRule('rdfLiteral');
const standardBlankNode = sparql11GeneratorBuilder.getRule('blankNode');

function anchored(pattern: unknown): RegExp {
  if (!(pattern instanceof RegExp)) {
    throw new Error('Traqula must expose regular expressions for RDF term tokens.');
  }
  return new RegExp(`^(?:${pattern.source})$`, 'u');
}

const prefixedNameToken = anchored(AST.lex.terminals.pNameLn.PATTERN);
const prefixToken = anchored(AST.lex.terminals.pNameNs.PATTERN);
const blankNodeToken = anchored(AST.lex.terminals.blankNodeLabel.PATTERN);
const languageToken = anchored(AST.lex.terminals.langTag.PATTERN);

/**
 * Percent-encodes every character an IRI reference (`IRIREF`) forbids, so a value can never
 * end its `<…>` term.
 *
 * Covers spaces, ASCII control characters, `<>"{}|^` and backticks, and backslashes. A valid
 * IRI comes back unchanged. The generator applies it to every full IRI it prints.
 *
 * @param value - The IRI text to print.
 *
 * @example
 * Make an IRI built from user input safe to print.
 *
 * ```ts
 * escapeIri('https://example.org/people/Ada Lovelace>');
 * // 'https://example.org/people/Ada%20Lovelace%3E'
 * escapeIri('https://example.org/people/ada'); // unchanged
 * ```
 */
export function escapeIri(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: IRIREF excludes ASCII controls.
  return value.replace(/[\u0000-\u0020<>"{}|^`\\]/gu, char => encodeURIComponent(char));
}

/** PN_LOCAL_ESC punctuation, which a local name may contain behind a backslash. */
const localEscapes = new Set("!#$%&'()*+,./;=?@\\~-");

/**
 * Escapes a prefixed name's local part when it is not already a valid PN_LOCAL:
 * PN_LOCAL_ESC punctuation gets a backslash, characters an IRI forbids are
 * percent-encoded, and existing `%XX` escapes are kept.
 */
function escapeLocalName(prefix: string, local: string): string {
  if (local === '' ? prefixToken.test(`${prefix}:`) : prefixedNameToken.test(`${prefix}:${local}`))
    return local;
  const escaped = local.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: IRIs exclude ASCII controls.
    /%[\dA-Fa-f]{2}|[!#$%&'()*+,./;=?@\\~-]|[\u0000-\u0020<>"{}|^`]/gu,
    match => {
      if (match.length === 3) return match;
      return localEscapes.has(match) ? `\\${match}` : encodeURIComponent(match);
    }
  );
  if (!prefixedNameToken.test(`${prefix}:${escaped}`)) {
    throw new SparkqlError({ message: `Invalid prefixed name "${prefix}:${local}".` });
  }
  return escaped;
}

/** IRIs print with forbidden characters percent-encoded, so values cannot end the term. */
export const safeIriFullRule: AST.SparqlGeneratorRule<'iriFull', AST.TermIriFull> = {
  name: 'iriFull',
  gImpl:
    ({ PRINT }) =>
    (ast, { astFactory: F }) => {
      F.printFilter(ast, () => PRINT('<', escapeIri(ast.value), '>'));
    },
};

/** Prefixed names print with their local part escaped, and invalid prefixes are refused. */
export const safePrefixedNameRule: AST.SparqlGeneratorRule<'prefixedName', AST.TermIriPrefixed> = {
  name: 'prefixedName',
  gImpl:
    ({ PRINT }) =>
    (ast, { astFactory: F }) => {
      const local = escapeLocalName(ast.prefix, ast.value);
      F.printFilter(ast, () => PRINT(ast.prefix, ':', local));
    },
};

/** Language tags must be valid LANGTAGs, since they print without quoting. */
export const safeLiteralRule: AST.SparqlGeneratorRule<'rdfLiteral', AST.TermLiteral> = {
  name: 'rdfLiteral',
  gImpl: helpers => {
    const fallback = standardLiteral.gImpl(helpers);
    return (ast, context) => {
      const language = ast.langOrIri;
      if (typeof language === 'string' && !languageToken.test(`@${language}`)) {
        throw new SparkqlError({ message: `Invalid literal language tag "${language}".` });
      }
      fallback(ast, context);
    };
  },
};

/** Blank node labels must be valid BLANK_NODE_LABELs, since they print without quoting. */
export const safeBlankNodeRule: AST.SparqlGeneratorRule<'blankNode', AST.TermBlank> = {
  name: 'blankNode',
  gImpl: helpers => {
    const fallback = standardBlankNode.gImpl(helpers);
    return (ast, context) => {
      if (!blankNodeToken.test(`_:${ast.label.replace(/^e_/u, '')}`)) {
        throw new SparkqlError({ message: `Invalid blank node label "${ast.label}".` });
      }
      fallback(ast, context);
    };
  },
};

/**
 * Generator rule that prints raw `sparql` expressions in parentheses, so operator precedence
 * never leaks.
 */
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
 * Generator rule that prints raw `sparql` patterns as group content.
 *
 * A dot is added when the output ends open (not with `.` or `}`), so following triples stay
 * separate.
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

// Prints an RDF list as `( a b ... )` with every item separated. Traqula's rule prints the
// items back to back and relies on each term to space itself; literals do, but IRIs and
// variables do not, which produced `( foaf:Adafoaf:Grace )`.
const collectionPathRule: AST.SparqlGeneratorRule<'collectionPath', AST.TripleCollectionList> = {
  name: 'collectionPath',
  gImpl:
    ({ SUBRULE, PRINT_WORD }) =>
    (ast, { astFactory: F }) => {
      F.printFilter(ast, () => PRINT_WORD('('));
      // Even triples are `rdf:first` (the items); odd ones are `rdf:rest` links.
      for (const [index, triple] of ast.triples.entries()) {
        if (index % 2 !== 0) continue;
        F.printFilter(ast, () => PRINT_WORD(''));
        SUBRULE(AST.gram.graphNodePath, triple.object);
      }
      F.printFilter(ast, () => PRINT_WORD(')'));
    },
};

/**
 * Traqula's SPARQL 1.1 generator builder with support for raw `sparql` nodes, and with RDF
 * list items always separated by a space.
 *
 * RDF terms print escaped or are refused, so no value can break out of its term. Dialect
 * generators copy this builder with `GeneratorBuilder.create(...)` before patching rules;
 * never mutate it.
 */
export const sparkqlGeneratorBuilder: typeof sparql11GeneratorBuilder = GeneratorBuilder.create(
  sparql11GeneratorBuilder
)
  .patchRule(rawExpressionRule)
  .patchRule(rawPatternRule)
  .patchRule(safeIriFullRule)
  .patchRule(safePrefixedNameRule)
  .patchRule(safeLiteralRule)
  .patchRule(safeBlankNodeRule)
  .patchRule(collectionPathRule);

const generator = sparkqlGeneratorBuilder.build();

/**
 * Prints a normalized SPARQL 1.1 query or update as SPARQL text.
 *
 * Unlike `toSPARQL()`, it does not add `.comment()` lines, and it does not print dialect
 * extension patterns. Custom query modules use it as their `generate` step.
 *
 * @param query - Normalized query or update, such as the result of a builder's `getSPARQL()`.
 *
 * @example
 * Print the AST of a built query.
 *
 * ```ts
 * const ast = db
 *   .select({ name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name))
 *   .getSPARQL();
 * const text = generateSparql(ast);
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function generateSparql(query: AST.SparqlQuery): string {
  return generator.queryOrUpdate(query, AST.completeGeneratorContext({})).trim();
}
