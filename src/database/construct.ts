import { QueryBuilderBase } from './query.js';
import {
  BasicGraphPatternInput,
  FactoryFunctions,
  QuadsInput,
  QueryConstructInput,
  SparqlClient,
} from '../helpers/types.js';

export class ConstructQueryBuilderBase
  extends QueryBuilderBase<QueryConstructInput, QuadsInput[]>
  implements PromiseLike<QuadsInput[]>
{
  constructor(
    variables: BasicGraphPatternInput,
    context: QueryConstructInput['context'],
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string
  ) {
    super(
      {
        type: 'query',
        subType: 'construct',
        context: context,
        datasets: {
          type: 'datasetClauses',
          clauses: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        solutionModifiers: {},
        template: {
          type: 'pattern',
          subType: 'bgp',
          triples: variables,
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
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
      endpointUrl
    );
  }

  protected async makeQuery(client: SparqlClient): Promise<QuadsInput[]> {
    const stream = client.query.construct(this.toSPARQL());

    const items: QuadsInput[] = [];
    for await (const binding of stream) {
      items.push(binding);
    }
    return items;
  }
}
