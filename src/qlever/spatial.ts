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
import { type LengthUnit, unitIri } from './units.js';

/** The `qlss:` spatial search service and its vocabulary. */
export const SPATIAL_SEARCH_NAMESPACE = 'https://qlever.cs.uni-freiburg.de/spatialSearch/';

const qlss = (name: string) => new URL(`${SPATIAL_SEARCH_NAMESPACE}${name}`);

/**
 * How QLever joins the geometries:
 *
 * - `'s2'`: points only, with an S2 index. Fast nearest-neighbour and distance searches.
 * - `'baseline'`: any geometry except collections, compared one by one.
 * - `'libspatialjoin'`: any geometry, for the {@link SpatialJoinType} relations.
 * - `'boundingBox'`: deprecated by QLever.
 */
export type SpatialAlgorithm = 's2' | 'baseline' | 'libspatialjoin' | 'boundingBox';

/** The relation a `'libspatialjoin'` search joins on. */
export type SpatialJoinType =
  | 'intersects'
  | 'covers'
  | 'contains'
  | 'touches'
  | 'crosses'
  | 'overlaps'
  | 'equals'
  | 'within'
  | 'within-dist'
  | 'de9im';

const algorithms: readonly string[] = ['s2', 'baseline', 'libspatialjoin', 'boundingBox'];
const joinTypes: readonly string[] = [
  'intersects',
  'covers',
  'contains',
  'touches',
  'crosses',
  'overlaps',
  'equals',
  'within',
  'within-dist',
  'de9im',
];
const de9im = /^[012TFtf*]{9}$/;

/** Options of {@link spatialSearch}. */
export interface SpatialSearchOptions {
  /** How to join; see {@link SpatialAlgorithm}. */
  readonly algorithm: SpatialAlgorithm;
  /** Variable for the left geometries, bound outside the search. Must hold `geo:wktLiteral`s. */
  readonly left: AST.TermVariable;
  /** Variable for the right geometries, bound by the search's patterns. */
  readonly right: AST.TermVariable;
  /** For each left geometry, the k nearest right ones. `'s2'` and `'baseline'` only. */
  readonly numNearestNeighbors?: number;
  /** Right geometries within this many metres. Required with the `'within-dist'` join type. */
  readonly maxDistance?: number;
  /** The relation to join on. Required with `'libspatialjoin'`, which is the only algorithm that takes it. */
  readonly joinType?: SpatialJoinType;
  /** The DE-9IM pattern for the `'de9im'` join type, nine characters from `0`-`2`, `T`, `F` and `*`. */
  readonly de9imFilter?: string;
  /** Variable that receives the distance between the two geometries. */
  readonly bindDistance?: AST.TermVariable;
  /** Unit of `bindDistance`. Defaults to metres with `'libspatialjoin'`, kilometres otherwise. */
  readonly distanceUnit?: LengthUnit;
  /**
   * Variables of the right patterns to keep, or `'all'`. The right geometry is always kept.
   * Without it, only the right geometry is.
   */
  readonly payload?: readonly AST.TermVariable[] | 'all';
}

const feature = 'spatial search';

/**
 * Joins geometries by distance or by a spatial relation with QLever's `qlss:` service.
 *
 * Prints `SERVICE qlss: { [ qlss:algorithm ... ; qlss:left ?left ; qlss:right ?right ; ... ] .
 * { right patterns } }`. `left` must be bound before the search; the patterns passed after the
 * options bind `right`. Give one search instruction: `numNearestNeighbors`, `maxDistance`, or
 * with the `'libspatialjoin'` algorithm a `joinType`. Geometries are WKT literals. Only databases
 * created from `sparkql/qlever` accept it. See
 * [GeoSPARQL](https://docs.qlever.dev/geosparql/).
 *
 * @param options - Algorithm, geometry variables, search instruction and outputs.
 * @param right - Graph patterns that bind the right geometries and their payload.
 * @throws {@link SparkqlError} When options contradict each other as QLever's rules describe:
 * no search instruction, a `joinType` with an algorithm other than `'libspatialjoin'` (or none
 * with it), `numNearestNeighbors` with `'libspatialjoin'`, `'within-dist'` without
 * `maxDistance`, `de9imFilter` without the `'de9im'` join type or with an invalid pattern, or
 * `distanceUnit` without `bindDistance`.
 *
 * @example
 * Find the two stations nearest to each restaurant, with the distance in metres.
 *
 * ```ts
 * import { SparqlDatabase, spatialSearch, triples } from 'sparkql/qlever';
 *
 * const prefixes = {
 *   geo: { uri: 'http://www.opengis.net/ont/geosparql#', fields: [] },
 *   ex: { uri: 'https://example.org/', fields: [] },
 * };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * db.select({ restaurant: v.restaurant, station: v.station, metres: v.metres }).where(
 *   triples(v.restaurant, n.ex.location, v.restaurantPoint),
 *   spatialSearch(
 *     {
 *       algorithm: 's2',
 *       left: v.restaurantPoint,
 *       right: v.stationPoint,
 *       numNearestNeighbors: 2,
 *       bindDistance: v.metres,
 *       distanceUnit: 'M',
 *       payload: [v.station],
 *     },
 *     triples(v.station, n.ex.location, v.stationPoint)
 *   )
 * );
 * ```
 *
 * ```sparql
 * SELECT ?restaurant ?station ?metres WHERE {
 *   ?restaurant ex:location ?restaurantPoint .
 *   SERVICE <https://qlever.cs.uni-freiburg.de/spatialSearch/> {
 *     [
 *       <https://qlever.cs.uni-freiburg.de/spatialSearch/algorithm> <https://qlever.cs.uni-freiburg.de/spatialSearch/s2> ;
 *       <https://qlever.cs.uni-freiburg.de/spatialSearch/left> ?restaurantPoint ;
 *       <https://qlever.cs.uni-freiburg.de/spatialSearch/right> ?stationPoint ;
 *       <https://qlever.cs.uni-freiburg.de/spatialSearch/numNearestNeighbors> "2"^^<http://www.w3.org/2001/XMLSchema#integer> ;
 *       <https://qlever.cs.uni-freiburg.de/spatialSearch/bindDistance> ?metres ;
 *       <https://qlever.cs.uni-freiburg.de/spatialSearch/distanceUnit> <http://qudt.org/vocab/unit/M> ;
 *       <https://qlever.cs.uni-freiburg.de/spatialSearch/payload> ?station ;
 *     ] .
 *     {
 *       ?station ex:location ?stationPoint .
 *     }
 *   }
 * }
 * ```
 */
export function spatialSearch(
  options: SpatialSearchOptions,
  ...right: PatternInput<QleverPatternInput>[]
): QleverPatternInput {
  if (typeof options !== 'object' || options === null) fail(feature, 'options are required.');
  const { algorithm, joinType } = options;
  if (!algorithms.includes(algorithm)) {
    fail(feature, `\`algorithm\` must be one of ${algorithms.join(', ')}.`);
  }
  checkVariable(feature, 'left', options.left, true);
  checkVariable(feature, 'right', options.right, true);
  if (options.left.value === options.right.value) {
    fail(feature, '`left` and `right` must be different variables.');
  }
  if (right.length === 0) fail(feature, 'give the patterns that bind `right`.');
  checkInteger(feature, 'numNearestNeighbors', options.numNearestNeighbors, 1);
  checkInteger(feature, 'maxDistance', options.maxDistance, 0);
  if (
    options.numNearestNeighbors === undefined &&
    options.maxDistance === undefined &&
    joinType === undefined
  ) {
    fail(feature, 'give `numNearestNeighbors`, `maxDistance` or `joinType`.');
  }
  if (joinType !== undefined && !joinTypes.includes(joinType)) {
    fail(feature, `\`joinType\` must be one of ${joinTypes.join(', ')}.`);
  }
  if ((algorithm === 'libspatialjoin') !== (joinType !== undefined)) {
    fail(feature, 'the `libspatialjoin` algorithm needs a `joinType`, and only it takes one.');
  }
  if (options.numNearestNeighbors !== undefined && algorithm !== 's2' && algorithm !== 'baseline') {
    fail(feature, '`numNearestNeighbors` works with the `s2` and `baseline` algorithms only.');
  }
  if (joinType === 'within-dist' && options.maxDistance === undefined) {
    fail(feature, 'the `within-dist` join type needs `maxDistance`.');
  }
  if ((joinType === 'de9im') !== (options.de9imFilter !== undefined)) {
    fail(feature, 'the `de9im` join type needs a `de9imFilter`, and only it takes one.');
  }
  if (options.de9imFilter !== undefined && !de9im.test(options.de9imFilter)) {
    fail(feature, '`de9imFilter` must be nine characters from 0, 1, 2, T, F and *.');
  }
  checkVariable(feature, 'bindDistance', options.bindDistance);
  if (options.distanceUnit !== undefined && options.bindDistance === undefined) {
    fail(feature, '`distanceUnit` needs `bindDistance`.');
  }
  const payload = options.payload;
  if (payload !== undefined && payload !== 'all') {
    if (!Array.isArray(payload)) fail(feature, '`payload` must be variables or `all`.');
    for (const variable of payload) checkVariable(feature, 'payload', variable, true);
  }

  const pairs: Pair[] = [
    [qlss('algorithm'), qlss(algorithm)],
    [qlss('left'), options.left],
    [qlss('right'), options.right],
  ];
  if (options.numNearestNeighbors !== undefined) {
    pairs.push([qlss('numNearestNeighbors'), options.numNearestNeighbors]);
  }
  if (options.maxDistance !== undefined) pairs.push([qlss('maxDistance'), options.maxDistance]);
  if (joinType !== undefined) pairs.push([qlss('joinType'), qlss(joinType)]);
  if (options.de9imFilter !== undefined) pairs.push([qlss('de9imFilter'), options.de9imFilter]);
  if (options.bindDistance !== undefined) pairs.push([qlss('bindDistance'), options.bindDistance]);
  if (options.distanceUnit !== undefined) {
    pairs.push([qlss('distanceUnit'), unitIri(options.distanceUnit, 'length')]);
  }
  if (payload === 'all') pairs.push([qlss('payload'), qlss('all')]);
  else for (const variable of payload ?? []) pairs.push([qlss('payload'), variable]);
  return qleverPattern(
    'qleverSpatialSearch',
    service<QleverPatternInput>(qlss(''), configuration(pairs), group<QleverPatternInput>(...right))
  );
}
