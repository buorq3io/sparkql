import type * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';

/** The `onto:` namespace of GraphDB's pseudo-graphs. */
export const ONTO_NAMESPACE = 'http://www.ontotext.com/';

const loc = { sourceLocationType: 'autoGenerate' } as const;

/** @internal Creates a full IRI term. */
export function ontoIri(value: string): AST.TermIri {
  return Object.freeze({ type: 'term', subType: 'namedNode', loc, value }) as AST.TermIri;
}

/**
 * GraphDB pseudo-graphs that change which statements a query sees, for `.from()` and
 * `.fromNamed()`.
 *
 * They are not real graphs: GraphDB reads them as switches. In `FROM` they replace the default
 * graph with a filtered view of the database's default graph; in `FROM NAMED`, `explicit` and
 * `implicit` expose those statements under the pseudo-graph's name. Like any `FROM` clause, they
 * replace the default dataset. See
 * [Tuning query behavior](https://graphdb.ontotext.com/documentation/11.5/query-behavior.html).
 *
 * @example
 * List only the names stated in the data, not the inferred ones.
 *
 * ```ts
 * import { ontoGraphs, SparqlDatabase, triples } from 'sparkql/graphdb';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const names = db
 *   .select({ name: v.name })
 *   .from(ontoGraphs.explicit)
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name FROM <http://www.ontotext.com/explicit> WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export const ontoGraphs = Object.freeze({
  /** Only explicit (asserted) statements: `<http://www.ontotext.com/explicit>`. */
  explicit: ontoIri(`${ONTO_NAMESPACE}explicit`),
  /** Only implicit (inferred) statements: `<http://www.ontotext.com/implicit>`. */
  implicit: ontoIri(`${ONTO_NAMESPACE}implicit`),
  /**
   * Turns off the expansion of `owl:sameAs` equivalence classes, so each class is returned once:
   * `<http://www.ontotext.com/disable-sameAs>`.
   */
  disableSameAs: ontoIri(`${ONTO_NAMESPACE}disable-sameAs`),
  /**
   * Leaves out an implicit statement when the same statement is also explicit in that context:
   * `<http://www.ontotext.com/skip-redundant-implicit>`.
   */
  skipRedundantImplicit: ontoIri(`${ONTO_NAMESPACE}skip-redundant-implicit`),
});

/**
 * Returns the GraphDB history pseudo-graph that shows the data as it was at a point in time.
 *
 * Pass it to `.from()`. The timestamp is `yyyy[MM[dd[HH[mm[ss]]]]]`: a year, optionally followed
 * by month, day, hour, minute and second. GraphDB reads it in the server's time zone. Only
 * changes made while the history plugin was enabled are reflected; statements without history
 * are returned as they are. See
 * [Data history and versioning](https://graphdb.ontotext.com/documentation/11.5/data-history-and-versioning.html).
 *
 * @param timestamp - Point in time, such as `'20220712161717'` for 2022-07-12 16:17:17.
 * @throws {@link SparkqlError} When `timestamp` is not 4 to 14 digits in that format.
 *
 * @example
 * Read people's names as they were on 12 July 2022.
 *
 * ```ts
 * import { historyAt, SparqlDatabase, triples } from 'sparkql/graphdb';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const names = db
 *   .select({ name: v.name })
 *   .from(historyAt('20220712'))
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name FROM <http://www.ontotext.com/at/20220712> WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function historyAt(timestamp: string): AST.TermIri {
  if (typeof timestamp !== 'string' || !/^\d{4}(?:\d{2}){0,5}$/.test(timestamp)) {
    throw new SparkqlError({
      message: 'A GraphDB history timestamp must have the form yyyy[MM[dd[HH[mm[ss]]]]].',
    });
  }
  return ontoIri(`${ONTO_NAMESPACE}at/${timestamp}`);
}
