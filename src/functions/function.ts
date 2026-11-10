import type {
  ExpressionInput,
  ExpressionOperationInput,
  ExpressionPatternOperationInput,
  PatternInput,
  TermBlankOutput,
  TermIriOutput,
  TermLiteralOutput,
  TermVariableInput,
} from '../helpers/types.js';

import {
  group,
  transformBlank,
  transformBoolean,
  transformDate,
  transformIri,
  transformLiteral,
  transformNumber,
  transformString,
} from '../structures/index.js';
import { createOperationExpression, createPatternOperationExpression } from './utils.js';

// FUNCTIONAL FORMS

/**
 * Tests whether a variable is bound (`BOUND`).
 *
 * @param args - `[variable]`: The variable to test.
 *
 * @example
 * Find whether each person has a name.
 *
 * ```ts
 * db.select({ result: as(bound(v.name), v.result) })
 *   .where(triples(v.person, n.foaf.age, v.age), optional(triples(v.person, n.foaf.name, v.name)));
 * ```
 *
 * ```sparql
 * SELECT ( BOUND( ?name ) AS ?result ) WHERE {
 *   ?person foaf:age ?age .
 *   OPTIONAL {
 *     ?person foaf:name ?name .
 *   }
 * }
 * ```
 */
export function bound(...args: [TermVariableInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('bound', args, transformBoolean);
}

/**
 * Returns one of two expressions based on a condition (`IF`).
 *
 * Only the selected alternative is evaluated; an error in the condition yields an error.
 *
 * @param args - `[condition, whenTrue, whenFalse]`: The condition and its two alternatives.
 *
 * @example
 * Use a fallback when the name is unbound.
 *
 * ```ts
 * db.select({ result: as(ternary(bound(v.name), v.name, "Unknown"), v.result) })
 *   .where(triples(v.person, n.foaf.age, v.age), optional(triples(v.person, n.foaf.name, v.name)));
 * ```
 *
 * ```sparql
 * SELECT ( IF( BOUND( ?name ) , ?name , "Unknown" ) AS ?result ) WHERE {
 *   ?person foaf:age ?age .
 *   OPTIONAL {
 *     ?person foaf:name ?name .
 *   }
 * }
 * ```
 */
export function ternary(...args: [ExpressionInput, ExpressionInput, ExpressionInput]) {
  return createOperationExpression('if', args);
}

/**
 * Returns the first expression that evaluates without an error (`COALESCE`).
 *
 * If every expression raises an error, the result is an error.
 *
 * @param args - `[first, ...alternatives]`: Expressions to evaluate in order.
 *
 * @example
 * Prefer a nickname over a name.
 *
 * ```ts
 * db.select({ result: as(coalesce(v.nick, v.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name), optional(triples(v.person, n.foaf.nick, v.nick)));
 * ```
 *
 * ```sparql
 * SELECT ( COALESCE( ?nick , ?name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 *   OPTIONAL {
 *     ?person foaf:nick ?nick .
 *   }
 * }
 * ```
 */
export function coalesce(...args: [ExpressionInput, ...ExpressionInput[]]) {
  return createOperationExpression('coalesce', args);
}

/**
 * Tests whether a graph pattern matches (`EXISTS`).
 *
 * The pattern is evaluated against the current solution without adding bindings.
 *
 * @param args - `[pattern]`: The graph pattern to test.
 *
 * @example
 * Check whether each person knows someone.
 *
 * ```ts
 * db.select({ result: as(exists(triples(v.person, n.foaf.knows, v.friend)), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( EXISTS {
 *   ?person foaf:knows ?friend .
 * }
 * AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function exists(...args: [PatternInput]): ExpressionPatternOperationInput<boolean> {
  return createPatternOperationExpression('exists', group(...args), transformBoolean);
}

/**
 * Tests whether a graph pattern has no match (`NOT EXISTS`).
 *
 * The pattern is evaluated against the current solution without adding bindings.
 *
 * @param args - `[pattern]`: The graph pattern to test.
 *
 * @example
 * Check whether each person knows nobody.
 *
 * ```ts
 * db.select({ result: as(notExists(triples(v.person, n.foaf.knows, v.friend)), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( NOT EXISTS {
 *   ?person foaf:knows ?friend .
 * }
 * AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function notExists(...args: [PatternInput]): ExpressionPatternOperationInput<boolean> {
  return createPatternOperationExpression('notexists', group(...args), transformBoolean);
}

/**
 * Tests whether two RDF terms are identical (`SAMETERM`).
 *
 * Unlike value equality, this compares RDF term identity.
 *
 * @param args - `[left, right]`: The RDF terms to compare.
 *
 * @example
 * Check whether a person and friend are the same term.
 *
 * ```ts
 * db.select({ result: as(sameTerm(v.person, v.friend), v.result) })
 *   .where(triples(v.person, n.foaf.knows, v.friend));
 * ```
 *
 * ```sparql
 * SELECT ( SAMETERM( ?person , ?friend ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 * }
 * ```
 */
export function sameTerm(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('sameterm', args, transformBoolean);
}

/**
 * Tests whether a value equals any value in a list (`IN`).
 *
 * Comparison errors can propagate if no candidate matches.
 *
 * @param args - `[value, candidates]`: The value to test and the candidate expressions.
 *
 * @example
 * Check whether a name is Ada or Grace.
 *
 * ```ts
 * db.select({ result: as(inArray(v.name, ["Ada", "Grace"]), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( ( ?name IN ( "Ada" , "Grace" ) ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function inArray(
  ...args: [ExpressionInput, ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('in', [args[0], ...args[1]], transformBoolean);
}

/**
 * Tests whether a value differs from every value in a list (`NOT IN`).
 *
 * Comparison errors can propagate if no candidate matches.
 *
 * @param args - `[value, candidates]`: The value to test and the candidate expressions.
 *
 * @example
 * Check whether a name is neither Ada nor Grace.
 *
 * ```ts
 * db.select({ result: as(notinArray(v.name, ["Ada", "Grace"]), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( ( ?name NOT IN ( "Ada" , "Grace" ) ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function notinArray(
  ...args: [ExpressionInput, ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('notin', [args[0], ...args[1]], transformBoolean);
}

// FUNCTIONS ON RDF TERMS

/**
 * Tests whether a term is an IRI (`ISIRI`).
 *
 * @param args - `[value]`: The RDF term to test.
 *
 * @example
 * Check whether a homepage is an IRI.
 *
 * ```ts
 * db.select({ result: as(isIRI(v.homepage), v.result) })
 *   .where(triples(v.person, n.foaf.homepage, v.homepage));
 * ```
 *
 * ```sparql
 * SELECT ( ISIRI( ?homepage ) AS ?result ) WHERE {
 *   ?person foaf:homepage ?homepage .
 * }
 * ```
 */
export function isIRI(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isiri', args, transformBoolean);
}

/**
 * Tests whether a term is an IRI (`ISURI`).
 *
 * @param args - `[value]`: The RDF term to test.
 *
 * @example
 * Check whether a homepage is an IRI.
 *
 * ```ts
 * db.select({ result: as(isURI(v.homepage), v.result) })
 *   .where(triples(v.person, n.foaf.homepage, v.homepage));
 * ```
 *
 * ```sparql
 * SELECT ( ISURI( ?homepage ) AS ?result ) WHERE {
 *   ?person foaf:homepage ?homepage .
 * }
 * ```
 */
export function isURI(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isuri', args, transformBoolean);
}

/**
 * Tests whether a term is a blank node (`ISBLANK`).
 *
 * @param args - `[value]`: The RDF term to test.
 *
 * @example
 * Check whether a friend is a blank node.
 *
 * ```ts
 * db.select({ result: as(isBlank(v.friend), v.result) })
 *   .where(triples(v.person, n.foaf.knows, v.friend));
 * ```
 *
 * ```sparql
 * SELECT ( ISBLANK( ?friend ) AS ?result ) WHERE {
 *   ?person foaf:knows ?friend .
 * }
 * ```
 */
export function isBlank(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isblank', args, transformBoolean);
}

/**
 * Tests whether a term is a literal (`ISLITERAL`).
 *
 * @param args - `[value]`: The RDF term to test.
 *
 * @example
 * Check whether a name is a literal.
 *
 * ```ts
 * db.select({ result: as(isLiteral(v.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( ISLITERAL( ?name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function isLiteral(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isliteral', args, transformBoolean);
}

/**
 * Tests whether a term is a numeric literal (`ISNUMERIC`).
 *
 * @param args - `[value]`: The RDF term to test.
 *
 * @example
 * Check whether an age is numeric.
 *
 * ```ts
 * db.select({ result: as(isNumeric(v.age), v.result) })
 *   .where(triples(v.person, n.foaf.age, v.age));
 * ```
 *
 * ```sparql
 * SELECT ( ISNUMERIC( ?age ) AS ?result ) WHERE {
 *   ?person foaf:age ?age .
 * }
 * ```
 */
export function isNumeric(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('isnumeric', args, transformBoolean);
}

/**
 * Returns the lexical form of an IRI or literal as a string (`STR`).
 *
 * The result is a string without the original language tag or datatype.
 *
 * @param args - `[value]`: The IRI or literal to convert.
 *
 * @example
 * Return a homepage as a string.
 *
 * ```ts
 * db.select({ result: as(str(v.homepage), v.result) })
 *   .where(triples(v.person, n.foaf.homepage, v.homepage));
 * ```
 *
 * ```sparql
 * SELECT ( STR( ?homepage ) AS ?result ) WHERE {
 *   ?person foaf:homepage ?homepage .
 * }
 * ```
 */
export function str(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('str', args, transformString);
}

/**
 * Returns the language tag of a literal (`LANG`).
 *
 * Returns an empty string when the literal has no language tag; non-literals raise an error.
 *
 * @param args - `[value]`: The literal to inspect.
 *
 * @example
 * Return the language tag of each name.
 *
 * ```ts
 * db.select({ result: as(lang(v.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( LANG( ?name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function lang(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('lang', args, transformString);
}

/**
 * Returns the datatype IRI of a literal (`DATATYPE`).
 *
 * Non-literals raise an error.
 *
 * @param args - `[value]`: The literal to inspect.
 *
 * @example
 * Return the datatype of each age.
 *
 * ```ts
 * db.select({ result: as(datatype(v.age), v.result) })
 *   .where(triples(v.person, n.foaf.age, v.age));
 * ```
 *
 * ```sparql
 * SELECT ( DATATYPE( ?age ) AS ?result ) WHERE {
 *   ?person foaf:age ?age .
 * }
 * ```
 */
export function datatype(...args: [ExpressionInput]): ExpressionOperationInput<TermIriOutput> {
  return createOperationExpression('datatype', args, transformIri);
}

/**
 * Constructs an IRI from a string or IRI (`IRI`).
 *
 * Relative references are resolved against the base IRI.
 *
 * @param args - `[value]`: The string or IRI to convert.
 *
 * @example
 * Convert a homepage string to an IRI.
 *
 * ```ts
 * db.select({ result: as(iri(v.homepage), v.result) })
 *   .where(triples(v.person, n.foaf.homepage, v.homepage));
 * ```
 *
 * ```sparql
 * SELECT ( IRI( ?homepage ) AS ?result ) WHERE {
 *   ?person foaf:homepage ?homepage .
 * }
 * ```
 */
export function iri(...args: [ExpressionInput]): ExpressionOperationInput<TermIriOutput> {
  return createOperationExpression('iri', args, transformIri);
}

/**
 * Constructs an IRI from a string or IRI (`URI`).
 *
 * Relative references are resolved against the base IRI.
 *
 * @param args - `[value]`: The string or IRI to convert.
 *
 * @example
 * Convert a homepage string to an IRI.
 *
 * ```ts
 * db.select({ result: as(uri(v.homepage), v.result) })
 *   .where(triples(v.person, n.foaf.homepage, v.homepage));
 * ```
 *
 * ```sparql
 * SELECT ( URI( ?homepage ) AS ?result ) WHERE {
 *   ?person foaf:homepage ?homepage .
 * }
 * ```
 */
export function uri(...args: [ExpressionInput]): ExpressionOperationInput<TermIriOutput> {
  return createOperationExpression('uri', args, transformIri);
}

/**
 * Constructs a blank node (`BNODE`).
 *
 * Without a label, a fresh blank node is generated.
 *
 * @param args - `[label]`: An optional string used to identify the blank node within a solution.
 *
 * @example
 * Create a blank node for each person.
 *
 * ```ts
 * db.select({ result: as(bnode(), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( BNODE( ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function bnode(...args: [ExpressionInput] | []): ExpressionOperationInput<TermBlankOutput> {
  return createOperationExpression('bnode', args, transformBlank);
}

/**
 * Constructs a typed literal from a string and datatype IRI (`STRDT`).
 *
 * The first argument must be a simple literal and the second an IRI.
 *
 * @param args - `[lexicalForm, datatype]`: The string and datatype IRI.
 *
 * @example
 * Construct a typed literal from a name.
 *
 * ```ts
 * db.select({ result: as(strdt(v.name, n.schema.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( STRDT( ?name , schema:name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function strdt(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('strdt', args, transformLiteral);
}

/**
 * Constructs a language-tagged literal from a string (`STRLANG`).
 *
 * Both arguments must be simple literals.
 *
 * @param args - `[lexicalForm, language]`: The string and language tag.
 *
 * @example
 * Tag a name as English.
 *
 * ```ts
 * db.select({ result: as(strlang(v.name, "en"), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( STRLANG( ?name , "en" ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function strlang(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('strlang', args, transformLiteral);
}

/**
 * Returns a fresh UUID IRI (`UUID`).
 *
 * The result is an IRI term.
 *
 * @example
 * Assign a fresh identifier to each person.
 *
 * ```ts
 * db.select({ result: as(uuid(), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( UUID( ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function uuid(): ExpressionOperationInput<TermIriOutput> {
  return createOperationExpression('uuid', [], transformIri);
}

/**
 * Returns a fresh UUID string (`STRUUID`).
 *
 * The result is a string.
 *
 * @example
 * Assign a fresh identifier string to each person.
 *
 * ```ts
 * db.select({ result: as(struuid(), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( STRUUID( ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function struuid(): ExpressionOperationInput<string> {
  return createOperationExpression('struuid', [], transformString);
}

// FUNCTIONS ON STRINGS

/**
 * Returns the number of characters in a string literal (`STRLEN`).
 *
 * @param args - `[value]`: A string literal or an expression that evaluates to one.
 *
 * @example
 * Find people whose name is longer than three characters.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(gt(strlen(v.name), 3))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( ( STRLEN( ?name ) > "3"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function strlen(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('strlen', args, transformNumber);
}

/**
 * Returns part of a string (`SUBSTR`).
 *
 * Positions are 1-based. The result preserves the input literal’s language tag or datatype.
 *
 * @param args - `[value, start, length?]`: The string, 1-based starting position, and optional length.
 *
 * @example
 * Extract the first three characters of each name.
 *
 * ```ts
 * db.select({ result: as(substr(v.name, 1, 3), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( SUBSTR( ?name , "1"^^<http://www.w3.org/2001/XMLSchema#integer> , "3"^^<http://www.w3.org/2001/XMLSchema#integer> ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function substr(
  ...args: [ExpressionInput, ExpressionInput, ...([ExpressionInput] | [])]
): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('substr', args, transformLiteral);
}

/**
 * Returns a string in uppercase (`UCASE`).
 *
 * The result preserves the input literal’s language tag or datatype.
 *
 * @param args - `[value]`: The string to convert.
 *
 * @example
 * Show each name in uppercase.
 *
 * ```ts
 * db.select({ result: as(ucase(v.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( UCASE( ?name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function ucase(...args: [ExpressionInput]): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('ucase', args, transformLiteral);
}

/**
 * Returns a string in lowercase (`LCASE`).
 *
 * The result preserves the input literal’s language tag or datatype.
 *
 * @param args - `[value]`: The string to convert.
 *
 * @example
 * Show each name in lowercase.
 *
 * ```ts
 * db.select({ result: as(lcase(v.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( LCASE( ?name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function lcase(...args: [ExpressionInput]): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('lcase', args, transformLiteral);
}

/**
 * Tests whether a string starts with a prefix (`STRSTARTS`).
 *
 * @param args - `[value, prefix]`: The string to test and the prefix to look for.
 *
 * @example
 * Find people whose name starts with A.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(strstarts(v.name, 'A'))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( STRSTARTS( ?name , "A" ) )
 * }
 * ```
 */
export function strstarts(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('strstarts', args, transformBoolean);
}

/**
 * Tests whether a string ends with a suffix (`STRENDS`).
 *
 * @param args - `[value, suffix]`: The string to test and the suffix to look for.
 *
 * @example
 * Find people whose name ends with son.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(strends(v.name, 'son'))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( STRENDS( ?name , "son" ) )
 * }
 * ```
 */
export function strends(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('strends', args, transformBoolean);
}

/**
 * Tests whether a string contains another string (`CONTAINS`).
 *
 * @param args - `[value, substring]`: The string to test and the substring to find.
 *
 * @example
 * Find people whose name contains Ada.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(contains(v.name, 'Ada'))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( CONTAINS( ?name , "Ada" ) )
 * }
 * ```
 */
export function contains(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('contains', args, transformBoolean);
}

/**
 * Returns the part of a string before a match (`STRBEFORE`).
 *
 * When a match is found, the result preserves the first argument’s language tag or datatype.
 *
 * @param args - `[value, substring]`: The string to search and the delimiter.
 *
 * @example
 * Extract the local part of each mailbox address.
 *
 * ```ts
 * db.select({ result: as(strbefore(strafter(str(v.mbox), 'mailto:'), '@'), v.result) })
 *   .where(triples(v.person, n.foaf.mbox, v.mbox));
 * ```
 *
 * ```sparql
 * SELECT ( STRBEFORE( STRAFTER( STR( ?mbox ) , "mailto:" ) , "@" ) AS ?result ) WHERE {
 *   ?person foaf:mbox ?mbox .
 * }
 * ```
 */
export function strbefore(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('strbefore', args, transformLiteral);
}

/**
 * Returns the part of a string after a match (`STRAFTER`).
 *
 * When a match is found, the result preserves the first argument’s language tag or datatype.
 *
 * @param args - `[value, substring]`: The string to search and the delimiter.
 *
 * @example
 * Remove the mailto scheme from each mailbox address.
 *
 * ```ts
 * db.select({ result: as(strafter(str(v.mbox), 'mailto:'), v.result) })
 *   .where(triples(v.person, n.foaf.mbox, v.mbox));
 * ```
 *
 * ```sparql
 * SELECT ( STRAFTER( STR( ?mbox ) , "mailto:" ) AS ?result ) WHERE {
 *   ?person foaf:mbox ?mbox .
 * }
 * ```
 */
export function strafter(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('strafter', args, transformLiteral);
}

/**
 * Percent-encodes a string for use in a URI (`ENCODE_FOR_URI`).
 *
 * The result is a string without a language tag.
 *
 * @param args - `[value]`: The string to encode.
 *
 * @example
 * Encode names for use in a URI.
 *
 * ```ts
 * db.select({ result: as(encodeForURI(v.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( ENCODE_FOR_URI( ?name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function encodeForURI(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('encode_for_uri', args, transformString);
}

/**
 * Joins strings into one literal (`CONCAT`).
 *
 * The result retains a language tag only when all inputs have the same tag.
 *
 * @param args - Strings to join in order.
 *
 * @example
 * Add a greeting before each name.
 *
 * ```ts
 * db.select({ result: as(concat('Hello, ', v.name), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( CONCAT( "Hello, " , ?name ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function concat(...args: ExpressionInput[]): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('concat', args, transformLiteral);
}

/**
 * Tests whether a language tag matches a language range (`LANGMATCHES`).
 *
 * @param args - `[tag, range]`: The language tag and range to match.
 *
 * @example
 * Find names tagged as English.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(langMatches(lang(v.name), 'en'))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( LANGMATCHES( LANG( ?name ) , "en" ) )
 * }
 * ```
 */
export function langMatches(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('langmatches', args, transformBoolean);
}

/**
 * Tests whether a string matches a regular expression (`REGEX`).
 *
 * Flags are a string such as `i` for case-insensitive matching.
 *
 * @param args - `[value, pattern, flags?]`: The string, pattern, and optional flags.
 *
 * @example
 * Find names beginning with Ada, ignoring case.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(regex(v.name, '^ada', 'i'))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( REGEX( ?name , "^ada" , "i" ) )
 * }
 * ```
 */
export function regex(
  ...args: [ExpressionInput, ExpressionInput, ...([ExpressionInput] | [])]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('regex', args, transformBoolean);
}

/**
 * Replaces regular expression matches in a string (`REPLACE`).
 *
 * Flags are a string such as `i` for case-insensitive matching.
 *
 * @param args - `[value, pattern, replacement, flags?]`: The string, pattern, replacement, and optional flags.
 *
 * @example
 * Replace spaces in names with underscores.
 *
 * ```ts
 * db.select({ result: as(replace(v.name, ' ', '_'), v.result) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( REPLACE( ?name , " " , "_" ) AS ?result ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function replace(
  ...args: [ExpressionInput, ExpressionInput, ExpressionInput, ...([ExpressionInput] | [])]
) {
  return createOperationExpression('replace', args, transformLiteral);
}

// FUNCTIONS ON NUMERICS

/**
 * Returns the absolute value of a number (`ABS`).
 *
 * @param args - `[value]`: The numeric expression to evaluate.
 *
 * @example
 * Find each person's distance from age 30.
 *
 * ```ts
 * db.select({ distance: as(abs(subs(v.age, 30)), v.distance) })
 *   .where(triples(v.person, n.foaf.age, v.age));
 * ```
 *
 * ```sparql
 * SELECT ( ABS( ( ?age - "30"^^<http://www.w3.org/2001/XMLSchema#integer> ) ) AS ?distance ) WHERE {
 *   ?person foaf:age ?age .
 * }
 * ```
 */
export function abs(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('abs', args, transformNumber);
}

/**
 * Returns a number rounded to the nearest integer (`ROUND`).
 *
 * @param args - `[value]`: The numeric expression to evaluate.
 *
 * @example
 * Select each book’s price using ROUND.
 *
 * ```ts
 * db.select({ result: as(round(v.price), v.result) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( ROUND( ?price ) AS ?result ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function round(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('round', args, transformNumber);
}

/**
 * Returns the smallest integer greater than or equal to a number (`CEIL`).
 *
 * @param args - `[value]`: The numeric expression to evaluate.
 *
 * @example
 * Select each book’s price using CEIL.
 *
 * ```ts
 * db.select({ result: as(ceil(v.price), v.result) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( CEIL( ?price ) AS ?result ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function ceil(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('ceil', args, transformNumber);
}

/**
 * Returns the largest integer less than or equal to a number (`FLOOR`).
 *
 * @param args - `[value]`: The numeric expression to evaluate.
 *
 * @example
 * Select each book’s price using FLOOR.
 *
 * ```ts
 * db.select({ result: as(floor(v.price), v.result) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( FLOOR( ?price ) AS ?result ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function floor(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('floor', args, transformNumber);
}

/**
 * Returns a random number between zero and one (`RAND`).
 *
 * @example
 * Order people randomly.
 *
 * ```ts
 * db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name))
 *   .orderBy(rand());
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ORDER BY ASC ( RAND( ) )
 * ```
 */
export function rand(): ExpressionOperationInput<number> {
  return createOperationExpression('rand', [], transformNumber);
}

// FUNCTIONS ON DATES AND TIMES

/**
 * Returns the current date and time (`NOW`).
 *
 * The value is constant within a query and is returned as a JavaScript `Date`.
 *
 * @example
 * Select the current time for each book.
 *
 * ```ts
 * db.select({ current: as(now(), v.current) })
 *   .where(triples(v.book, n.schema.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( NOW( ) AS ?current ) WHERE {
 *   ?book schema:name ?name .
 * }
 * ```
 */
export function now(): ExpressionOperationInput<Date> {
  return createOperationExpression('now', [], transformDate);
}

/**
 * Returns the year component of a date-time (`YEAR`).
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the year of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(year(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( YEAR( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function year(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('year', args, transformNumber);
}

/**
 * Returns the month component of a date-time (`MONTH`).
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the month of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(month(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( MONTH( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function month(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('month', args, transformNumber);
}

/**
 * Returns the day component of a date-time (`DAY`).
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the day of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(day(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( DAY( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function day(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('day', args, transformNumber);
}

/**
 * Returns the hours component of a date-time (`HOURS`).
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the hours of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(hours(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( HOURS( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function hours(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('hours', args, transformNumber);
}

/**
 * Returns the minutes component of a date-time (`MINUTES`).
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the minutes of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(minutes(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( MINUTES( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function minutes(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('minutes', args, transformNumber);
}

/**
 * Returns the seconds component of a date-time (`SECONDS`).
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the seconds of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(seconds(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( SECONDS( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function seconds(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('seconds', args, transformNumber);
}

/**
 * Returns the timezone offset of a date-time (`TIMEZONE`).
 *
 * The result is an `xsd:dayTimeDuration` literal; a missing timezone raises a SPARQL error.
 * The TypeScript result is a `TermLiteralOutput`.
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the timezone of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(timezone(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( TIMEZONE( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function timezone(...args: [ExpressionInput]): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('timezone', args, transformLiteral);
}

/**
 * Returns the timezone designator of a date-time (`TZ`).
 *
 * The result is a string literal, empty when the timezone is absent.
 * The TypeScript result is a `TermLiteralOutput`.
 *
 * @param args - `[value]`: The `xsd:dateTime` to read.
 *
 * @example
 * Select the tz of each book’s publication date-time.
 *
 * ```ts
 * db.select({ result: as(tz(v.published), v.result) })
 *   .where(triples(v.book, n.schema.datePublished, v.published));
 * ```
 *
 * ```sparql
 * SELECT ( TZ( ?published ) AS ?result ) WHERE {
 *   ?book schema:datePublished ?published .
 * }
 * ```
 */
export function tz(...args: [ExpressionInput]): ExpressionOperationInput<TermLiteralOutput> {
  return createOperationExpression('tz', args, transformLiteral);
}

// HASH FUNCTIONS

/**
 * Returns the MD5 hex digest of a string (`MD5`).
 *
 * The input must be a simple literal; use {@link str} to convert an IRI.
 *
 * @param args - `[value]`: The string literal to hash.
 *
 * @example
 * Hash each mailbox IRI with MD5.
 *
 * ```ts
 * db.select({ result: as(md5(str(v.mbox)), v.result) })
 *   .where(triples(v.person, n.foaf.mbox, v.mbox));
 * ```
 *
 * ```sparql
 * SELECT ( MD5( STR( ?mbox ) ) AS ?result ) WHERE {
 *   ?person foaf:mbox ?mbox .
 * }
 * ```
 */
export function md5(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('md5', args, transformString);
}

/**
 * Returns the SHA-1 hex digest of a string (`SHA1`).
 *
 * The input must be a simple literal; use {@link str} to convert an IRI.
 *
 * @param args - `[value]`: The string literal to hash.
 *
 * @example
 * Hash each mailbox IRI with SHA-1.
 *
 * ```ts
 * db.select({ result: as(sha1(str(v.mbox)), v.result) })
 *   .where(triples(v.person, n.foaf.mbox, v.mbox));
 * ```
 *
 * ```sparql
 * SELECT ( SHA1( STR( ?mbox ) ) AS ?result ) WHERE {
 *   ?person foaf:mbox ?mbox .
 * }
 * ```
 */
export function sha1(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha1', args, transformString);
}

/**
 * Returns the SHA-256 hex digest of a string (`SHA256`).
 *
 * The input must be a simple literal; use {@link str} to convert an IRI.
 *
 * @param args - `[value]`: The string literal to hash.
 *
 * @example
 * Hash each mailbox IRI with SHA-256.
 *
 * ```ts
 * db.select({ result: as(sha256(str(v.mbox)), v.result) })
 *   .where(triples(v.person, n.foaf.mbox, v.mbox));
 * ```
 *
 * ```sparql
 * SELECT ( SHA256( STR( ?mbox ) ) AS ?result ) WHERE {
 *   ?person foaf:mbox ?mbox .
 * }
 * ```
 */
export function sha256(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha256', args, transformString);
}

/**
 * Returns the SHA-384 hex digest of a string (`SHA384`).
 *
 * The input must be a simple literal; use {@link str} to convert an IRI.
 *
 * @param args - `[value]`: The string literal to hash.
 *
 * @example
 * Hash each mailbox IRI with SHA-384.
 *
 * ```ts
 * db.select({ result: as(sha384(str(v.mbox)), v.result) })
 *   .where(triples(v.person, n.foaf.mbox, v.mbox));
 * ```
 *
 * ```sparql
 * SELECT ( SHA384( STR( ?mbox ) ) AS ?result ) WHERE {
 *   ?person foaf:mbox ?mbox .
 * }
 * ```
 */
export function sha384(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha384', args, transformString);
}

/**
 * Returns the SHA-512 hex digest of a string (`SHA512`).
 *
 * The input must be a simple literal; use {@link str} to convert an IRI.
 *
 * @param args - `[value]`: The string literal to hash.
 *
 * @example
 * Hash each mailbox IRI with SHA-512.
 *
 * ```ts
 * db.select({ result: as(sha512(str(v.mbox)), v.result) })
 *   .where(triples(v.person, n.foaf.mbox, v.mbox));
 * ```
 *
 * ```sparql
 * SELECT ( SHA512( STR( ?mbox ) ) AS ?result ) WHERE {
 *   ?person foaf:mbox ?mbox .
 * }
 * ```
 */
export function sha512(...args: [ExpressionInput]): ExpressionOperationInput<string> {
  return createOperationExpression('sha512', args, transformString);
}
