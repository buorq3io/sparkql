import type * as AST from '@traqula/rules-sparql-1-1';
import type { SparqlDialect } from '../database/dialect.js';
import { generateSparql } from '../database/generator.js';
import {
  ModuleQueryBuilder,
  type QueryModule,
  type QueryModuleContext,
} from '../database/query-module.js';
import type { SparqlBindings } from '../database/session.js';
import { ONTO_NAMESPACE, ontoIri } from './graphs.js';

/** How GraphDB reports on a query: `explain` only plans it, `measure` also runs it. */
export type ExplainMode = 'explain' | 'measure';

/** A SELECT query to explain: anything `db.select()` builds, before or after its clauses. */
export interface ExplainableQuery {
  /** Returns the normalized SELECT query. */
  readonly getSPARQL: () => AST.QuerySelect;
}

interface ExplainConfig {
  query: ExplainableQuery;
  mode: ExplainMode;
}

/**
 * Decodes the bindings GraphDB returns for an explained query into the plan text.
 *
 * GraphDB returns the plan as literal bindings in place of the query's solutions. The literals
 * of every row are joined with newlines, so the decoder does not depend on the variable name.
 *
 * @param rows - Bindings of the explained query's response.
 * @throws When the response holds no literal.
 *
 * @example
 * Decode a response with one plan literal.
 *
 * ```ts
 * import { decodeExplainPlan } from 'sparkql/graphdb';
 * import { DataFactory } from 'rdf-data-factory';
 *
 * const factory = new DataFactory();
 * decodeExplainPlan([{ plan: factory.literal('----- Begin optimization group 1 -----') }]);
 * // '----- Begin optimization group 1 -----'
 * ```
 */
export function decodeExplainPlan(rows: readonly SparqlBindings[]): string {
  const lines = rows.flatMap(row =>
    Object.values(row).flatMap(term => (term?.termType === 'Literal' ? [term.value] : []))
  );
  if (lines.length === 0) throw new Error('GraphDB returned no query plan.');
  return lines.join('\n');
}

const explainModule: QueryModule<ExplainConfig, AST.QuerySelect, string, SparqlDialect> = {
  normalize: ({ query, mode }) => {
    const ast = query.getSPARQL();
    return {
      ...ast,
      datasets: {
        ...ast.datasets,
        clauses: [
          { clauseType: 'default', value: ontoIri(`${ONTO_NAMESPACE}${mode}`) },
          ...ast.datasets.clauses,
        ],
      },
    };
  },
  generate: ast => generateSparql(ast),
  execute: async (sparql, session) => decodeExplainPlan(await session.bindings(sparql)),
};

/**
 * Builder for a GraphDB explain or measure query, created by `db.explain()` or `db.measure()`.
 *
 * It prints the wrapped SELECT with `FROM onto:explain` or `FROM onto:measure` added before its
 * other dataset clauses, and awaiting it resolves to the plan text.
 */
export class ExplainQueryBuilder extends ModuleQueryBuilder<
  ExplainConfig,
  AST.QuerySelect,
  string,
  SparqlDialect
> {
  constructor(
    query: ExplainableQuery,
    mode: ExplainMode,
    context: QueryModuleContext<SparqlDialect>
  ) {
    super({ query, mode }, explainModule, context);
  }
}

/** Factories for the GraphDB database methods `db.explain()` and `db.measure()`. */
export const graphdbQueries = {
  /**
   * Asks GraphDB how it would evaluate a SELECT query, without running it.
   *
   * The query is sent with `FROM onto:explain` added before its dataset clauses. GraphDB then
   * returns its plan instead of the solutions: the join order and, for each pattern, the
   * collection sizes and estimated iterations. Awaiting the builder resolves to that plan as
   * text. The wrapped query's `.comment()` lines are not copied; add comments to the returned
   * builder. See [Explain plan](https://graphdb.ontotext.com/documentation/11.5/explain-plan.html).
   *
   * @param query - The SELECT query to explain.
   *
   * @example
   * See how GraphDB plans a query for people's names.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/graphdb';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const names = db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
   * const plan = await db.explain(names);
   * // '----- Begin optimization group 1 -----\n...'
   * ```
   *
   * ```sparql
   * SELECT ?name FROM <http://www.ontotext.com/explain> WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  explain:
    (context: QueryModuleContext<SparqlDialect>) =>
    (query: ExplainableQuery): ExplainQueryBuilder =>
      new ExplainQueryBuilder(query, 'explain', context),
  /**
   * Runs a SELECT query in GraphDB and reports its plan with the measured iterations and
   * timings of each step.
   *
   * Like {@link graphdbQueries.explain}, but with `FROM onto:measure`, so GraphDB evaluates the
   * query and the plan shows actual numbers instead of estimates. Awaiting the builder resolves
   * to the plan text, not the query's solutions.
   *
   * @param query - The SELECT query to measure.
   *
   * @example
   * Measure a query for people's names.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/graphdb';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const names = db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
   * const plan = await db.measure(names);
   * ```
   *
   * ```sparql
   * SELECT ?name FROM <http://www.ontotext.com/measure> WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  measure:
    (context: QueryModuleContext<SparqlDialect>) =>
    (query: ExplainableQuery): ExplainQueryBuilder =>
      new ExplainQueryBuilder(query, 'measure', context),
};
