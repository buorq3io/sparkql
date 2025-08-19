import {
  Triple,
  QuadTerm,
  SparqlClient,
  ConstructQuery,
  FactoryFunctions,
} from '../generic.js';
import { QueryBuilderBase } from './query.js';

export type ConstructTemplates = Triple[];

export class ConstructQueryBuilderBase
  extends QueryBuilderBase<ConstructQuery, QuadTerm[]>
  implements PromiseLike<QuadTerm[]>
{
  constructor(
    variables: ConstructTemplates,
    prefixes: ConstructQuery['prefixes'],
    base: string | undefined,
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
                  subject: this.sanitizeTerm(t.subject),
                  object: this.sanitizeTerm(t.object),
                };
              })
            : undefined,
        base: base,
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
