import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import {
  QuadsInput,
  SparqlClient,
  TermIriInput,
  FactoryFunctions,
  TermVariableInput,
  QueryDescribeInput,
} from '../helpers/types.js';
import { QueryBuilderBase } from './query.js';

export class DescribeQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect>
  extends QueryBuilderBase<QueryDescribeInput, QuadsInput[], false, D>
  implements PromiseLike<QuadsInput[]>
{
  constructor(
    variables: (TermVariableInput | TermIriInput)[],
    context: QueryDescribeInput['context'],
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string,
    dialect?: D
  ) {
    super(
      {
        type: 'query',
        subType: 'describe',
        context: context,
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
      factoryFunctions,
      endpointUrl,
      dialect
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
