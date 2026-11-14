import { createFunctionCallExpression } from '../functions/utils.js';
import type {
  ExpressionFunctionCallInput,
  ExpressionInput,
  TermVariableTransform,
} from '../helpers/types.js';
import { wktGeometry } from '../helpers/wkt.js';
import { transformBoolean, transformNumber, transformString } from '../structures/expression.js';
import { QL_NAMESPACE } from './text.js';
import { type AreaUnit, type LengthUnit, unitIri } from './units.js';

/** The namespace of the GeoSPARQL functions, written `geof:`. */
export const QLEVER_GEOF_NAMESPACE = 'http://www.opengis.net/def/function/geosparql/';

/**
 * A geometry: an expression, or a string of WKT such as `'POINT(7.85 47.99)'`, which is sent as
 * a `geo:wktLiteral`.
 */
export type QleverGeometry = ExpressionInput;

/** A call to a QLever function; `T` is what its result selects as. */
export type QleverCall<T> = ExpressionFunctionCallInput<T>;

function call<T>(iri: string, args: ExpressionInput[], transform: TermVariableTransform<T>) {
  return createFunctionCallExpression(new URL(iri), args, transform);
}
const g = (name: string) => `${QLEVER_GEOF_NAMESPACE}${name}`;

type Measure<T> = (value: QleverGeometry) => QleverCall<T>;
const measure =
  <T>(name: string, transform: TermVariableTransform<T>): Measure<T> =>
  value =>
    call(g(name), [wktGeometry(value)], transform);

type Relation = (a: QleverGeometry, b: QleverGeometry) => QleverCall<boolean>;
const relation =
  (name: string): Relation =>
  (a, b) =>
    call(g(name), [wktGeometry(a), wktGeometry(b)], transformBoolean);

/**
 * The GeoSPARQL functions QLever implements (`geof:`), on WGS84 longitude-latitude geometries.
 *
 * Each member emits a call to `<http://www.opengis.net/def/function/geosparql/name>`, so no
 * prefix declaration is needed. Measures select as numbers, relations as booleans and
 * geometries as their WKT text. A string argument where a geometry is expected is sent as a
 * `geo:wktLiteral`. Units are QUDT names such as `'M'` and `'KiloM'`; note that
 * `distance` without a unit is in kilometres. QLever only evaluates the relations (`sf*` and
 * `relate`) inside `filter()`, between two variables or a variable and a literal. The set and
 * the units differ from `geof` in `sparkql/rdf4j`. See
 * [GeoSPARQL](https://docs.qlever.dev/geosparql/).
 *
 * @example
 * Find places within 5 km of Freiburg's centre.
 *
 * ```ts
 * import { SparqlDatabase, as, filter, geof, lte, triples } from 'sparkql/qlever';
 *
 * const prefixes = { geo: { uri: 'http://www.opengis.net/ont/geosparql#', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const km = geof.distance(v.wkt, 'POINT(7.85 47.99)');
 * db.select({ place: v.place, km: as(km, v.km) }).where(
 *   triples(v.place, n.geo.asWKT, v.wkt),
 *   filter(lte(km, 5))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?place ( <http://www.opengis.net/def/function/geosparql/distance> ( ?wkt , "POINT(7.85 47.99)"^^<http://www.opengis.net/ont/geosparql#wktLiteral> ) AS ?km ) WHERE {
 *   ?place geo:asWKT ?wkt .
 *   FILTER ( ( <http://www.opengis.net/def/function/geosparql/distance> ( ?wkt , "POINT(7.85 47.99)"^^<http://www.opengis.net/ont/geosparql#wktLiteral> ) <= "5"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export const geof = Object.freeze({
  /**
   * Geodesic distance between two geometries. Returns `xsd:decimal`, in kilometres unless
   * `unit` says otherwise.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   * @param unit - A length unit, such as `'M'` for metres.
   */
  distance: (a: QleverGeometry, b: QleverGeometry, unit?: LengthUnit): QleverCall<number> =>
    call(
      g('distance'),
      unit === undefined
        ? [wktGeometry(a), wktGeometry(b)]
        : [wktGeometry(a), wktGeometry(b), unitIri(unit, 'length')],
      transformNumber
    ),
  /**
   * Geodesic distance between two geometries in metres. Returns `xsd:decimal`.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   */
  metricDistance: (a: QleverGeometry, b: QleverGeometry): QleverCall<number> =>
    call(g('metricDistance'), [wktGeometry(a), wktGeometry(b)], transformNumber),
  /**
   * Length of a geometry in a unit. Returns `xsd:decimal`.
   *
   * @param value - The geometry.
   * @param unit - A length unit, such as `'KiloM'`.
   */
  length: (value: QleverGeometry, unit: LengthUnit): QleverCall<number> =>
    call(g('length'), [wktGeometry(value), unitIri(unit, 'length')], transformNumber),
  /**
   * Area of a geometry in a unit. Returns `xsd:decimal`.
   *
   * @param value - The geometry.
   * @param unit - An area unit, such as `'KiloM2'` or `'HA'`.
   */
  area: (value: QleverGeometry, unit: AreaUnit): QleverCall<number> =>
    call(g('area'), [wktGeometry(value), unitIri(unit, 'area')], transformNumber),
  /** Length of a geometry in metres. Returns `xsd:decimal`. */
  metricLength: measure('metricLength', transformNumber),
  /** Area of a geometry in square metres. Returns `xsd:decimal`. */
  metricArea: measure('metricArea', transformNumber),
  /** Latitude of a point. Returns `xsd:decimal`. */
  latitude: measure('latitude', transformNumber),
  /** Longitude of a point. Returns `xsd:decimal`. */
  longitude: measure('longitude', transformNumber),
  /** Smallest longitude of a geometry's bounding box. Returns `xsd:decimal`. */
  minX: measure('minX', transformNumber),
  /** Smallest latitude of a geometry's bounding box. Returns `xsd:decimal`. */
  minY: measure('minY', transformNumber),
  /** Largest longitude of a geometry's bounding box. Returns `xsd:decimal`. */
  maxX: measure('maxX', transformNumber),
  /** Largest latitude of a geometry's bounding box. Returns `xsd:decimal`. */
  maxY: measure('maxY', transformNumber),
  /** Centre point of a geometry. Returns a `geo:wktLiteral` point. */
  centroid: measure('centroid', transformString),
  /** Bounding box of a geometry. Returns a `geo:wktLiteral` polygon. */
  envelope: measure('envelope', transformString),
  /** The geometry as GeoJSON. Returns a `geo:geoJSONLiteral`. */
  asGeoJSON: measure('asGeoJSON', transformString),
  /** IRI of the geometry's type, such as `http://www.opengis.net/ont/sf#Polygon`. Returns `xsd:anyURI`. */
  geometryType: measure('geometryType', transformString),
  /** Number of geometries in a collection; 1 for a single geometry. Returns `xsd:int`. */
  numGeometries: measure('numGeometries', transformNumber),
  /**
   * The n-th geometry of a collection, counting from 1. Returns a `geo:wktLiteral`, or nothing
   * for an index out of range.
   *
   * @param value - The geometry collection.
   * @param index - The position, from 1.
   */
  geometryN: (value: QleverGeometry, index: ExpressionInput): QleverCall<string> =>
    call(g('geometryN'), [wktGeometry(value), index], transformString),
  /**
   * Whether two geometries are related as a DE-9IM pattern describes, such as `'T*F**F***'`
   * for "within". Only inside `filter()`.
   *
   * @param a - The first geometry.
   * @param b - The second geometry.
   * @param matrix - The DE-9IM pattern: nine characters from `T`, `F`, `*`, `0`, `1` and `2`.
   */
  relate: (a: QleverGeometry, b: QleverGeometry, matrix: ExpressionInput): QleverCall<boolean> =>
    call(g('relate'), [wktGeometry(a), wktGeometry(b), matrix], transformBoolean),
  /** The geometries share at least one point. Only inside `filter()`. */
  sfIntersects: relation('sfIntersects'),
  /** The first geometry contains the second. Only inside `filter()`. */
  sfContains: relation('sfContains'),
  /** The first geometry covers the second. Only inside `filter()`. */
  sfCovers: relation('sfCovers'),
  /** The geometries cross. Only inside `filter()`. */
  sfCrosses: relation('sfCrosses'),
  /** The geometries touch only at their boundaries. Only inside `filter()`. */
  sfTouches: relation('sfTouches'),
  /** The geometries are equal. Only inside `filter()`. */
  sfEquals: relation('sfEquals'),
  /** The geometries overlap without one containing the other. Only inside `filter()`. */
  sfOverlaps: relation('sfOverlaps'),
  /** The first geometry is inside the second. Only inside `filter()`. */
  sfWithin: relation('sfWithin'),
});

const q = (name: string) => `${QL_NAMESPACE}${name}`;

/**
 * QLever's own functions (`ql:`), for dates and geometries.
 *
 * Each member emits a call to `<http://qlever.cs.uni-freiburg.de/builtin-functions/name>`.
 *
 * @example
 * Compare dates in different timezones as instants.
 *
 * ```ts
 * import { SparqlDatabase, as, ql, triples } from 'sparkql/qlever';
 *
 * const prefixes = { schema: { uri: 'https://schema.org/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * db.select({ event: v.event, epoch: as(ql.toEpoch(v.start), v.epoch) })
 *   .where(triples(v.event, n.schema.startDate, v.start))
 *   .orderBy(v.epoch);
 * ```
 *
 * ```sparql
 * SELECT ?event ( <http://qlever.cs.uni-freiburg.de/builtin-functions/toEpoch> ( ?start ) AS ?epoch ) WHERE {
 *   ?event schema:startDate ?start .
 * }
 * ORDER BY ASC ( ?epoch )
 * ```
 */
export const ql = Object.freeze({
  /**
   * Seconds since 1970-01-01T00:00:00Z of an `xsd:date` or `xsd:dateTime`. Returns
   * `xsd:integer`. QLever compares date-times in different timezones by their text, so convert
   * them with `toEpoch` to compare instants.
   *
   * @param value - The date or date-time.
   */
  toEpoch: (value: ExpressionInput): QleverCall<number> =>
    call(q('toEpoch'), [value], transformNumber),
  /**
   * Whether a WKT literal is a point that QLever stores in its compact encoding. Returns
   * `xsd:boolean`.
   *
   * @param value - The geometry.
   */
  isGeoPoint: (value: QleverGeometry): QleverCall<boolean> =>
    call(q('isGeoPoint'), [wktGeometry(value)], transformBoolean),
  /**
   * Lower-left corner of a geometry's bounding box. Returns a `geo:wktLiteral` point.
   *
   * @param value - The geometry.
   */
  envelopeLowerLeft: (value: QleverGeometry): QleverCall<string> =>
    call(q('envelopeLowerLeft'), [wktGeometry(value)], transformString),
  /**
   * Upper-right corner of a geometry's bounding box. Returns a `geo:wktLiteral` point.
   *
   * @param value - The geometry.
   */
  envelopeUpperRight: (value: QleverGeometry): QleverCall<string> =>
    call(q('envelopeUpperRight'), [wktGeometry(value)], transformString),
  /**
   * Simplifies a geometry with the Douglas-Peucker algorithm. Returns a `geo:wktLiteral`.
   *
   * @param value - The geometry.
   * @param tolerance - How far points may move, in coordinate units (degrees).
   */
  simplifyGeometry: (value: QleverGeometry, tolerance: ExpressionInput): QleverCall<string> =>
    call(q('simplifyGeometry'), [wktGeometry(value), tolerance], transformString),
});
