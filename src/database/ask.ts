import type { QueryAskInput } from '../helpers/types.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { QueryBuilderBase } from './query.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';

export class AskQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect>
  extends QueryBuilderBase<QueryAskInput, boolean, false, D>
  implements PromiseLike<boolean>
{
  constructor(context: QueryModuleContext<D>) {
    super(
      {
        type: 'query',
        subType: 'ask',
        context: [...context.context],
        datasets: {
          type: 'datasetClauses',
          clauses: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        solutionModifiers: {},
        where: {
          type: 'pattern',
          subType: 'group',
          patterns: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      },
      context
    );
  }

  protected makeQuery(session: SparqlSession, sparql: string): Promise<boolean> {
    return session.boolean(sparql);
  }
}
