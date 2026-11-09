import type {
  QuadsInput,
  QueryDescribeInput,
  TermIriInput,
  TermVariableInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { QueryBuilderBase } from './query.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';

export class DescribeQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect>
  extends QueryBuilderBase<QueryDescribeInput, QuadsInput[], false, D>
  implements PromiseLike<QuadsInput[]>
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

  protected async makeQuery(session: SparqlSession): Promise<QuadsInput[]> {
    // The declared result type predates sessions; the values are RDF/JS quads.
    return (await session.quads(this.toSPARQL())) as unknown as QuadsInput[];
  }
}
