import type * as AST from '@traqula/rules-sparql-1-1';
import type { PatternInput } from '../helpers/types.js';
import { group, service } from '../structures/pattern.js';
import {
  checkInteger,
  checkVariable,
  configuration,
  fail,
  type Pair,
  type QleverPatternInput,
  qleverPattern,
} from './types.js';

/** The `pathSearch:` service and its vocabulary. */
export const PATH_SEARCH_NAMESPACE = 'https://qlever.cs.uni-freiburg.de/pathSearch/';

const ps = (name: string) => new URL(`${PATH_SEARCH_NAMESPACE}${name}`);

/** A node a path starts or ends at: an IRI, or a variable bound before the search. */
export type PathNode = AST.TermIri | URL | AST.TermVariable;

/** Options of {@link pathSearch}. */
export interface PathSearchOptions {
  /** Where paths start: one node or several. */
  readonly source: PathNode | readonly PathNode[];
  /** Where paths end: one node or several. Without it, paths to every reachable node. */
  readonly target?: PathNode | readonly PathNode[];
  /** The variable the edge pattern uses for an edge's start. */
  readonly start: AST.TermVariable;
  /** The variable the edge pattern uses for an edge's end. */
  readonly end: AST.TermVariable;
  /** Variable that receives the number of the path each edge belongs to, from 0. */
  readonly path: AST.TermVariable;
  /** Variable that receives the position of each edge on its path, from 0. */
  readonly edge: AST.TermVariable;
  /** Further variables of the edge pattern to return with each edge, such as an edge's label. */
  readonly edgeProperties?: readonly AST.TermVariable[];
  /**
   * With several sources and targets, `true` (the default) searches from every source to every
   * target; `false` pairs them by position.
   */
  readonly cartesian?: boolean;
  /** Stops after this many paths to each target. */
  readonly numPathsPerTarget?: number;
  /** Follows at most this many edges from the source. */
  readonly maxDepth?: number;
}

const feature = 'path search';
const list = <T>(value: T | readonly T[] | undefined): readonly T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value as T];

/**
 * Finds every path between nodes with QLever's `pathSearch:` service, returning one row per
 * edge of each path.
 *
 * Prints `SERVICE pathSearch: { [ pathSearch:algorithm pathSearch:allPaths ; ... ] . { edges } }`.
 * The edge patterns give the graph: they must bind `start` and `end` for each edge, for example
 * `triples(start, n.foaf.knows, end)`. Each result row is one edge, with `path` numbering the
 * path and `edge` the edge's position on it. Unlike a property path, the search returns the paths
 * themselves, not just the reachable nodes. Only databases created from `sparkql/qlever` accept
 * it. See [Path search](https://docs.qlever.dev/path-search/).
 *
 * @param options - Sources, targets, the result variables and limits.
 * @param edges - Graph patterns that bind `start` and `end` for each edge.
 * @throws {@link SparkqlError} When a result variable is missing, `start` and `end` are the
 * same variable, there is no source or edge pattern, or a limit is not a valid integer.
 *
 * @example
 * List every chain of acquaintances from Alice to Dave.
 *
 * ```ts
 * import { SparqlDatabase, pathSearch, triples } from 'sparkql/qlever';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * db.select({ path: v.path, edge: v.edge, start: v.start, end: v.end })
 *   .where(
 *     pathSearch(
 *       {
 *         source: new URL('https://example.org/alice'),
 *         target: new URL('https://example.org/dave'),
 *         start: v.start,
 *         end: v.end,
 *         path: v.path,
 *         edge: v.edge,
 *       },
 *       triples(v.start, n.foaf.knows, v.end)
 *     )
 *   )
 *   .orderBy(v.path, v.edge);
 * ```
 *
 * ```sparql
 * SELECT ?path ?edge ?start ?end WHERE {
 *   SERVICE <https://qlever.cs.uni-freiburg.de/pathSearch/> {
 *     [
 *       <https://qlever.cs.uni-freiburg.de/pathSearch/algorithm> <https://qlever.cs.uni-freiburg.de/pathSearch/allPaths> ;
 *       <https://qlever.cs.uni-freiburg.de/pathSearch/source> <https://example.org/alice> ;
 *       <https://qlever.cs.uni-freiburg.de/pathSearch/target> <https://example.org/dave> ;
 *       <https://qlever.cs.uni-freiburg.de/pathSearch/start> ?start ;
 *       <https://qlever.cs.uni-freiburg.de/pathSearch/end> ?end ;
 *       <https://qlever.cs.uni-freiburg.de/pathSearch/pathColumn> ?path ;
 *       <https://qlever.cs.uni-freiburg.de/pathSearch/edgeColumn> ?edge ;
 *     ] .
 *     {
 *       ?start foaf:knows ?end .
 *     }
 *   }
 * }
 * ORDER BY ASC ( ?path ) ASC ( ?edge )
 * ```
 */
export function pathSearch(
  options: PathSearchOptions,
  ...edges: PatternInput<QleverPatternInput>[]
): QleverPatternInput {
  if (typeof options !== 'object' || options === null) fail(feature, 'options are required.');
  for (const name of ['start', 'end', 'path', 'edge'] as const) {
    checkVariable(feature, name, options[name], true);
  }
  if (options.start.value === options.end.value) {
    fail(feature, '`start` and `end` must be different variables.');
  }
  const sources = list(options.source);
  if (sources.length === 0) fail(feature, 'give at least one `source`.');
  if (edges.length === 0) fail(feature, 'give the edge patterns that bind `start` and `end`.');
  const properties = options.edgeProperties ?? [];
  for (const property of properties) checkVariable(feature, 'edgeProperties', property, true);
  if (options.cartesian !== undefined && typeof options.cartesian !== 'boolean') {
    fail(feature, '`cartesian` must be a boolean.');
  }
  checkInteger(feature, 'numPathsPerTarget', options.numPathsPerTarget, 1);
  checkInteger(feature, 'maxDepth', options.maxDepth, 0);

  const pairs: Pair[] = [[ps('algorithm'), ps('allPaths')]];
  for (const source of sources) pairs.push([ps('source'), source]);
  for (const target of list(options.target)) pairs.push([ps('target'), target]);
  pairs.push(
    [ps('start'), options.start],
    [ps('end'), options.end],
    [ps('pathColumn'), options.path],
    [ps('edgeColumn'), options.edge]
  );
  for (const property of properties) pairs.push([ps('edgeProperty'), property]);
  if (options.cartesian !== undefined) pairs.push([ps('cartesian'), options.cartesian]);
  if (options.numPathsPerTarget !== undefined) {
    pairs.push([ps('numPathsPerTarget'), options.numPathsPerTarget]);
  }
  if (options.maxDepth !== undefined) pairs.push([ps('maxDepth'), options.maxDepth]);
  return qleverPattern(
    'qleverPathSearch',
    service<QleverPatternInput>(ps(''), configuration(pairs), group<QleverPatternInput>(...edges))
  );
}
