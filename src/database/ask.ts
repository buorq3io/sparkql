import { QueryBuilderBase } from './query';
import { AskQuery, SparqlClient } from '../generic';

export class AskQueryBuilderBase
  extends QueryBuilderBase<AskQuery, boolean>
  implements PromiseLike<boolean>
{
  constructor(prefixes: AskQuery['prefixes']) {
    super({
      type: 'query',
      queryType: 'ASK',
      prefixes: prefixes,
    });
  }

  protected async makeQuery(client: SparqlClient): Promise<boolean> {
    return client.query.ask(this.toSPARQL());
  }
}
