import { QueryBuilderBase } from './query';
import { AskQuery, DataFactory, FactoryFunctions, SparqlClient } from '../generic';

export class AskQueryBuilderBase
  extends QueryBuilderBase<AskQuery, boolean>
  implements PromiseLike<boolean>
{
  constructor(prefixes: AskQuery['prefixes'], factoryFunctions: FactoryFunctions) {
    super(
      {
        type: 'query',
        queryType: 'ASK',
        prefixes: prefixes,
      },
      factoryFunctions
    );
  }

  protected async makeQuery(client: SparqlClient): Promise<boolean> {
    return client.query.ask(this.toSPARQL());
  }
}
