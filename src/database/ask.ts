import { QueryBuilderBase } from './query.js';
import { FactoryFunctions, QueryAskInput, SparqlClient } from '../helpers/types.js';

export class AskQueryBuilderBase
  extends QueryBuilderBase<QueryAskInput, boolean>
  implements PromiseLike<boolean>
{
  constructor(
    context: QueryAskInput['context'],
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string
  ) {
    super(
      {
        type: "query",
        subType: "ask",
        context: context,
        datasets: {
          type: "datasetClauses",
          clauses: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        solutionModifiers: {},
        where: {
          type: "pattern",
          subType: "group",
          patterns: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        loc: {
          sourceLocationType: 'autoGenerate',
        },

      },
      factoryFunctions,
      endpointUrl
    );
  }

  protected async makeQuery(client: SparqlClient): Promise<boolean> {
    return client.query.ask(this.toSPARQL());
  }
}
