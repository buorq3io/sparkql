import type * as AST from '@traqula/rules-sparql-1-1';
import { triples } from '../structures/expression.js';
import { service } from '../structures/pattern.js';
import {
  checkVariable,
  fail,
  nested,
  type Pair,
  type QleverPatternInput,
  qleverPattern,
} from './types.js';

/** The namespace of QLever's built-in functions and predicates, written `ql:`. */
export const QL_NAMESPACE = 'http://qlever.cs.uni-freiburg.de/builtin-functions/';
/** The `textSearch:` service and its vocabulary. */
export const TEXT_SEARCH_NAMESPACE = 'https://qlever.cs.uni-freiburg.de/textSearch/';

const ql = (name: string) => new URL(`${QL_NAMESPACE}${name}`);
const ts = (name: string) => new URL(`${TEXT_SEARCH_NAMESPACE}${name}`);

/** An entity to find in text records: a variable, an IRI, or a literal string. */
export type TextEntity = AST.TermVariable | AST.TermIri | URL | string;

/** A word search of {@link textSearch}. */
export interface TextWordSearch {
  /** One word, or a prefix ending in `*` such as `'light*'`. */
  readonly word: string;
  /** Variable that receives the score of the match. */
  readonly score?: AST.TermVariable;
  /** Variable that receives the word a prefix matched. Only with a prefix. */
  readonly prefixMatch?: AST.TermVariable;
}

/** An entity search of {@link textSearch}. */
export interface TextEntitySearch {
  /** The entity, or a variable that receives the entities in the matching records. */
  readonly entity: TextEntity;
  /** Variable that receives the score of the match. */
  readonly score?: AST.TermVariable;
}

const feature = 'text search';

/**
 * Matches text records that contain words (`ql:contains-word`).
 *
 * Prints `?text ql:contains-word "words"` with the predicate as a full IRI. All words must occur
 * in the record; a word ending in `*` matches as a prefix. QLever only evaluates it on a server
 * started with a text index; the variable is bound to the text record. Combine it with
 * {@link containsEntity} to find the entities mentioned in those records. Only databases created
 * from `sparkql/qlever` accept it. See [Text search](https://docs.qlever.dev/text-search/).
 *
 * @param text - Variable for the text record.
 * @param words - Words separated by spaces, such as `'moon walk*'`.
 * @throws {@link SparkqlError} When `text` is not a variable or `words` is empty.
 *
 * @example
 * Find the entities mentioned in records about lighthouses.
 *
 * ```ts
 * import { SparqlDatabase, containsEntity, containsWord } from 'sparkql/qlever';
 *
 * const db = SparqlDatabase.create();
 * const [text, entity] = [db.variable('text'), db.variable('entity')];
 *
 * db.select({ entity }).where(containsWord(text, 'lighthouse*'), containsEntity(text, entity));
 * ```
 *
 * ```sparql
 * SELECT ?entity WHERE {
 *   ?text <http://qlever.cs.uni-freiburg.de/builtin-functions/contains-word> "lighthouse*" .
 *   ?text <http://qlever.cs.uni-freiburg.de/builtin-functions/contains-entity> ?entity .
 * }
 * ```
 */
export function containsWord(text: AST.TermVariable, words: string): QleverPatternInput {
  checkVariable(feature, 'text', text, true);
  if (typeof words !== 'string' || words.trim() === '')
    fail(feature, 'the words must not be empty.');
  return qleverPattern('qleverContainsWord', triples(text, ql('contains-word'), words));
}

/**
 * Matches text records that mention an entity (`ql:contains-entity`).
 *
 * See {@link containsWord}; QLever needs a word search on the same text variable.
 *
 * @param text - Variable for the text record.
 * @param entity - The entity, or a variable that receives each entity the record mentions.
 * @throws {@link SparkqlError} When `text` is not a variable.
 *
 * @example
 * Check which records about rivers mention Alice.
 *
 * ```ts
 * import { SparqlDatabase, containsEntity, containsWord } from 'sparkql/qlever';
 *
 * const db = SparqlDatabase.create();
 * const text = db.variable('text');
 *
 * db.select({ text }).where(
 *   containsWord(text, 'rivers'),
 *   containsEntity(text, new URL('https://example.org/alice'))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?text WHERE {
 *   ?text <http://qlever.cs.uni-freiburg.de/builtin-functions/contains-word> "rivers" .
 *   ?text <http://qlever.cs.uni-freiburg.de/builtin-functions/contains-entity> <https://example.org/alice> .
 * }
 * ```
 */
export function containsEntity(text: AST.TermVariable, entity: TextEntity): QleverPatternInput {
  checkVariable(feature, 'text', text, true);
  return qleverPattern('qleverContainsEntity', triples(text, ql('contains-entity'), entity));
}

function searchPairs(search: TextWordSearch | TextEntitySearch): Pair[] {
  if (typeof search !== 'object' || search === null)
    fail(feature, 'each search must be an object.');
  const isWord = 'word' in search && search.word !== undefined;
  const isEntity = 'entity' in search && search.entity !== undefined;
  if (isWord === isEntity) fail(feature, 'each search takes exactly one of `word` and `entity`.');
  checkVariable(feature, 'score', search.score);
  const pairs: Pair[] = [];
  if (isWord) {
    const { word, prefixMatch } = search as TextWordSearch;
    if (typeof word !== 'string' || word === '' || /\s/.test(word)) {
      fail(feature, '`word` must be one word; search for several words with several searches.');
    }
    checkVariable(feature, 'prefixMatch', prefixMatch);
    if (prefixMatch !== undefined && !word.endsWith('*')) {
      fail(feature, '`prefixMatch` needs a prefix: a word ending in `*`.');
    }
    pairs.push([ts('word'), word]);
    if (prefixMatch !== undefined) pairs.push([ts('prefix-match'), prefixMatch]);
  } else {
    pairs.push([ts('entity'), (search as TextEntitySearch).entity]);
  }
  if (search.score !== undefined) pairs.push([ts('score'), search.score]);
  return pairs;
}

/**
 * Searches QLever's text index with the `textSearch:` service, which adds scores and prefix
 * completions to {@link containsWord}.
 *
 * Prints `SERVICE textSearch: { ?text textSearch:contains [ ... ] . ... }` with one
 * configuration per search. A word search matches one word, or a prefix ending in `*` whose
 * completion `prefixMatch` receives; an entity search finds the entities the matching records
 * mention. Each search can bind its own `score`. QLever needs a text index, and at least one word
 * search with any entity search. Only databases created from `sparkql/qlever` accept it. See
 * [Text search](https://docs.qlever.dev/text-search/).
 *
 * @param text - Variable for the text record that all searches share.
 * @param searches - Word and entity searches, at least one word search.
 * @throws {@link SparkqlError} When a search has both or neither of `word` and `entity`, a word
 * holds spaces, `prefixMatch` is given without a prefix, or there is no word search.
 *
 * @example
 * Complete the prefix "light" and score each record.
 *
 * ```ts
 * import { SparqlDatabase, textSearch } from 'sparkql/qlever';
 *
 * const db = SparqlDatabase.create();
 * const [text, score, completion] = ['text', 'score', 'completion'].map(name => db.variable(name));
 *
 * db.select({ completion, score }).where(
 *   textSearch(text, { word: 'light*', score, prefixMatch: completion })
 * );
 * ```
 *
 * ```sparql
 * SELECT ?completion ?score WHERE {
 *   SERVICE <https://qlever.cs.uni-freiburg.de/textSearch/> {
 *     ?text <https://qlever.cs.uni-freiburg.de/textSearch/contains> [
 *       <https://qlever.cs.uni-freiburg.de/textSearch/word> "light*" ;
 *       <https://qlever.cs.uni-freiburg.de/textSearch/prefix-match> ?completion ;
 *       <https://qlever.cs.uni-freiburg.de/textSearch/score> ?score ;
 *     ] .
 *   }
 * }
 * ```
 */
export function textSearch(
  text: AST.TermVariable,
  ...searches: (TextWordSearch | TextEntitySearch)[]
): QleverPatternInput {
  checkVariable(feature, 'text', text, true);
  if (searches.length === 0) fail(feature, 'give at least one search.');
  const configurations = searches.map(searchPairs);
  if (!searches.some(search => 'word' in search && search.word !== undefined)) {
    fail(feature, 'an entity search needs a word search on the same text.');
  }
  return qleverPattern(
    'qleverTextSearch',
    service(ts(''), ...configurations.map(pairs => triples(text, ts('contains'), nested(pairs))))
  );
}
