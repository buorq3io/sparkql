import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExtensionPattern } from '../database/dialect.js';
import { SparkqlError } from '../database/errors.js';

/** The namespace of Neptune query hints, written `hint:` in Neptune's documentation. */
export const NEPTUNE_HINT_NAMESPACE = 'http://aws.amazon.com/neptune/vocab/v01/QueryHints#';

/**
 * Neptune SPARQL query hints that {@link queryHint} can add, with the scopes each hint may
 * use and its allowed values.
 *
 * The scope is the subject of the hint triple: `Query` applies to the whole query, `Group` to
 * the top-level elements of the group the hint is in, `SubQuery` to the subquery the hint is
 * in, and `Prior` to the pattern just before the hint.
 */
export interface NeptuneQueryHints {
  /** Evaluates joins in the order they are written instead of letting Neptune reorder them. */
  joinOrder: { scope: 'Query' | 'Group'; value: 'Ordered' };
  /** Evaluates a subquery on its own, bottom up, and keeps its solutions in memory. */
  evaluationStrategy: { scope: 'SubQuery'; value: 'BottomUp' };
  /**
   * Timeout in milliseconds. It must be less than the `neptune_query_timeout` parameter, and
   * may be set only once per request.
   */
  queryTimeout: { scope: 'Query'; value: number };
  /** Whether numeric filters skip type promotion. Neptune's default is `false`. */
  rangeSafe: { scope: 'Query' | 'Prior'; value: boolean };
  /** An ID for the query, unique across the queries running on the cluster. */
  queryId: { scope: 'Query'; value: string };
  /** Whether the query runs on the DFE engine. */
  useDFE: { scope: 'Query'; value: boolean };
  /** How `DESCRIBE` selects statements. Neptune's default is `SymmetricOneStep`. */
  describeMode: {
    scope: 'Query';
    value: 'ForwardOneStep' | 'SymmetricOneStep' | 'CBD' | 'SCBD';
  };
  /** Iteration limit for the `CBD` and `SCBD` describe modes; `0` means no limit. */
  describeIterationLimit: { scope: 'Query'; value: number };
  /** Statement limit for the `CBD` and `SCBD` describe modes; `0` means no limit. */
  describeStatementLimit: { scope: 'Query'; value: number };
}

/** A Neptune query hint name. */
export type NeptuneHintName = keyof NeptuneQueryHints;

/** A Neptune query hint pattern, as {@link queryHint} returns it. */
export interface NeptuneHintInput<K extends NeptuneHintName = NeptuneHintName>
  extends ExtensionPattern {
  /** Identifies the node as a Neptune query hint. */
  subType: 'neptuneHint';
  /** Where the hint applies. */
  scope: NeptuneQueryHints[K]['scope'];
  /** Hint name. */
  name: K;
  /** Hint value. */
  value: NeptuneQueryHints[K]['value'];
}

const isNonNegativeInteger = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const isOneOf =
  (...allowed: readonly unknown[]) =>
  (value: unknown) =>
    allowed.includes(value);

const rules: {
  [K in NeptuneHintName]: {
    scopes: readonly NeptuneQueryHints[K]['scope'][];
    accepts(value: unknown): boolean;
  };
} = {
  joinOrder: { scopes: ['Query', 'Group'], accepts: isOneOf('Ordered') },
  evaluationStrategy: { scopes: ['SubQuery'], accepts: isOneOf('BottomUp') },
  queryTimeout: { scopes: ['Query'], accepts: isNonNegativeInteger },
  rangeSafe: { scopes: ['Query', 'Prior'], accepts: isOneOf(true, false) },
  queryId: { scopes: ['Query'], accepts: value => typeof value === 'string' && value !== '' },
  useDFE: { scopes: ['Query'], accepts: isOneOf(true, false) },
  describeMode: {
    scopes: ['Query'],
    accepts: isOneOf('ForwardOneStep', 'SymmetricOneStep', 'CBD', 'SCBD'),
  },
  describeIterationLimit: { scopes: ['Query'], accepts: isNonNegativeInteger },
  describeStatementLimit: { scopes: ['Query'], accepts: isNonNegativeInteger },
};

const loc = { sourceLocationType: 'autoGenerate' } as const;

/**
 * Adds a Neptune query hint to the enclosing group pattern.
 *
 * A hint is the triple `hint:<scope> hint:<name> <value>`, written with full IRIs so the
 * query needs no prefix declaration. Neptune reads hints where they appear: put a `Query` hint
 * in the main `WHERE` clause, a `SubQuery` hint inside the subquery, and a `Prior` hint right
 * after the pattern it applies to. Only databases created from `sparkql/neptune` accept it.
 * Other stores would treat it as an ordinary triple pattern and find no solutions.
 *
 * Neptune treats hints as advice and may ignore them. See the
 * [Neptune query hint reference](https://docs.aws.amazon.com/neptune/latest/userguide/sparql-query-hints.html).
 *
 * @param scope - Where the hint applies.
 * @param name - Hint name.
 * @param value - Value for the hint. Numbers are written as `xsd:integer` and booleans as
 * `xsd:boolean`.
 * @throws {@link SparkqlError} When the hint, scope or value is unsupported, which only
 * untyped (JavaScript or `any`) callers or invalid numbers can reach.
 *
 * @example
 * Find people who know each other, joining the patterns in the order written.
 *
 * ```ts
 * import { queryHint, SparqlDatabase, triples } from 'sparkql/neptune';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const friends = db
 *   .select({ name: v.name, friend: v.friend })
 *   .where(
 *     queryHint('Query', 'joinOrder', 'Ordered'),
 *     triples(v.person, n.foaf.name, v.name),
 *     triples(v.person, n.foaf.knows, v.friend)
 *   );
 * ```
 *
 * ```sparql
 * SELECT ?name ?friend WHERE {
 *   <http://aws.amazon.com/neptune/vocab/v01/QueryHints#Query> <http://aws.amazon.com/neptune/vocab/v01/QueryHints#joinOrder> "Ordered" .
 *   ?person foaf:name ?name .
 *   ?person foaf:knows ?friend .
 * }
 * ```
 */
export function queryHint<K extends NeptuneHintName>(
  scope: NeptuneQueryHints[K]['scope'],
  name: K,
  value: NeptuneQueryHints[K]['value']
): NeptuneHintInput<K> {
  // Validate at runtime too, for JavaScript callers and values from outside TypeScript.
  const rule = Object.keys(rules).includes(name) ? rules[name] : undefined;
  if (!rule) {
    throw new SparkqlError({ message: `Unsupported Neptune query hint: ${String(name)}.` });
  }
  if (!(rule.scopes as readonly string[]).includes(scope)) {
    throw new SparkqlError({
      message: `Neptune query hint ${name} does not support the ${String(scope)} scope.`,
    });
  }
  if (!rule.accepts(value)) {
    throw new SparkqlError({ message: `Unsupported value for Neptune query hint ${name}.` });
  }
  return { type: 'pattern', subType: 'neptuneHint', loc, scope, name, value };
}

/** @internal Returns whether a value is a Neptune query hint pattern. */
export function isNeptuneHint(value: unknown): value is NeptuneHintInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'pattern' &&
    'subType' in value &&
    value.subType === 'neptuneHint'
  );
}

/** @internal The IRI of a scope or hint name in the Neptune hint namespace. */
export function neptuneHintIri(local: string): URL {
  return new URL(`${NEPTUNE_HINT_NAMESPACE}${local}`);
}

/** @internal The normalized form of a hint: a basic graph pattern holding its triple. */
export type NeptuneHintAST = AST.PatternBgp;

/** Neptune query hint helpers, also available as `neptuneDialect.hints`. */
export const neptuneHints = { queryHint } as const;
