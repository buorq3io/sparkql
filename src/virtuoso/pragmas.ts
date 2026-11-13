import { SparkqlError } from '../database/errors.js';
import { escapeIri } from '../database/generator.js';
import type { DefineInput } from './types.js';

/**
 * Virtuoso `DEFINE` pragmas that {@link define} can add, with their value types.
 *
 * A `URL` value prints as an IRI, a string as a quoted string and a number as an integer. The
 * `output:format` family is left out, because sparkql decodes standard result formats only.
 * See [SPARQL pragmas](https://docs.openlinksw.com/virtuoso/rdfsparqlimplementatioptragmas/).
 */
export interface VirtuosoPragmas {
  /** Name of the inference rule set to apply, as created with `rdfs_rule_set`. */
  'input:inference': string;
  /** Expands `owl:sameAs` equivalences; Virtuoso users usually pass `'yes'`. */
  'input:same-as': string;
  /** Adds a default graph, like `FROM`. */
  'input:default-graph-uri': string | URL;
  /** Adds a named graph, like `FROM NAMED`. */
  'input:named-graph-uri': string | URL;
  /** Leaves a graph out of the default graphs. */
  'input:default-graph-exclude': string | URL;
  /** Leaves a graph out of the named graphs. */
  'input:named-graph-exclude': string | URL;
  /** Quad storage to query; `''` uses only RDF views. */
  'input:storage': string | URL;
  /** Variable whose IRI values Virtuoso dereferences while querying, such as `'?person'`. */
  'input:grab-var': string;
  /** IRI that Virtuoso dereferences before querying. */
  'input:grab-iri': string | URL;
  /** Dereferences every IRI found while querying; usually `'yes'`. */
  'input:grab-all': string;
  /** Predicate whose objects are dereferenced, such as `rdfs:seeAlso`. */
  'input:grab-seealso': string | URL;
  /** Maximum number of resources to dereference. */
  'input:grab-limit': number;
  /** Maximum depth of dereferencing. */
  'input:grab-depth': number;
  /** Base IRI for resolving relative IRIs of dereferenced resources. */
  'input:grab-base': string | URL;
  /** Graph that receives the dereferenced data. */
  'input:grab-destination': string | URL;
  /** How dereferenced graphs are loaded: kept (`soft`) or replaced (`replacing`). */
  'get:soft': 'soft' | 'replacing';
  /** HTTP method for dereferencing. */
  'get:method': 'GET' | 'MGET';
  /** Transaction log mode of the generated SQL, such as `2` for autocommit without logging. */
  'sql:log-enable': number;
  /** Text added to the `TABLE OPTION` clause of each triple, such as `'ORDER'`. */
  'sql:table-option': string;
  /** Text added to the global SQL `OPTION` clause, such as `'ORDER'`. */
  'sql:select-option': string;
  /** How `DESCRIBE` selects statements, such as `'SPO'` or `'CBD'`. */
  'sql:describe-mode': 'SPO' | 'CBD' | (string & {});
  /** Whether variables that can never be bound raise an error (`1`) or not (`0`). */
  'sql:signal-void-variables': number;
  /** Whether constants are compiled into the plan (`1`) or passed as parameters (`0`). */
  'sql:big-data-const': number;
  /** Maximum number of result rows. */
  'output:maxrows': number;
}

/** A Virtuoso pragma name. */
export type VirtuosoPragmaName = keyof VirtuosoPragmas;

const isString = (value: unknown) => typeof value === 'string';
const isIriOrString = (value: unknown) => typeof value === 'string' || value instanceof URL;
const isInteger = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const isOneOf =
  (...allowed: readonly string[]) =>
  (value: unknown) =>
    allowed.includes(value as string);

const rules: { [K in VirtuosoPragmaName]: (value: unknown) => boolean } = {
  'input:inference': isString,
  'input:same-as': isString,
  'input:default-graph-uri': isIriOrString,
  'input:named-graph-uri': isIriOrString,
  'input:default-graph-exclude': isIriOrString,
  'input:named-graph-exclude': isIriOrString,
  'input:storage': isIriOrString,
  'input:grab-var': isString,
  'input:grab-iri': isIriOrString,
  'input:grab-all': isString,
  'input:grab-seealso': isIriOrString,
  'input:grab-limit': isInteger,
  'input:grab-depth': isInteger,
  'input:grab-base': isIriOrString,
  'input:grab-destination': isIriOrString,
  'get:soft': isOneOf('soft', 'replacing'),
  'get:method': isOneOf('GET', 'MGET'),
  'sql:log-enable': isInteger,
  'sql:table-option': isString,
  'sql:select-option': isString,
  'sql:describe-mode': isString,
  'sql:signal-void-variables': isInteger,
  'sql:big-data-const': isInteger,
  'output:maxrows': isInteger,
};

const loc = { sourceLocationType: 'autoGenerate' } as const;

/**
 * Adds a Virtuoso `DEFINE` pragma to a query or update.
 *
 * Place it in the outermost `WHERE` clause. The Virtuoso generator moves it out of the
 * pattern and prints `DEFINE name value` before the prologue, where Virtuoso requires it.
 * Pragmas anywhere else, such as in a subquery or an `OPTIONAL`, are refused when the query is
 * generated. Only databases created from `sparkql/virtuoso` accept it.
 *
 * @param name - Pragma name.
 * @param value - Pragma value: a `URL` prints as an IRI, a string as a quoted string and a
 * number as an integer.
 * @throws {@link SparkqlError} When the pragma or value is unsupported, which only untyped
 * (JavaScript or `any`) callers or invalid numbers can reach.
 *
 * @example
 * Find each person's types, including those inferred with the `people-rules` rule set.
 *
 * ```ts
 * import { define, SparqlDatabase, triples } from 'sparkql/virtuoso';
 *
 * const prefixes = { rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const types = db
 *   .select({ person: v.person, type: v.type })
 *   .where(define('input:inference', 'people-rules'), triples(v.person, n.rdf.type, v.type));
 * ```
 *
 * ```sparql
 * DEFINE input:inference "people-rules"
 * SELECT ?person ?type WHERE {
 *   ?person rdf:type ?type .
 * }
 * ```
 */
export function define<K extends VirtuosoPragmaName>(
  name: K,
  value: VirtuosoPragmas[K]
): DefineInput<K> {
  // Validate at runtime too, for JavaScript callers and values from outside TypeScript.
  const accepts = Object.keys(rules).includes(name) ? rules[name] : undefined;
  if (!accepts) {
    throw new SparkqlError({ message: `Unsupported Virtuoso pragma: ${String(name)}.` });
  }
  if (!accepts(value)) {
    throw new SparkqlError({ message: `Unsupported value for Virtuoso pragma ${name}.` });
  }
  return { type: 'pattern', subType: 'virtuosoDefine', loc, name, value };
}

/** @internal Prints a pragma value: an IRI, a quoted string or an integer. */
export function printPragmaValue(value: string | number | URL): string {
  if (value instanceof URL) return `<${escapeIri(value.href)}>`;
  if (typeof value === 'number') return String(value);
  const escaped = value.replace(/[\\"\n\r\t]/g, char =>
    char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : `\\${char}`
  );
  return `"${escaped}"`;
}
