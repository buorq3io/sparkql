import type * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';
import { createFunctionCallExpression } from '../functions/utils.js';
import type {
  ExpressionFunctionCallInput,
  ExpressionInput,
  TermVariableTransform,
} from '../helpers/types.js';
import { transformNumber, transformString } from '../structures/expression.js';

const loc = { sourceLocationType: 'autoGenerate' } as const;
const functionName = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Virtuoso returns SQL integers for tests; `1` and `true` both select as `true`. */
const transformTest = (self =>
  self.value === '1' ||
  self.value.toLowerCase() === 'true') satisfies TermVariableTransform<boolean>;

function reserved(prefix: 'bif' | 'sql', name: string): AST.TermIri {
  if (typeof name !== 'string' || !functionName.test(name)) {
    throw new SparkqlError({
      message: `Invalid Virtuoso ${prefix}: function name "${String(name)}".`,
    });
  }
  return Object.freeze({
    type: 'term',
    subType: 'namedNode',
    loc,
    prefix,
    value: name,
  }) as AST.TermIri;
}

/**
 * Calls a Virtuoso SQL built-in function as `bif:name(...)`.
 *
 * Virtuoso reserves the `bif:` prefix, so the call needs no prefix declaration; other stores
 * reject it. Use it for built-ins that {@link bif} does not list. The result selects as the term
 * Virtuoso returns unless you pass `transform`. See
 * [Calling SQL from SPARQL](https://docs.openlinksw.com/virtuoso/rdfsqlfromsparql/).
 *
 * @param name - Built-in name, such as `'st_buffer'`: letters, digits and underscores.
 * @param args - Arguments of the call.
 * @param transform - Converts each selected result term.
 * @throws {@link SparkqlError} When `name` is not a plain identifier.
 *
 * @example
 * Compute each place's distance from Greenwich with Virtuoso's haversine function.
 *
 * ```ts
 * import { as, bifCall, SparqlDatabase, transformNumber, triples } from 'sparkql/virtuoso';
 *
 * const prefixes = { geo: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const distances = db
 *   .select({
 *     place: v.place,
 *     km: as(bifCall('haversine_deg_km', [v.lat, v.long, 51.48, 0], transformNumber), v.km),
 *   })
 *   .where(triples(v.place, n.geo.lat, v.lat), triples(v.place, n.geo.long, v.long));
 * ```
 *
 * ```sparql
 * SELECT ?place ( bif:haversine_deg_km ( ?lat , ?long , "51.48"^^<http://www.w3.org/2001/XMLSchema#decimal> , "0"^^<http://www.w3.org/2001/XMLSchema#integer> ) AS ?km ) WHERE {
 *   ?place geo:lat ?lat .
 *   ?place geo:long ?long .
 * }
 * ```
 */
export function bifCall<T = unknown>(
  name: string,
  args: ExpressionInput[],
  transform?: TermVariableTransform<T>
): ExpressionFunctionCallInput<T> {
  return createFunctionCallExpression(reserved('bif', name), args, transform as never);
}

/**
 * Calls a Virtuoso/PL procedure owned by `DBA` as `sql:name(...)`.
 *
 * Virtuoso reserves the `sql:` prefix and runs `DB.DBA."name"(...)`. The procedure must exist
 * and be granted to the SPARQL user. See
 * [Calling SQL from SPARQL](https://docs.openlinksw.com/virtuoso/rdfsqlfromsparql/).
 *
 * @param name - Procedure name: letters, digits and underscores.
 * @param args - Arguments of the call.
 * @param transform - Converts each selected result term.
 * @throws {@link SparkqlError} When `name` is not a plain identifier.
 *
 * @example
 * Format each person's name with a custom procedure.
 *
 * ```ts
 * import { as, sqlCall, SparqlDatabase, transformString, triples } from 'sparkql/virtuoso';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const labels = db
 *   .select({ label: as(sqlCall('FormatName', [v.name, v.nick], transformString), v.label) })
 *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.nick, v.nick));
 * ```
 *
 * ```sparql
 * SELECT ( sql:FormatName ( ?name , ?nick ) AS ?label ) WHERE {
 *   ?person foaf:name ?name .
 *   ?person foaf:nick ?nick .
 * }
 * ```
 */
export function sqlCall<T = unknown>(
  name: string,
  args: ExpressionInput[],
  transform?: TermVariableTransform<T>
): ExpressionFunctionCallInput<T> {
  return createFunctionCallExpression(reserved('sql', name), args, transform as never);
}

const call = <T>(name: string, args: ExpressionInput[], transform: TermVariableTransform<T>) =>
  bifCall(name, args, transform);
const optional = (args: ExpressionInput[], last: ExpressionInput | undefined) =>
  last === undefined ? args : [...args, last];

/**
 * Virtuoso's documented `bif:` functions: the full-text test and the geometry functions.
 *
 * Each member prints `bif:name(...)`, with the name as Virtuoso writes it. Geometries are
 * `virtrdf:Geometry` literals holding WKT and select as their text. Distances and precisions are
 * in kilometres for latitude-longitude geometries (SRID 4326, the default), and in coordinate
 * units otherwise. Tests return SQL integers, which select as booleans. For any other built-in,
 * use {@link bifCall}. See
 * [Geometry](https://docs.openlinksw.com/virtuoso/sqlrefgeospatial/).
 *
 * @example
 * Find the places within 100 km of a point and their distance from it.
 *
 * ```ts
 * import { as, bif, filter, SparqlDatabase, triples } from 'sparkql/virtuoso';
 *
 * const prefixes = { geo: { uri: 'http://www.w3.org/2003/01/geo/wgs84_pos#', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const centre = bif.st_point(0, 52);
 * const nearby = db
 *   .select({ place: v.place, km: as(bif.st_distance(v.geometry, centre), v.km) })
 *   .where(
 *     triples(v.place, n.geo.geometry, v.geometry),
 *     filter(bif.st_intersects(v.geometry, centre, 100))
 *   );
 * // [{ place: ..., km: 42.1 }, ...]
 * ```
 *
 * ```sparql
 * SELECT ?place ( bif:st_distance ( ?geometry , bif:st_point ( "0"^^<http://www.w3.org/2001/XMLSchema#integer> , "52"^^<http://www.w3.org/2001/XMLSchema#integer> ) ) AS ?km ) WHERE {
 *   ?place geo:geometry ?geometry .
 *   FILTER ( bif:st_intersects ( ?geometry , bif:st_point ( "0"^^<http://www.w3.org/2001/XMLSchema#integer> , "52"^^<http://www.w3.org/2001/XMLSchema#integer> ) , "100"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export const bif = Object.freeze({
  /**
   * Whether a literal matches a full-text expression, as a function for `FILTER`. Prefer
   * {@link textContains}, the predicate form, which can also return a score.
   *
   * @param text - The literal to test, from Virtuoso's full-text index.
   * @param query - Virtuoso text expression.
   */
  contains: (text: ExpressionInput, query: ExpressionInput) =>
    call('contains', [text, query], transformTest),
  /**
   * A point geometry. `x` is the longitude and `y` the latitude.
   *
   * @param x - Longitude, or x coordinate.
   * @param y - Latitude, or y coordinate.
   */
  st_point: (x: ExpressionInput, y: ExpressionInput) => call('st_point', [x, y], transformString),
  /**
   * Whether two geometries intersect, optionally within a distance.
   *
   * @param a - First geometry.
   * @param b - Second geometry.
   * @param precision - Tolerance in kilometres or coordinate units; `0` by default.
   */
  st_intersects: (a: ExpressionInput, b: ExpressionInput, precision?: ExpressionInput) =>
    call('st_intersects', optional([a, b], precision), transformTest),
  /**
   * Whether every point of `a` is in `b`, optionally within a distance.
   *
   * @param a - Geometry to test.
   * @param b - Containing geometry.
   * @param precision - Tolerance in kilometres or coordinate units; `0` by default.
   */
  st_within: (a: ExpressionInput, b: ExpressionInput, precision?: ExpressionInput) =>
    call('st_within', optional([a, b], precision), transformTest),
  /**
   * Whether every point of `b` is in `a`, optionally within a distance.
   *
   * @param a - Containing geometry.
   * @param b - Geometry to test.
   * @param precision - Tolerance in kilometres or coordinate units; `0` by default.
   */
  st_contains: (a: ExpressionInput, b: ExpressionInput, precision?: ExpressionInput) =>
    call('st_contains', optional([a, b], precision), transformTest),
  /**
   * Whether the bounding boxes of two geometries intersect, optionally within a distance. Faster
   * and less exact than {@link bif.st_intersects}.
   *
   * @param a - First geometry.
   * @param b - Second geometry.
   * @param precision - Tolerance in kilometres or coordinate units.
   */
  st_may_intersect: (a: ExpressionInput, b: ExpressionInput, precision?: ExpressionInput) =>
    call('st_may_intersect', optional([a, b], precision), transformTest),
  /**
   * Distance between two geometries: great-circle kilometres for SRID 4326, coordinate units
   * otherwise.
   *
   * @param a - First geometry.
   * @param b - Second geometry.
   */
  st_distance: (a: ExpressionInput, b: ExpressionInput) =>
    call('st_distance', [a, b], transformNumber),
  /**
   * The x coordinate (longitude) of a point.
   *
   * @param point - A point geometry.
   */
  st_x: (point: ExpressionInput) => call('st_x', [point], transformNumber),
  /**
   * The y coordinate (latitude) of a point.
   *
   * @param point - A point geometry.
   */
  st_y: (point: ExpressionInput) => call('st_y', [point], transformNumber),
  /**
   * The WKT text of a geometry.
   *
   * @param geometry - A geometry.
   */
  st_astext: (geometry: ExpressionInput) => call('st_astext', [geometry], transformString),
  /**
   * A geometry parsed from WKT text.
   *
   * @param wkt - WKT text, such as `'POINT(0 52)'`.
   */
  st_geomfromtext: (wkt: ExpressionInput) => call('st_geomfromtext', [wkt], transformString),
  /**
   * A geometry parsed from EWKT text, which may carry an SRID.
   *
   * @param ewkt - EWKT text, such as `'SRID=4326;POINT(0 52)'`.
   */
  st_ewkt_read: (ewkt: ExpressionInput) => call('st_ewkt_read', [ewkt], transformString),
  /**
   * The SRID of a geometry: `4326` by default, `0` for shapes on a plane.
   *
   * @param geometry - A geometry.
   */
  st_srid: (geometry: ExpressionInput) => call('st_srid', [geometry], transformNumber),
  /**
   * The geometry with another SRID.
   *
   * @param geometry - A geometry.
   * @param srid - The new SRID.
   */
  st_setsrid: (geometry: ExpressionInput, srid: ExpressionInput) =>
    call('st_setsrid', [geometry, srid], transformString),
  /**
   * The bounding box of a geometry.
   *
   * @param geometry - A geometry.
   */
  st_get_bounding_box: (geometry: ExpressionInput) =>
    call('st_get_bounding_box', [geometry], transformString),
  /**
   * Whether a value is a geometry.
   *
   * @param value - Any value.
   */
  isgeometry: (value: ExpressionInput) => call('isgeometry', [value], transformTest),
  /**
   * Great-circle distance in kilometres between two latitude-longitude pairs. Note the order:
   * latitude first.
   *
   * @param lat1 - Latitude of the first place, in degrees.
   * @param long1 - Longitude of the first place, in degrees.
   * @param lat2 - Latitude of the second place, in degrees.
   * @param long2 - Longitude of the second place, in degrees.
   */
  haversine_deg_km: (
    lat1: ExpressionInput,
    long1: ExpressionInput,
    lat2: ExpressionInput,
    long2: ExpressionInput
  ) => call('haversine_deg_km', [lat1, long1, lat2, long2], transformNumber),
});
