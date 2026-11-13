import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExtensionPattern } from '../database/dialect.js';
import { SparkqlError } from '../database/errors.js';
import type { ObjectInput, PredicateInput } from '../helpers/types.js';
import { predicates, triples } from '../structures/expression.js';

/** The namespace of the LuceneSail search vocabulary, written `search:` in RDF4J's docs. */
export const LUCENE_NAMESPACE = 'http://www.openrdf.org/contrib/lucenesail#';

const loc = { sourceLocationType: 'autoGenerate' } as const;
const term = (name: string) => new URL(`${LUCENE_NAMESPACE}${name}`);

/** A property to search: an IRI, or a variable that receives the property that matched. */
export type TextSearchProperty = AST.TermIri | URL | AST.TermVariable;

/** One part of a combined search: its own query, property, boost and snippet. */
export interface TextSearchClause {
  /** Lucene query for this part, such as `'light*'`. */
  readonly query: string;
  /** Property to search. Without it, every indexed property is searched. */
  readonly property?: TextSearchProperty;
  /** Weight of this part in the score, a positive number. */
  readonly boost?: number;
  /** Variable that receives the matching text of this part, with hits in `<B>` tags. */
  readonly snippet?: AST.TermVariable;
}

/** Options of a single-query {@link textSearch}. */
export interface TextSearchOptions {
  /** Property to search. Without it, every indexed property is searched. */
  readonly property?: TextSearchProperty;
  /** Variable that receives the match score. */
  readonly score?: AST.TermVariable;
  /** Variable that receives the matching text, with hits in `<B>` tags. */
  readonly snippet?: AST.TermVariable;
  /** Returns at most this many matches, a positive integer. */
  readonly numDocs?: number;
}

/** Options of a combined {@link textSearch}: properties and snippets go in each clause. */
export interface CombinedTextSearchOptions {
  /** Variable that receives the combined match score. */
  readonly score?: AST.TermVariable;
  /** Returns at most this many matches, a positive integer. */
  readonly numDocs?: number;
}

/** Input for an RDF4J full-text search, as returned by {@link textSearch}. */
export interface TextSearchInput extends ExtensionPattern {
  /** Identifies the node as an RDF4J full-text search. */
  subType: 'rdf4jTextSearch';
  /** The resource that matches: a variable, or an IRI to test. */
  subject: AST.TermVariable | AST.TermIri | URL;
  /** The Lucene query, or the clauses of a combined search. */
  query: string | readonly TextSearchClause[];
  /** Search options. */
  options: TextSearchOptions;
}

/** @internal Returns whether a value is an RDF4J full-text search input. */
export function isTextSearch(value: unknown): value is TextSearchInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'pattern' &&
    'subType' in value &&
    value.subType === 'rdf4jTextSearch'
  );
}

function fail(message: string): never {
  throw new SparkqlError({ message: `RDF4J text search: ${message}` });
}

function checkQuery(query: unknown): asserts query is string {
  if (typeof query !== 'string' || query.trim() === '')
    fail('the query must be a non-empty string.');
}

function checkVariable(name: string, value: unknown): void {
  if (value === undefined) return;
  if (
    typeof value !== 'object' ||
    value === null ||
    !('subType' in value) ||
    value.subType !== 'variable'
  ) {
    fail(`\`${name}\` must be a variable.`);
  }
}

/**
 * Searches RDF4J's Lucene full-text index for resources whose literals match a query.
 *
 * Prints `subject search:matches [ search:query "..." ; ... ]` with the LuceneSail vocabulary
 * written as full IRIs. The query uses Lucene syntax: words, `*` wildcards, `OR`, quoted
 * phrases. `property` limits the search to one property, or binds the property that matched
 * when it is a variable; `score` and `snippet` receive the score and the matching text. RDF4J
 * only evaluates the search on a repository that wraps its store in a LuceneSail; on other
 * stores the pattern matches nothing, so only databases created from `sparkql/rdf4j` accept it.
 * See [Full-text indexing with the Lucene SAIL](https://rdf4j.org/documentation/programming/lucene/).
 *
 * Pass an array of clauses instead of one query to combine searches over several properties,
 * each with its own boost and snippet; the score is then the combined score.
 *
 * @param subject - The resource that matches: a variable, or an IRI to test.
 * @param query - The Lucene query. RDF4J needs it as a literal; a variable is not accepted.
 * @param options - Property, score, snippet and result limit.
 * @throws {@link SparkqlError} When the query is empty, `score` or `snippet` is not a variable,
 * or `numDocs` is not a positive integer.
 *
 * @example
 * Find books whose label starts with "light", with the score and the matching text.
 *
 * ```ts
 * import { SparqlDatabase, textSearch } from 'sparkql/rdf4j';
 *
 * const prefixes = { rdfs: { uri: 'http://www.w3.org/2000/01/rdf-schema#', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * db.select({ book: v.book, score: v.score, text: v.text }).where(
 *   textSearch(v.book, 'light*', { property: n.rdfs.label, score: v.score, snippet: v.text })
 * );
 * ```
 *
 * ```sparql
 * SELECT ?book ?score ?text WHERE {
 *   ?book <http://www.openrdf.org/contrib/lucenesail#matches> [
 *     <http://www.openrdf.org/contrib/lucenesail#query> "light*" ;
 *     <http://www.openrdf.org/contrib/lucenesail#property> rdfs:label ;
 *     <http://www.openrdf.org/contrib/lucenesail#snippet> ?text ;
 *     <http://www.openrdf.org/contrib/lucenesail#score> ?score ;
 *   ] .
 * }
 * ```
 */
export function textSearch(
  subject: AST.TermVariable | AST.TermIri | URL,
  query: string,
  options?: TextSearchOptions
): TextSearchInput;
/**
 * Combines several full-text searches, each over its own property and with its own boost.
 *
 * See the first overload for details. Only the Lucene index supports combined searches, not the
 * Elasticsearch or Solr ones.
 *
 * @param subject - The resource that matches: a variable, or an IRI to test.
 * @param clauses - The searches to combine, at least one.
 * @param options - Combined score and result limit.
 *
 * @example
 * Weigh a match in the name above a match in the description.
 *
 * ```ts
 * import { SparqlDatabase, textSearch } from 'sparkql/rdf4j';
 *
 * const prefixes = { schema: { uri: 'https://schema.org/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * db.select({ item: v.item, score: v.score }).where(
 *   textSearch(
 *     v.item,
 *     [
 *       { query: 'lighthouse', property: n.schema.name, boost: 0.8 },
 *       { query: 'lighthouse', property: n.schema.description, boost: 0.2 },
 *     ],
 *     { score: v.score }
 *   )
 * );
 * ```
 *
 * ```sparql
 * SELECT ?item ?score WHERE {
 *   ?item <http://www.openrdf.org/contrib/lucenesail#matches> [
 *     <http://www.openrdf.org/contrib/lucenesail#query> [
 *       <http://www.openrdf.org/contrib/lucenesail#query> "lighthouse" ;
 *       <http://www.openrdf.org/contrib/lucenesail#property> schema:name ;
 *       <http://www.openrdf.org/contrib/lucenesail#boost> "0.8"^^<http://www.w3.org/2001/XMLSchema#decimal> ;
 *     ] ;
 *     <http://www.openrdf.org/contrib/lucenesail#query> [
 *       <http://www.openrdf.org/contrib/lucenesail#query> "lighthouse" ;
 *       <http://www.openrdf.org/contrib/lucenesail#property> schema:description ;
 *       <http://www.openrdf.org/contrib/lucenesail#boost> "0.2"^^<http://www.w3.org/2001/XMLSchema#decimal> ;
 *     ] ;
 *     <http://www.openrdf.org/contrib/lucenesail#score> ?score ;
 *   ] .
 * }
 * ```
 */
export function textSearch(
  subject: AST.TermVariable | AST.TermIri | URL,
  clauses: readonly TextSearchClause[],
  options?: CombinedTextSearchOptions
): TextSearchInput;
export function textSearch(
  subject: AST.TermVariable | AST.TermIri | URL,
  query: string | readonly TextSearchClause[],
  options: TextSearchOptions = {}
): TextSearchInput {
  if (Array.isArray(query)) {
    if (query.length === 0) fail('a combined search needs at least one clause.');
    for (const clause of query) {
      checkQuery(clause?.query);
      checkVariable('snippet', clause.snippet);
      if (
        clause.boost !== undefined &&
        (typeof clause.boost !== 'number' || !Number.isFinite(clause.boost) || clause.boost <= 0)
      ) {
        fail('`boost` must be a positive number.');
      }
    }
    if (options.property !== undefined || options.snippet !== undefined) {
      fail('a combined search takes `property` and `snippet` in each clause.');
    }
  } else {
    checkQuery(query);
    checkVariable('snippet', options.snippet);
  }
  checkVariable('score', options.score);
  const { numDocs } = options;
  if (numDocs !== undefined && (!Number.isSafeInteger(numDocs) || numDocs < 1)) {
    fail('`numDocs` must be a positive integer.');
  }
  return {
    type: 'pattern',
    subType: 'rdf4jTextSearch',
    loc,
    subject,
    query: Array.isArray(query) ? query.map(clause => ({ ...clause })) : query,
    options: { ...options },
  };
}

type Pair = [PredicateInput, ObjectInput];

function clausePairs(query: string, clause: Omit<TextSearchClause, 'query'>): Pair[] {
  const pairs: Pair[] = [[term('query'), query]];
  if (clause.property !== undefined) pairs.push([term('property'), clause.property]);
  if (clause.boost !== undefined) pairs.push([term('boost'), clause.boost]);
  if (clause.snippet !== undefined) pairs.push([term('snippet'), clause.snippet]);
  return pairs;
}

/** @internal The triples a full-text search stands for, as a blank node property list. */
export function textSearchTriples(input: TextSearchInput) {
  const { query, options } = input;
  const pairs: Pair[] =
    typeof query === 'string'
      ? clausePairs(query, options)
      : query.map(
          ({ query: text, ...clause }): Pair => [
            term('query'),
            [predicates(...clausePairs(text, clause))] as unknown as ObjectInput,
          ]
        );
  if (options.score !== undefined) pairs.push([term('score'), options.score]);
  if (options.numDocs !== undefined) pairs.push([term('numDocs'), options.numDocs]);
  return triples(input.subject, term('matches'), [predicates(...pairs)] as unknown as ObjectInput);
}
