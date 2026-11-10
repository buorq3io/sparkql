import { count, countDistinct } from '../functions/aggregate.js';
import type { PatternInput, QuerySelectInput, TermVariableInput } from '../helpers/types.js';
import { as, transformNumber } from '../structures/expression.js';
import { group } from '../structures/pattern.js';
import type { AnySparqlDialect, DialectPattern } from './dialect.js';
import { emptySelect, type QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';

/** Options for a count query. */
export interface CountOptions {
  /** Variable whose distinct bound values are counted. */
  distinct: TermVariableInput;
}

/** An executable COUNT query. SPARQL does not support scalar subquery expressions. Each await executes a new request. */
export class CountQueryBuilder<D extends AnySparqlDialect> extends SparqlQueryBuilderBase<
  QuerySelectInput,
  number,
  D
> {
  constructor(
    context: QueryModuleContext<D>,
    patterns: PatternInput<DialectPattern<D>>[],
    options?: CountOptions
  ) {
    super(
      {
        ...emptySelect(context.context),
        variables: [
          as(
            options ? countDistinct(options.distinct) : count(),
            context.factory.variable('count')
          ),
        ],
        where: group(...patterns) as QuerySelectInput['where'],
      },
      context
    );
  }

  protected async makeQuery(session: SparqlSession, sparql: string): Promise<number> {
    const rows = await session.bindings(sparql);
    const value = rows[0]?.count;
    return value ? transformNumber(value) : 0;
  }
}
