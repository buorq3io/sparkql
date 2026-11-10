import { anyOf, oneOf } from './generators.js';
import { termBlank, termIri, termLiteral, termVariable } from './utilities.js';

/**
 * Tests for an IRI, blank node or literal input, including values with a built-in input
 * format such as strings, numbers, `URL` and `[]`.
 *
 * Unlike {@link isGraphNodeInput}, it rejects variables, placeholders and triple collections.
 *
 * @example
 * Check for a concrete RDF value rather than a variable.
 *
 * ```ts
 * acceptsGraphNodeInput('Ada'); // true
 * acceptsGraphNodeInput(v.name); // false
 * ```
 */
export const acceptsGraphNodeInput = anyOf(termIri.accepts, termBlank.accepts, termLiteral.accepts);

/**
 * Tests for a variable, IRI or literal input, the terms that can stand as an expression,
 * including values with a built-in input format such as strings and numbers.
 *
 * Blank nodes, including `[]`, are rejected.
 *
 * @example
 * Check values used as expression operands.
 *
 * ```ts
 * acceptsTermExpressionInput(v.age); // true
 * acceptsTermExpressionInput(18); // true: becomes an xsd:integer literal
 * acceptsTermExpressionInput([]); // false
 * ```
 */
export const acceptsTermExpressionInput = anyOf(
  termVariable.accepts,
  termIri.accepts,
  termLiteral.accepts
);

/**
 * Parses a variable input to a variable term.
 *
 * It is built from the `parseOrThrow` parsers of variables, IRIs and literals, but the
 * variable parser throws `Unsupported variable term value provided.` for any other input
 * before the IRI and literal parsers run. Only variables parse; use
 * {@link termExpression}`.parseOrThrow` to parse all three kinds.
 *
 * @example
 * Parse a variable.
 *
 * ```ts
 * parseOrThrowTermExpressionInput(v.name, {} as FactoryFunctions); // the ?name term
 * ```
 */
export const parseOrThrowTermExpressionInput = oneOf(
  termVariable.parseOrThrow,
  termIri.parseOrThrow,
  termLiteral.parseOrThrow
);
