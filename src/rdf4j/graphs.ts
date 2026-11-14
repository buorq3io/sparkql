import type * as AST from '@traqula/rules-sparql-1-1';

/** The namespace of RDF4J's own schema, written `rdf4j:`. */
export const RDF4J_NAMESPACE = 'http://rdf4j.org/schema/rdf4j#';

/**
 * RDF4J's name for the statements stored outside every named graph: `rdf4j:nil`.
 *
 * In RDF4J the default graph of a query is the union of all graphs. Use `rdf4jNil` with
 * `.from()` to query only the statements without a graph, or with {@link graph} to match them
 * inside a `GRAPH` pattern. RDF4J also accepts the older `sesame:nil` for the same graph.
 *
 * @example
 * List the names that are not in a named graph.
 *
 * ```ts
 * import { SparqlDatabase, rdf4jNil, triples } from 'sparkql/rdf4j';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * db.select({ name: v.name }).from(rdf4jNil).where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name FROM <http://rdf4j.org/schema/rdf4j#nil> WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export const rdf4jNil: AST.TermIri = Object.freeze({
  type: 'term',
  subType: 'namedNode',
  loc: { sourceLocationType: 'autoGenerate' },
  value: `${RDF4J_NAMESPACE}nil`,
}) as AST.TermIri;
