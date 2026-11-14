import type * as AST from '@traqula/rules-sparql-1-1';
import type { SparqlDialect } from '../database/dialect.js';
import { SparkqlError, SparqlResponseError } from '../database/errors.js';
import { generateSparql } from '../database/generator.js';
import {
  ModuleQueryBuilder,
  type QueryModule,
  type QueryModuleContext,
} from '../database/query-module.js';

/**
 * How much RDF4J reports about a query plan:
 *
 * - `'Unoptimized'`: the plan as parsed, before optimization. The query does not run.
 * - `'Optimized'`: the plan RDF4J would run, with estimated result sizes. The query does not run.
 * - `'Executed'`: runs the query and adds the actual result size of each step.
 * - `'Timed'`: like `'Executed'`, plus the time spent in each step.
 * - `'Telemetry'`: like `'Timed'`, plus call counts and other runtime counters (RDF4J 6).
 */
export type ExplainLevel = 'Unoptimized' | 'Optimized' | 'Executed' | 'Timed' | 'Telemetry';

const levels: readonly string[] = ['Unoptimized', 'Optimized', 'Executed', 'Timed', 'Telemetry'];

/** A query to explain: anything `db.select()`, `db.ask()`, `db.construct()` or `db.describe()` builds. */
export interface ExplainableQuery {
  /** Returns the normalized query. */
  readonly getSPARQL: () => AST.Query;
}

interface ExplainConfig {
  query: ExplainableQuery;
  level: ExplainLevel;
}

/** The module for one explain level; `execute` receives no configuration, so the level is bound here. */
function explainModule(
  level: ExplainLevel
): QueryModule<ExplainConfig, AST.Query, string, SparqlDialect> {
  return {
    normalize: ({ query }) => {
      const ast = query.getSPARQL();
      if (ast.type !== 'query') {
        throw new SparkqlError({ message: 'RDF4J explains queries, not updates.' });
      }
      return ast;
    },
    generate: ast => generateSparql(ast),
    execute: async (sparql, session) => {
      const response = await session.raw(sparql, {
        accept: 'text/plain',
        parameters: { explain: level },
      });
      if (!response.ok) {
        throw new SparqlResponseError({
          status: response.status,
          statusText: response.statusText,
          body: await response.text().catch(() => ''),
        });
      }
      return response.text();
    },
  };
}

/**
 * Builder for an RDF4J query plan, created by `db.explain()`.
 *
 * It prints the wrapped query unchanged; awaiting it sends the query with RDF4J's `explain`
 * parameter and resolves to the plan as text.
 */
export class ExplainQueryBuilder extends ModuleQueryBuilder<
  ExplainConfig,
  AST.Query,
  string,
  SparqlDialect
> {
  constructor(
    query: ExplainableQuery,
    level: ExplainLevel,
    context: QueryModuleContext<SparqlDialect>
  ) {
    if (!levels.includes(level)) {
      throw new SparkqlError({
        message: `Unknown RDF4J explain level "${String(level)}"; use ${levels.join(', ')}.`,
      });
    }
    super({ query, level }, explainModule(level), context);
  }
}

/** Factories for the RDF4J database method `db.explain()`. */
export const rdf4jQueries = {
  /**
   * Asks RDF4J for its plan of a query, as text.
   *
   * The query is sent as it is, with the `explain` request parameter of RDF4J's REST API.
   * RDF4J then returns the plan instead of the results: the tree of operators with estimated
   * result sizes, and from `'Executed'` on the actual sizes and timings from
   * running the query. The plan's layout is RDF4J's and is not parsed. The wrapped query's
   * `.comment()` lines are not copied; add comments to the returned builder. See
   * [Explaining queries](https://rdf4j.org/documentation/programming/repository/).
   *
   * Explain needs the query sent over HTTP with extra URL parameters, so it works with the
   * built-in session; a custom session must support `parameters` in `raw()`.
   *
   * @param query - The SELECT, ASK, CONSTRUCT or DESCRIBE query to explain.
   * @param level - How much to report. Defaults to `'Optimized'`, which does not run the query.
   * @throws {@link SparkqlError} When `level` is not an {@link ExplainLevel}.
   *
   * @example
   * See how RDF4J plans a query for people's names, then run it to see the actual sizes.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/rdf4j';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const names = db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
   * const plan = await db.explain(names);
   * // 'Projection\n   ProjectionElemList\n...'
   * const measured = await db.explain(names, 'Executed');
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  explain:
    (context: QueryModuleContext<SparqlDialect>) =>
    (query: ExplainableQuery, level: ExplainLevel = 'Optimized'): ExplainQueryBuilder =>
      new ExplainQueryBuilder(query, level, context),
};
