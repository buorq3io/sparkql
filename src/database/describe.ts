import type { QueryDescribeInput, TermIriInput, TermVariableInput } from '../helpers/types.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { QueryBuilderBase } from './query.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlQuad, SparqlSession } from './session.js';

/** Builds an executable `DESCRIBE` query returning RDF/JS quads. Each await executes a new request. */
export class DescribeQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect>
  extends QueryBuilderBase<QueryDescribeInput, SparqlQuad[], false, D>
  implements PromiseLike<SparqlQuad[]>
{
  constructor(context: QueryModuleContext<D>, variables: (TermVariableInput | TermIriInput)[]) {
    super(
      {
        type: 'query',
        subType: 'describe',
        context: [...context.context],
        datasets: {
          type: 'datasetClauses',
          clauses: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        solutionModifiers: {},
        variables: variables,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      },
      context
    );
  }

  protected async makeQuery(session: SparqlSession, sparql: string): Promise<SparqlQuad[]> {
    return session.quads(sparql);
  }
}
