import type { FactoryFunctions, QueryAskInput, SparqlClient } from '../helpers/types.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { QueryBuilderBase } from './query.js';

export class AskQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect>
  extends QueryBuilderBase<QueryAskInput, boolean, false, D>
  implements PromiseLike<boolean>
{
  constructor(
    context: QueryAskInput['context'],
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string,
    dialect?: D
  ) {
    super(
      {
        type: 'query',
        subType: 'ask',
        context: context,
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
      factoryFunctions,
      endpointUrl,
      dialect
    );
  }

  protected async makeQuery(client: SparqlClient): Promise<boolean> {
    return client.query.ask(this.toSPARQL());
  }
}
