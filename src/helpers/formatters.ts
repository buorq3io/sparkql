import type * as AST from '@traqula/rules-sparql-1-1';
import { Placeholder } from '../database/prepared.js';
import { tripleNesting } from '../structures/expression.js';
import type { Formatter } from './generators.js';
import type {
  FactoryFunctions,
  GraphNodeInput,
  TripleCollectionBlankNodePropertiesInputBase,
  TripleCollectionBlankNodePropertiesInputSyntax,
  TripleCollectionListInputBase,
  TripleCollectionListInputSyntax,
  TripleNestingInput,
} from './types.js';
import { isObjectLike, term, termGraph } from './utilities.js';

/**
 * Tests whether a value can be the subject or object of a triple.
 *
 * Accepts terms, values with a built-in input format (strings, numbers, `URL`, `[]`, ...),
 * placeholders, and triple collections in AST or tuple syntax. Custom `formats` of a database
 * are not considered.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Check candidate triple objects.
 *
 * ```ts
 * isGraphNodeInput('Ada'); // true: becomes the literal "Ada"
 * isGraphNodeInput(v.name); // true
 * isGraphNodeInput({ name: 'Ada' }); // false: no input format matches a plain object
 * ```
 */
export function isGraphNodeInput(value: unknown): value is GraphNodeInput {
  return (
    value instanceof Placeholder ||
    (isObjectLike(value) && value.type === 'tripleCollection') ||
    isTripleCollectionListInputSyntax(value) ||
    isTripleCollectionBlankNodePropertiesInputSyntax(value) ||
    term.accepts(value)
  );
}

/**
 * Tests for `[[a, b, ...]]`, the tuple syntax of an RDF list: one array wrapping an array of
 * graph nodes.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell list syntax from a plain array.
 *
 * ```ts
 * isTripleCollectionListInputSyntax([['en', 'fr']]); // true
 * isTripleCollectionListInputSyntax(['en', 'fr']); // false
 * ```
 */
export function isTripleCollectionListInputSyntax(
  value: unknown
): value is TripleCollectionListInputSyntax {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    Array.isArray(value[0]) &&
    value[0].every((v: any) => isGraphNodeInput(v))
  );
}

/**
 * Converts `[[a, b, ...]]` list syntax into a list triple collection.
 *
 * The collection holds `rdf:first`/`rdf:rest` triples over fresh blank nodes, ending in
 * `rdf:nil`, and the generator writes it as a SPARQL collection `( a b ... )`. Triple
 * builders call it for you when they receive list syntax.
 *
 * @param value - The list syntax to convert.
 * @param factory - Term factories, as passed to a formatter's `format`.
 *
 * @example
 * Give a book's languages as an RDF list.
 *
 * ```ts
 * db.select({ book: v.book }).where(triples(v.book, n.schema.inLanguage, [['en', 'fr']]));
 * ```
 *
 * ```sparql
 * SELECT ?book WHERE {
 *   ?book schema:inLanguage ( "en" "fr" ) .
 * }
 * ```
 */
export function formatTripleCollectionListInputSyntax(
  value: TripleCollectionListInputSyntax,
  factory: FactoryFunctions
): TripleCollectionListInputBase {
  const nodes = value[0];
  const tripleNestings: TripleNestingInput[] = [];

  const id = factory.blank();
  let prev: AST.TermBlank | AST.TermIriFull = id;
  for (const [index, node] of nodes.entries()) {
    tripleNestings.push(
      tripleNesting(prev, factory.iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'), node)
    );
    const next =
      index === nodes.length - 1
        ? factory.iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')
        : factory.blank();
    tripleNestings.push(
      tripleNesting(prev, new URL('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'), next)
    );
    prev = next;
  }

  return {
    type: 'tripleCollection',
    subType: 'list',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    identifier: id,
    triples: tripleNestings,
  };
}

/**
 * Tests for the tuple syntax of a blank node property list: `[predicate, object]`, or a
 * one-element array holding a predicate-pair collection.
 *
 * @param value - The value to inspect.
 *
 * @example
 * Tell property list syntax from other arrays.
 *
 * ```ts
 * isTripleCollectionBlankNodePropertiesInputSyntax([n.foaf.name, 'Ada']); // true
 * isTripleCollectionBlankNodePropertiesInputSyntax(['Ada']); // false
 * ```
 */
export function isTripleCollectionBlankNodePropertiesInputSyntax(
  value: unknown
): value is TripleCollectionBlankNodePropertiesInputSyntax {
  return (
    Array.isArray(value) &&
    ((value.length === 1 &&
      isObjectLike(value[0]) &&
      value[0].subType === 'predicatePairCollection') ||
      (value.length === 2 &&
        (termGraph.accepts(value[0]) || value[0].type === 'path') &&
        ((isObjectLike(value[1]) && value[1].subType === 'objectCollection') ||
          isGraphNodeInput(value[1]))))
  );
}

/**
 * Converts blank node property list syntax into a blank node properties triple collection.
 *
 * Each pair becomes a triple whose subject is one fresh blank node, and the generator writes
 * the collection as `[ predicate object ; ... ]`. An object collection expands to one triple
 * per object. Triple builders call it for you when they receive this syntax.
 *
 * @param value - The property list syntax to convert.
 * @param factory - Term factories, as passed to a formatter's `format`.
 *
 * @example
 * Find the names of book authors through an anonymous author node.
 *
 * ```ts
 * db.select({ name: v.name }).where(triples(v.book, n.schema.author, [n.foaf.name, v.name]));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?book schema:author [
 *     foaf:name ?name ;
 *   ] .
 * }
 * ```
 */
export function formatTripleCollectionBlankNodePropertiesInputSyntax(
  value: TripleCollectionBlankNodePropertiesInputSyntax,
  factory: FactoryFunctions
): TripleCollectionBlankNodePropertiesInputBase {
  const source = factory.blank();

  if (isObjectLike(value[0]) && value[0].subType === 'predicatePairCollection') {
    const items = value[0].values.flatMap(v => {
      if (isObjectLike(v[1]) && v[1].subType === 'objectCollection') {
        return v[1].values.map(o => {
          return tripleNesting(source, v[0], o);
        });
      }
      return tripleNesting(source, v[0], v[1]);
    });

    return {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      identifier: source,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      triples: items,
    };
  }

  if (isObjectLike(value[1]) && value[1].subType === 'objectCollection') {
    const items = value[1].values.map(o => {
      return tripleNesting(source, value[0] as any, o); // fix
    });

    return {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      identifier: source,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      triples: items,
    };
  }

  return {
    type: 'tripleCollection',
    subType: 'blankNodeProperties',
    identifier: source,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    triples: [tripleNesting(source, value[0], value[1] as any)],
  };
}

/**
 * Creates the formatter that turns `[[a, b, ...]]` list syntax into a list triple collection.
 *
 * Pairs {@link isTripleCollectionListInputSyntax} with
 * {@link formatTripleCollectionListInputSyntax}.
 *
 * @example
 * Check whether a value is list syntax before formatting it.
 *
 * ```ts
 * const formatter = createTripleCollectionListInputSyntaxFormatter();
 * formatter.test([['en', 'fr']]); // true
 * ```
 */
export function createTripleCollectionListInputSyntaxFormatter(): Formatter<
  TripleCollectionListInputSyntax,
  TripleCollectionListInputBase
> {
  return {
    format: formatTripleCollectionListInputSyntax,
    test: isTripleCollectionListInputSyntax,
  };
}

/**
 * Creates the formatter that turns blank node property list syntax into a triple collection.
 *
 * Pairs {@link isTripleCollectionBlankNodePropertiesInputSyntax} with
 * {@link formatTripleCollectionBlankNodePropertiesInputSyntax}.
 *
 * @example
 * Check whether a value is property list syntax before formatting it.
 *
 * ```ts
 * const formatter = createTripleCollectionBlankNodePropertiesInputSyntaxFormatter();
 * formatter.test([n.foaf.name, 'Ada']); // true
 * ```
 */
export function createTripleCollectionBlankNodePropertiesInputSyntaxFormatter(): Formatter<
  TripleCollectionBlankNodePropertiesInputSyntax,
  TripleCollectionBlankNodePropertiesInputBase
> {
  return {
    format: formatTripleCollectionBlankNodePropertiesInputSyntax,
    test: isTripleCollectionBlankNodePropertiesInputSyntax,
  };
}
