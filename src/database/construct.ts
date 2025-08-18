import { QueryBuilderBase } from './query';
import { ConstructQuery, QuadTerm, Triple, SparqlClient, DataFactory, FactoryFunctions } from '../generic';

export type ConstructTemplates = Triple[];

export class ConstructQueryBuilderBase
  extends QueryBuilderBase<ConstructQuery, QuadTerm[]>
  implements PromiseLike<QuadTerm[]>
{
  constructor(
    variables: ConstructTemplates,
    prefixes: ConstructQuery['prefixes'],
    factoryFunctions: FactoryFunctions
  ) {
    super(
      {
        type: 'query',
        queryType: 'CONSTRUCT',
        template:
          variables.length !== 0
            ? variables.map(t => {
                return {
                  ...t,
                  object: this.sanitizeTerm(t.object),
                };
              })
            : undefined,
        prefixes: prefixes,
      },
      factoryFunctions
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
