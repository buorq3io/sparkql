import { QueryBuilderBase } from './query.js';
import { Triple, QuadTerm, SparqlClient, ConstructQuery, FactoryFunctions } from '../generic.js';

export type ConstructTemplates = Triple[];

export class ConstructQueryBuilderBase
  extends QueryBuilderBase<ConstructQuery, QuadTerm[]>
  implements PromiseLike<QuadTerm[]>
{
  constructor(
    variables: ConstructTemplates,
    prefixes: ConstructQuery['prefixes'],
    base: string | undefined,
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string
  ) {
    super(
      {
        type: 'query',
        queryType: 'CONSTRUCT',
        template: variables.length !== 0 ? variables : undefined,
        base: base,
        prefixes: prefixes,
      },
      factoryFunctions,
      endpointUrl
    );
  }

  protected async makeQuery(client: SparqlClient): Promise<QuadTerm[]> {
    const stream = client.query.construct(this.toSPARQL());

    const items: QuadTerm[] = [];
    for await (const binding of stream) {
      items.push(binding);
    }
    return items;
  }
}
