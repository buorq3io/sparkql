import {
  IriTerm,
  QuadTerm,
  VariableTerm,
  DescribeQuery,
  SparqlClient,
} from '../generic';
import { Wildcard } from 'sparqljs';
import { QueryBuilderBase } from './query';

export type DescribeVariables = (VariableTerm | IriTerm)[];

export class DescribeQueryBuilderBase
  extends QueryBuilderBase<DescribeQuery, QuadTerm[]>
  implements PromiseLike<QuadTerm[]>
{
  constructor(
    variables: DescribeVariables,
    prefixes: DescribeQuery['prefixes']
  ) {
    super({
      type: 'query',
      queryType: 'DESCRIBE',
      variables: variables.length !== 0 ? variables : [new Wildcard()],
      prefixes: prefixes,
    });
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
