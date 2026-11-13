import type * as AST from '@traqula/rules-sparql-1-1';
import type { PatternGroupInput } from '../helpers/types.js';
import { service } from '../structures/pattern.js';
import {
  checkInteger,
  checkVariable,
  configuration,
  fail,
  type Pair,
  type QleverPatternInput,
  qleverPattern,
} from './types.js';

/** The `rn:` row number service and its vocabulary. */
export const ROW_NUMBER_NAMESPACE = 'https://qlever.cs.uni-freiburg.de/rowNumber/';

const rn = (name: string) => new URL(`${ROW_NUMBER_NAMESPACE}${name}`);
const feature = 'row numbers';

/** Options of {@link rowNumber}. */
export interface RowNumberOptions {
  /** The number of the first row. Defaults to 0. */
  readonly offset?: number;
}

function checkSubquery(bind: AST.TermVariable) {
  return (pattern: AST.PatternService) => {
    const subquery = pattern.patterns[1];
    const inner = subquery?.subType === 'group' ? subquery.patterns : [];
    const select = inner[0];
    if (inner.length !== 1 || select?.type !== 'query' || select.subType !== 'select') {
      fail(feature, 'give one subquery, as `.as()` returns.');
    }
    if (!select.solutionModifiers.order?.orderDefs.length) {
      fail(feature, 'the subquery needs an `orderBy()`: rows are numbered in that order.');
    }
    const projects = select.variables.some(
      item =>
        (item.type === 'term' && item.value === bind.value) ||
        (item.type === 'pattern' && item.variable.value === bind.value)
    );
    if (projects) fail(feature, `the subquery must not select ?${bind.value}.`);
  };
}

/**
 * Numbers the rows of an ordered subquery with QLever's `rn:` service.
 *
 * Prints `SERVICE rn: { [ rn:bind ?n ; rn:offset 0 ] . { SELECT ... ORDER BY ... } }`. Rows are
 * numbered in the subquery's order, from `offset`. Standard SPARQL has no row numbers or window
 * functions; joining two numbered copies of a query on `?n` and `?n + 1` compares each row with
 * the next. Numbers do not restart per group, so put grouping variables first in `orderBy()`.
 * Only databases created from `sparkql/qlever` accept it. See
 * [Window functions](https://docs.qlever.dev/window-functions/).
 *
 * @param bind - Variable that receives the row number. The subquery must not select it.
 * @param subquery - An ordered subquery, as `.as()` returns.
 * @param options - The number of the first row.
 * @throws {@link SparkqlError} When `bind` is not a variable or `offset` is negative, and, when
 * the query is built, when the subquery has no `orderBy()` or selects `bind`.
 *
 * @example
 * Number people by name, starting at 1.
 *
 * ```ts
 * import { SparqlDatabase, rowNumber, triples } from 'sparkql/qlever';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const names = db
 *   .select({ name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name))
 *   .orderBy(v.name)
 *   .as();
 * db.select({ rank: v.rank, name: v.name }).where(rowNumber(v.rank, names, { offset: 1 }));
 * ```
 *
 * ```sparql
 * SELECT ?rank ?name WHERE {
 *   SERVICE <https://qlever.cs.uni-freiburg.de/rowNumber/> {
 *     [
 *       <https://qlever.cs.uni-freiburg.de/rowNumber/bind> ?rank ;
 *       <https://qlever.cs.uni-freiburg.de/rowNumber/offset> "1"^^<http://www.w3.org/2001/XMLSchema#integer> ;
 *     ] .
 *     {
 *       SELECT ?name WHERE {
 *         ?person foaf:name ?name .
 *       }
 *       ORDER BY ASC ( ?name )
 *     }
 *   }
 * }
 * ```
 */
export function rowNumber(
  bind: AST.TermVariable,
  subquery: PatternGroupInput<QleverPatternInput>,
  options: RowNumberOptions = {}
): QleverPatternInput {
  checkVariable(feature, 'bind', bind, true);
  checkInteger(feature, 'offset', options.offset, 0);
  const pairs: Pair[] = [[rn('bind'), bind]];
  if (options.offset !== undefined) pairs.push([rn('offset'), options.offset]);
  return qleverPattern(
    'qleverRowNumber',
    service<QleverPatternInput>(rn(''), configuration(pairs), subquery),
    checkSubquery(bind)
  );
}
