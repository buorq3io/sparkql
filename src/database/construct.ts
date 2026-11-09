import type {
  FactoryFunctions,
  PatternBgpInput,
  QuadsInput,
  QueryConstructInput,
  SparqlClient,
} from '../helpers/types.js';
import { bgp } from '../structures/index.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { QueryBuilderBase } from './query.js';

export class ConstructQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect>
  extends QueryBuilderBase<QueryConstructInput, QuadsInput[], false, D>
  implements PromiseLike<QuadsInput[]>
{
  constructor(
    template: PatternBgpInput[],
    context: QueryConstructInput['context'],
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string,
    dialect?: D
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
        template: bgp(...template.flatMap(t => t.triples)),
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

  protected async makeQuery(client: SparqlClient): Promise<QuadsInput[]> {
    const stream = client.query.construct(this.toSPARQL());

    const items: QuadsInput[] = [];
    for await (const binding of stream) {
      items.push(binding);
    }
    return items;
  }
}
