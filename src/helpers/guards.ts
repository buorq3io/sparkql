import { anyOf } from './generators.js';
import { termBlank, termExpression, termIri, termLiteral, termVariable } from './utilities.js';

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
 * Parses a variable, IRI or literal input to a term, the terms that can stand as an expression.
 *
 * The variable, IRI and literal parsers are tried in that order and the first that accepts
 * the value wins, so values with a built-in input format, such as strings, numbers and `URL`
 * objects, are converted. Same as {@link termExpression}`.parseOrThrow`.
 *
 * @throws {@link SparkqlError} When no parser accepts the value, such as for a blank node or a plain object.
 *
 * @example
 * Parse a variable and an IRI. Terms are returned unchanged; other inputs, such as `'Ada'`,
 * are built with the factories passed as the second argument.
 *
 * ```ts
 * parseOrThrowTermExpressionInput(v.name, {} as FactoryFunctions); // the ?name term
 * parseOrThrowTermExpressionInput(n.foaf.name, {} as FactoryFunctions); // the foaf:name term
 * ```
 */
export const parseOrThrowTermExpressionInput = termExpression.parseOrThrow;
