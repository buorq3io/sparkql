import { QueryBuilderBase } from './query';
import { AskQuery, DataFactory, SparqlClient } from '../generic';

export class AskQueryBuilderBase
  extends QueryBuilderBase<AskQuery, boolean>
  implements PromiseLike<boolean>
{
  constructor(prefixes: AskQuery['prefixes'], factory: DataFactory) {
    super(
      {
        type: 'query',
        queryType: 'ASK',
        prefixes: prefixes,
      },
      factory
    );
  }

  protected async makeQuery(client: SparqlClient): Promise<boolean> {
    return client.query.ask(this.toSPARQL());
  }
}
