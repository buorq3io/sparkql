import { SparkqlError } from '../database/errors.js';
import { strdt } from '../functions/function.js';
import { createOperationExpression } from '../functions/utils.js';
import type {
  ExpressionInput,
  ExpressionOperationInput,
  TermLiteralOutput,
} from '../helpers/types.js';
import { transformLiteral } from '../structures/expression.js';

const dayTimeDuration = new URL('http://www.w3.org/2001/XMLSchema#dayTimeDuration');
// A timezone offset as a day-time duration: an optional sign, then hours and/or minutes.
const timezoneOffset = /^-?PT(?:\d+H(?:\d+M)?|\d+M)$/;

/**
 * Moves a date, time or date-time to another timezone (`ADJUST`).
 *
 * The value keeps its datatype: `xsd:date`, `xsd:time` or `xsd:dateTime`. A value with a
 * timezone is converted to the new one; a value without one gets the new timezone attached
 * unchanged. This is SPARQL 1.2 proposal SEP-0002. Oxigraph needs the timezone; it does not
 * implement removing one.
 *
 * The TypeScript result is a `TermLiteralOutput`, since an `xsd:time` is not a JavaScript
 * `Date`.
 *
 * @param value - The `xsd:date`, `xsd:time` or `xsd:dateTime` to adjust.
 * @param timezone - The new timezone as an `xsd:dayTimeDuration`, such as `PT2H` or `-PT5H30M`.
 * A string is sent as that datatype.
 * @throws {@link SparkqlError} When `timezone` is a string that is not a day-time duration of
 * hours and minutes.
 *
 * @example
 * Show each event's start in Central European Summer Time.
 *
 * ```ts
 * import { SparqlDatabase, adjust, as, triples } from 'sparkql/oxigraph';
 *
 * const prefixes = { schema: { uri: 'https://schema.org/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * db.select({ local: as(adjust(v.start, 'PT2H'), v.local) }).where(
 *   triples(v.event, n.schema.startDate, v.start)
 * );
 * ```
 *
 * ```sparql
 * SELECT ( ADJUST( ?start , STRDT( "PT2H" , <http://www.w3.org/2001/XMLSchema#dayTimeDuration> ) ) AS ?local ) WHERE {
 *   ?event schema:startDate ?start .
 * }
 * ```
 */
export function adjust(
  value: ExpressionInput,
  timezone: ExpressionInput
): ExpressionOperationInput<TermLiteralOutput> {
  if (typeof timezone === 'string') {
    if (!timezoneOffset.test(timezone)) {
      throw new SparkqlError({
        message: `ADJUST needs a timezone such as "PT2H" or "-PT5H30M", not ${JSON.stringify(timezone)}.`,
      });
    }
    timezone = strdt(timezone, dayTimeDuration);
  }
  return createOperationExpression('adjust', [value, timezone], transformLiteral);
}
