import { createFunctionCallExpression } from '../functions/utils.js';
import type { ExpressionFunctionCallInput, ExpressionInput } from '../helpers/types.js';
import { transformNumber } from '../structures/expression.js';

/** The namespace of GraphDB's own SPARQL functions, written `ofn:` in its documentation. */
export const OFN_NAMESPACE = 'http://www.ontotext.com/sparql/functions/';

/** A call to a GraphDB `ofn:` function; selected results are numbers. */
export type OfnCall = ExpressionFunctionCallInput<number>;

const call = (name: string, args: ExpressionInput[]): OfnCall =>
  createFunctionCallExpression(new URL(`${OFN_NAMESPACE}${name}`), args, transformNumber);

/**
 * GraphDB's own SPARQL functions (`ofn:`), for math and for durations and date differences.
 *
 * Each member emits a call to `<http://www.ontotext.com/sparql/functions/name>`, so no prefix
 * declaration is needed. Math functions return `xsd:double` and the time functions `xsd:long`;
 * both select as `number`. Members are named as in GraphDB, with the hyphenated duration
 * functions in camel case (`years-from-duration` becomes `yearsFromDuration`). GraphDB evaluates
 * them; sparkql does not. See the
 * [function reference](https://graphdb.ontotext.com/documentation/11.5/sparql-ext-functions-reference.html).
 *
 * @example
 * Find how many days each person has been a member, and the length of each membership in hours.
 *
 * ```ts
 * import { as, ofn, SparqlDatabase, triples } from 'sparkql/graphdb';
 *
 * const prefixes = { schema: { uri: 'https://schema.org/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const memberships = db
 *   .select({
 *     days: as(ofn.daysBetween(v.start, v.end), v.days),
 *     hours: as(ofn.asHours(v.length), v.hours),
 *   })
 *   .where(
 *     triples(v.membership, n.schema.startDate, v.start),
 *     triples(v.membership, n.schema.endDate, v.end),
 *     triples(v.membership, n.schema.duration, v.length)
 *   );
 * // [{ days: 365, hours: 8760 }, ...]
 * ```
 *
 * ```sparql
 * SELECT ( <http://www.ontotext.com/sparql/functions/daysBetween> ( ?start , ?end ) AS ?days ) ( <http://www.ontotext.com/sparql/functions/asHours> ( ?length ) AS ?hours ) WHERE {
 *   ?membership schema:startDate ?start .
 *   ?membership schema:endDate ?end .
 *   ?membership schema:duration ?length .
 * }
 * ```
 */
export const ofn = Object.freeze({
  /**
   * Arc cosine of a value between -1 and 1, in radians. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  acos: (a: ExpressionInput): OfnCall => call('acos', [a]),
  /**
   * Arc sine of a value between -1 and 1, in radians. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  asin: (a: ExpressionInput): OfnCall => call('asin', [a]),
  /**
   * Arc tangent, in radians. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  atan: (a: ExpressionInput): OfnCall => call('atan', [a]),
  /**
   * Cube root. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  cbrt: (a: ExpressionInput): OfnCall => call('cbrt', [a]),
  /**
   * Cosine of an angle in radians. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  cos: (a: ExpressionInput): OfnCall => call('cos', [a]),
  /**
   * Hyperbolic cosine. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   */
  cosh: (x: ExpressionInput): OfnCall => call('cosh', [x]),
  /**
   * Euler's number raised to a power. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  exp: (a: ExpressionInput): OfnCall => call('exp', [a]),
  /**
   * `exp(x) - 1`, accurate for `x` near zero. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   */
  expm1: (x: ExpressionInput): OfnCall => call('expm1', [x]),
  /**
   * Unbiased exponent of the value as a double. Returns `xsd:double`.
   *
   * @param d - Numeric expression.
   */
  getExponent: (d: ExpressionInput): OfnCall => call('getExponent', [d]),
  /**
   * Natural logarithm. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  log: (a: ExpressionInput): OfnCall => call('log', [a]),
  /**
   * Base-10 logarithm. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  log10: (a: ExpressionInput): OfnCall => call('log10', [a]),
  /**
   * Natural logarithm of `1 + x`, accurate for `x` near zero. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   */
  log1p: (x: ExpressionInput): OfnCall => call('log1p', [x]),
  /**
   * Next double towards negative infinity. Returns `xsd:double`.
   *
   * @param d - Numeric expression.
   */
  nextDown: (d: ExpressionInput): OfnCall => call('nextDown', [d]),
  /**
   * Next double towards positive infinity. Returns `xsd:double`.
   *
   * @param d - Numeric expression.
   */
  nextUp: (d: ExpressionInput): OfnCall => call('nextUp', [d]),
  /**
   * Double closest to the value that is a mathematical integer (ties to even). Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  rint: (a: ExpressionInput): OfnCall => call('rint', [a]),
  /**
   * Sign of the value: -1, 0 or 1. Returns `xsd:double`.
   *
   * @param d - Numeric expression.
   */
  signum: (d: ExpressionInput): OfnCall => call('signum', [d]),
  /**
   * Sine of an angle in radians. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  sin: (a: ExpressionInput): OfnCall => call('sin', [a]),
  /**
   * Hyperbolic sine. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   */
  sinh: (x: ExpressionInput): OfnCall => call('sinh', [x]),
  /**
   * Square root. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  sqrt: (a: ExpressionInput): OfnCall => call('sqrt', [a]),
  /**
   * Tangent of an angle in radians. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   */
  tan: (a: ExpressionInput): OfnCall => call('tan', [a]),
  /**
   * Hyperbolic tangent. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   */
  tanh: (x: ExpressionInput): OfnCall => call('tanh', [x]),
  /**
   * Converts an angle from radians to degrees. Returns `xsd:double`.
   *
   * @param angrad - Numeric expression.
   */
  toDegrees: (angrad: ExpressionInput): OfnCall => call('toDegrees', [angrad]),
  /**
   * Converts an angle from degrees to radians. Returns `xsd:double`.
   *
   * @param angdeg - Numeric expression.
   */
  toRadians: (angdeg: ExpressionInput): OfnCall => call('toRadians', [angdeg]),
  /**
   * Size of a unit in the last place of the value. Returns `xsd:double`.
   *
   * @param d - Numeric expression.
   */
  ulp: (d: ExpressionInput): OfnCall => call('ulp', [d]),
  /**
   * Angle in radians of the point `(x, y)`, from rectangular coordinates. Returns `xsd:double`.
   *
   * @param y - Numeric expression.
   * @param x - Numeric expression.
   */
  atan2: (y: ExpressionInput, x: ExpressionInput): OfnCall => call('atan2', [y, x]),
  /**
   * First value with the sign of the second. Returns `xsd:double`.
   *
   * @param magnitude - Numeric expression.
   * @param sign - Numeric expression.
   */
  copySign: (magnitude: ExpressionInput, sign: ExpressionInput): OfnCall =>
    call('copySign', [magnitude, sign]),
  /**
   * Largest integer not greater than `x / y`; both are cast to long. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   * @param y - Numeric expression.
   */
  floorDiv: (x: ExpressionInput, y: ExpressionInput): OfnCall => call('floorDiv', [x, y]),
  /**
   * Floor modulus of `x` and `y`; both are cast to long. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   * @param y - Numeric expression.
   */
  floorMod: (x: ExpressionInput, y: ExpressionInput): OfnCall => call('floorMod', [x, y]),
  /**
   * `sqrt(x² + y²)` without intermediate overflow. Returns `xsd:double`.
   *
   * @param x - Numeric expression.
   * @param y - Numeric expression.
   */
  hypot: (x: ExpressionInput, y: ExpressionInput): OfnCall => call('hypot', [x, y]),
  /**
   * Remainder of `f1 / f2` as defined by IEEE 754. Returns `xsd:double`.
   *
   * @param f1 - Numeric expression.
   * @param f2 - Numeric expression.
   */
  IEEEremainder: (f1: ExpressionInput, f2: ExpressionInput): OfnCall =>
    call('IEEEremainder', [f1, f2]),
  /**
   * Greater of two values. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   * @param b - Numeric expression.
   */
  max: (a: ExpressionInput, b: ExpressionInput): OfnCall => call('max', [a, b]),
  /**
   * Smaller of two values. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   * @param b - Numeric expression.
   */
  min: (a: ExpressionInput, b: ExpressionInput): OfnCall => call('min', [a, b]),
  /**
   * Next double after `start` in the direction of `direction`. Returns `xsd:double`.
   *
   * @param start - Numeric expression.
   * @param direction - Numeric expression.
   */
  nextAfter: (start: ExpressionInput, direction: ExpressionInput): OfnCall =>
    call('nextAfter', [start, direction]),
  /**
   * `a` raised to the power `b`. Returns `xsd:double`.
   *
   * @param a - Numeric expression.
   * @param b - Numeric expression.
   */
  pow: (a: ExpressionInput, b: ExpressionInput): OfnCall => call('pow', [a, b]),
  /**
   * `d × 2^scaleFactor`. Returns `xsd:double`.
   *
   * @param d - Numeric expression.
   * @param scaleFactor - Numeric expression.
   */
  scalb: (d: ExpressionInput, scaleFactor: ExpressionInput): OfnCall =>
    call('scalb', [d, scaleFactor]),
  /** Euler's number. Returns `xsd:double`. */
  e: (): OfnCall => call('e', []),
  /** The number π. Returns `xsd:double`. */
  pi: (): OfnCall => call('pi', []),
  /**
   * The years part of a duration. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  yearsFromDuration: (duration: ExpressionInput): OfnCall =>
    call('years-from-duration', [duration]),
  /**
   * The months part of a duration. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  monthsFromDuration: (duration: ExpressionInput): OfnCall =>
    call('months-from-duration', [duration]),
  /**
   * The days part of a duration. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  daysFromDuration: (duration: ExpressionInput): OfnCall => call('days-from-duration', [duration]),
  /**
   * The hours part of a duration. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  hoursFromDuration: (duration: ExpressionInput): OfnCall =>
    call('hours-from-duration', [duration]),
  /**
   * The minutes part of a duration. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  minutesFromDuration: (duration: ExpressionInput): OfnCall =>
    call('minutes-from-duration', [duration]),
  /**
   * The seconds part of a duration. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  secondsFromDuration: (duration: ExpressionInput): OfnCall =>
    call('seconds-from-duration', [duration]),
  /**
   * The milliseconds part of a duration. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  millisFromDuration: (duration: ExpressionInput): OfnCall =>
    call('millis-from-duration', [duration]),
  /**
   * A whole duration in weeks. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  asWeeks: (duration: ExpressionInput): OfnCall => call('asWeeks', [duration]),
  /**
   * A whole duration in days. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  asDays: (duration: ExpressionInput): OfnCall => call('asDays', [duration]),
  /**
   * A whole duration in hours. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  asHours: (duration: ExpressionInput): OfnCall => call('asHours', [duration]),
  /**
   * A whole duration in minutes. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  asMinutes: (duration: ExpressionInput): OfnCall => call('asMinutes', [duration]),
  /**
   * A whole duration in seconds. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  asSeconds: (duration: ExpressionInput): OfnCall => call('asSeconds', [duration]),
  /**
   * A whole duration in milliseconds. Returns `xsd:long`.
   *
   * @param duration - An `xsd:duration` expression.
   */
  asMillis: (duration: ExpressionInput): OfnCall => call('asMillis', [duration]),
  /**
   * Number of whole weeks from `start` to `end`. Returns `xsd:long`.
   *
   * The result is not well defined when only one of the two has a time zone.
   *
   * @param start - An `xsd:dateTime` expression.
   * @param end - An `xsd:dateTime` expression.
   */
  weeksBetween: (start: ExpressionInput, end: ExpressionInput): OfnCall =>
    call('weeksBetween', [start, end]),
  /**
   * Number of whole days from `start` to `end`. Returns `xsd:long`.
   *
   * The result is not well defined when only one of the two has a time zone.
   *
   * @param start - An `xsd:dateTime` expression.
   * @param end - An `xsd:dateTime` expression.
   */
  daysBetween: (start: ExpressionInput, end: ExpressionInput): OfnCall =>
    call('daysBetween', [start, end]),
  /**
   * Number of whole hours from `start` to `end`. Returns `xsd:long`.
   *
   * The result is not well defined when only one of the two has a time zone.
   *
   * @param start - An `xsd:dateTime` expression.
   * @param end - An `xsd:dateTime` expression.
   */
  hoursBetween: (start: ExpressionInput, end: ExpressionInput): OfnCall =>
    call('hoursBetween', [start, end]),
  /**
   * Number of whole minutes from `start` to `end`. Returns `xsd:long`.
   *
   * The result is not well defined when only one of the two has a time zone.
   *
   * @param start - An `xsd:dateTime` expression.
   * @param end - An `xsd:dateTime` expression.
   */
  minutesBetween: (start: ExpressionInput, end: ExpressionInput): OfnCall =>
    call('minutesBetween', [start, end]),
  /**
   * Number of whole seconds from `start` to `end`. Returns `xsd:long`.
   *
   * The result is not well defined when only one of the two has a time zone.
   *
   * @param start - An `xsd:dateTime` expression.
   * @param end - An `xsd:dateTime` expression.
   */
  secondsBetween: (start: ExpressionInput, end: ExpressionInput): OfnCall =>
    call('secondsBetween', [start, end]),
  /**
   * Number of whole millis from `start` to `end`. Returns `xsd:long`.
   *
   * The result is not well defined when only one of the two has a time zone.
   *
   * @param start - An `xsd:dateTime` expression.
   * @param end - An `xsd:dateTime` expression.
   */
  millisBetween: (start: ExpressionInput, end: ExpressionInput): OfnCall =>
    call('millisBetween', [start, end]),
});
