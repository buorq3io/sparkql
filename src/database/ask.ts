import { QueryBuilderBase } from './query.js';
import { AskQuery, FactoryFunctions, SparqlClient } from '../generic.js';

export class AskQueryBuilderBase
  extends QueryBuilderBase<AskQuery, boolean>
  implements PromiseLike<boolean>
{
  constructor(
    prefixes: AskQuery['prefixes'],
    base: string | undefined,
    factoryFunctions: FactoryFunctions
  ) {
    super(
      {
        type: 'query',
        queryType: 'ASK',
        base: base,
        prefixes: prefixes,
      },
      factoryFunctions
    );
  }

  protected async makeQuery(client: SparqlClient): Promise<boolean> {
    return client.query.ask(this.toSPARQL());
  }
}
