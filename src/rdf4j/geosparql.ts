import type * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';
import { createFunctionCallExpression } from '../functions/utils.js';
import type {
  ExpressionFunctionCallInput,
  ExpressionInput,
  TermVariableTransform,
} from '../helpers/types.js';
import { wktGeometry } from '../helpers/wkt.js';
import { transformBoolean, transformNumber, transformString } from '../structures/expression.js';

/** The namespace of the GeoSPARQL functions, written `geof:`. */
export const GEOF_NAMESPACE = 'http://www.opengis.net/def/function/geosparql/';
/** The namespace of the OGC units of measure, written `uom:`. */
export const UOM_NAMESPACE = 'http://www.opengis.net/def/uom/OGC/1.0/';

const loc = { sourceLocationType: 'autoGenerate' } as const;

const iri = (value: string): AST.TermIri =>
  Object.freeze({ type: 'term', subType: 'namedNode', loc, value }) as AST.TermIri;

/**
 * The units of measure RDF4J accepts in {@link geof.distance} and {@link geof.buffer}.
 *
 * With latitude-longitude data, `metre` measures on the earth's surface, while `degree` and
 * `radian` measure the angle between coordinates. `unity` is the coordinate unit itself.
 */
export const uom = Object.freeze({
  /** Metres: `<http://www.opengis.net/def/uom/OGC/1.0/metre>`. */
  metre: iri(`${UOM_NAMESPACE}metre`),
  /** Degrees: `<http://www.opengis.net/def/uom/OGC/1.0/degree>`. */
  degree: iri(`${UOM_NAMESPACE}degree`),
  /** Radians: `<http://www.opengis.net/def/uom/OGC/1.0/radian>`. */
  radian: iri(`${UOM_NAMESPACE}radian`),
  /** The coordinate unit: `<http://www.opengis.net/def/uom/OGC/1.0/unity>`. */
  unity: iri(`${UOM_NAMESPACE}unity`),
});

/** A unit of measure: a name from {@link uom}, or any IRI or expression. */
export type UnitInput = keyof typeof uom | ExpressionInput;

/**
 * A geometry: an expression, or a string of WKT such as `'POINT(4.9 52.37)'`, which is sent as a
 * `geo:wktLiteral`.
 */
export type GeometryInput = ExpressionInput;

/** A call to a GeoSPARQL function; `T` is what its result selects as. */
export type GeofCall<T> = ExpressionFunctionCallInput<T>;

const geometry = (value: GeometryInput): ExpressionInput => wktGeometry(value);

function unit(value: UnitInput): ExpressionInput {
  if (typeof value !== 'string') return value;
  if (!Object.keys(uom).includes(value)) {
    throw new SparkqlError({
      message: `Unknown unit of measure "${value}"; use ${Object.keys(uom).join(', ')}, or an IRI.`,
    });
  }
  return uom[value as keyof typeof uom];
}

function call<T>(name: string, args: ExpressionInput[], transform: TermVariableTransform<T>) {
  return createFunctionCallExpression(new URL(`${GEOF_NAMESPACE}${name}`), args, transform);
}

type Relation = (a: GeometryInput, b: GeometryInput) => GeofCall<boolean>;
const relation =
  (name: string): Relation =>
  (a, b) =>
    call(name, [geometry(a), geometry(b)], transformBoolean);

type Combination = (a: GeometryInput, b: GeometryInput) => GeofCall<string>;
const combination =
  (name: string): Combination =>
  (a, b) =>
    call(name, [geometry(a), geometry(b)], transformString);

type Shape = (value: GeometryInput) => GeofCall<string>;
const shape =
  (name: string): Shape =>
  value =>
    call(name, [geometry(value)], transformString);

/**
 * The GeoSPARQL functions RDF4J implements (`geof:`), for geometries written as WKT.
 *
 * Each member emits a call to `<http://www.opengis.net/def/function/geosparql/name>`, so no
 * prefix declaration is needed. Relations select as booleans, distances as numbers and new
 * geometries as their WKT text. A string argument where a geometry is expected is sent as a
 * `geo:wktLiteral`; RDF4J ignores plain strings. RDF4J reads WKT without a coordinate reference
 * system prefix as longitude-latitude (CRS84) and does not evaluate WKT that starts with one.
 * See [GeoSPARQL in RDF4J](https://rdf4j.org/documentation/programming/geosparql/).
 *
 * The Simple Features (`sf`), Egenhofer (`eh`) and RCC8 (`rcc8`) relations are the three
 * families of GeoSPARQL topological tests.
 *
 * @example
 * Find the places within 10 km of Amsterdam's centre, nearest first.
 *
 * ```ts
 * import { SparqlDatabase, as, filter, geof, lt, triples } from 'sparkql/rdf4j';
 *
 * const prefixes = { geo: { uri: 'http://www.opengis.net/ont/geosparql#', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const metres = geof.distance(v.wkt, 'POINT(4.9 52.37)', 'metre');
 * db.select({ place: v.place, metres: as(metres, v.metres) })
 *   .where(
 *     triples(v.place, n.geo.hasGeometry, v.geometry),
 *     triples(v.geometry, n.geo.asWKT, v.wkt),
 *     filter(lt(metres, 10000))
 *   )
 *   .orderBy(v.metres);
 * ```
 *
 * ```sparql
 * SELECT ?place ( <http://www.opengis.net/def/function/geosparql/distance> ( ?wkt , "POINT(4.9 52.37)"^^<http://www.opengis.net/ont/geosparql#wktLiteral> , <http://www.opengis.net/def/uom/OGC/1.0/metre> ) AS ?metres ) WHERE {
 *   ?place geo:hasGeometry ?geometry .
 *   ?geometry geo:asWKT ?wkt .
 *   FILTER ( ( <http://www.opengis.net/def/function/geosparql/distance> ( ?wkt , "POINT(4.9 52.37)"^^<http://www.opengis.net/ont/geosparql#wktLiteral> , <http://www.opengis.net/def/uom/OGC/1.0/metre> ) < "10000"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ORDER BY ASC ( ?metres )
 * ```
 */
export const geof = Object.freeze({
  /**
   * Shortest distance between two geometries in a unit of measure. Returns `xsd:double`.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   * @param units - `'metre'`, `'degree'`, `'radian'` or `'unity'`, or an IRI.
   */
  distance: (a: GeometryInput, b: GeometryInput, units: UnitInput): GeofCall<number> =>
    call('distance', [geometry(a), geometry(b), unit(units)], transformNumber),
  /**
   * The area within a distance of a geometry. Returns a `geo:wktLiteral`.
   *
   * @param value - The geometry.
   * @param radius - The distance, in `units`.
   * @param units - `'metre'`, `'degree'`, `'radian'` or `'unity'`, or an IRI.
   */
  buffer: (value: GeometryInput, radius: ExpressionInput, units: UnitInput): GeofCall<string> =>
    call('buffer', [geometry(value), radius, unit(units)], transformString),
  /**
   * The smallest convex geometry that contains a geometry. Returns a `geo:wktLiteral`.
   *
   * @param value - The geometry.
   */
  convexHull: shape('convexHull'),
  /**
   * The bounding box of a geometry. Returns a `geo:wktLiteral`.
   *
   * @param value - The geometry.
   */
  envelope: shape('envelope'),
  /**
   * The boundary of a geometry, such as a polygon's outline. Returns a `geo:wktLiteral`.
   *
   * @param value - The geometry.
   */
  boundary: shape('boundary'),
  /**
   * The part two geometries share. Returns a `geo:wktLiteral`.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   */
  intersection: combination('intersection'),
  /**
   * The points in either geometry. Returns a `geo:wktLiteral`.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   */
  union: combination('union'),
  /**
   * The points of the first geometry that are not in the second. Returns a `geo:wktLiteral`.
   *
   * @param a - The first geometry.
   * @param b - The geometry to remove.
   */
  difference: combination('difference'),
  /**
   * The points in exactly one of the two geometries. Returns a `geo:wktLiteral`.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   */
  symDifference: combination('symDifference'),
  /**
   * The IRI of a geometry's coordinate reference system, as text. Returns `xsd:anyURI`.
   *
   * @param value - The geometry.
   */
  getSRID: (value: GeometryInput): GeofCall<string> =>
    call('getSRID', [geometry(value)], transformString),
  /**
   * Whether two geometries are related as a DE-9IM intersection pattern describes, such as
   * `'T*F**F***'` for "within". Returns `xsd:boolean`.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   * @param matrix - The DE-9IM pattern: nine characters from `T`, `F`, `*`, `0`, `1` and `2`.
   */
  relate: (a: GeometryInput, b: GeometryInput, matrix: ExpressionInput): GeofCall<boolean> =>
    call('relate', [geometry(a), geometry(b), matrix], transformBoolean),
  /** Simple Features: the geometries are equal. */
  sfEquals: relation('sfEquals'),
  /** Simple Features: the geometries share no point. */
  sfDisjoint: relation('sfDisjoint'),
  /** Simple Features: the geometries share at least one point. */
  sfIntersects: relation('sfIntersects'),
  /** Simple Features: the geometries touch only at their boundaries. */
  sfTouches: relation('sfTouches'),
  /** Simple Features: the geometries cross, such as a line through a polygon. */
  sfCrosses: relation('sfCrosses'),
  /** Simple Features: the first geometry is inside the second. */
  sfWithin: relation('sfWithin'),
  /** Simple Features: the first geometry contains the second. */
  sfContains: relation('sfContains'),
  /** Simple Features: the geometries overlap without one containing the other. */
  sfOverlaps: relation('sfOverlaps'),
  /** Egenhofer: the geometries are equal. */
  ehEquals: relation('ehEquals'),
  /** Egenhofer: the geometries share no point. */
  ehDisjoint: relation('ehDisjoint'),
  /** Egenhofer: the geometries touch only at their boundaries. */
  ehMeet: relation('ehMeet'),
  /** Egenhofer: the geometries overlap without one containing the other. */
  ehOverlap: relation('ehOverlap'),
  /** Egenhofer: the first geometry contains the second, touching its boundary. */
  ehCovers: relation('ehCovers'),
  /** Egenhofer: the first geometry is inside the second, touching its boundary. */
  ehCoveredBy: relation('ehCoveredBy'),
  /** Egenhofer: the first geometry is inside the second, away from its boundary. */
  ehInside: relation('ehInside'),
  /** Egenhofer: the first geometry contains the second, away from its boundary. */
  ehContains: relation('ehContains'),
  /** RCC8: the regions are disconnected. */
  rcc8dc: relation('rcc8dc'),
  /** RCC8: the regions are externally connected (they touch). */
  rcc8ec: relation('rcc8ec'),
  /** RCC8: the regions are equal. */
  rcc8eq: relation('rcc8eq'),
  /** RCC8: the regions partially overlap. */
  rcc8po: relation('rcc8po'),
  /** RCC8: the first region is a tangential proper part of the second. */
  rcc8tpp: relation('rcc8tpp'),
  /** RCC8: the second region is a tangential proper part of the first. */
  rcc8tppi: relation('rcc8tppi'),
  /** RCC8: the first region is a non-tangential proper part of the second. */
  rcc8ntpp: relation('rcc8ntpp'),
  /** RCC8: the second region is a non-tangential proper part of the first. */
  rcc8ntppi: relation('rcc8ntppi'),
});
