import {
  IriTerm,
  QuadTerm,
  VariableTerm,
  DescribeQuery,
  SparqlClient,
  FactoryFunctions,
} from '../generic.js';
import * as SparqlJs from 'sparqljs';
import { QueryBuilderBase } from './query.js';

export type DescribeVariables = (VariableTerm | IriTerm)[];

export class DescribeQueryBuilderBase
  extends QueryBuilderBase<DescribeQuery, QuadTerm[]>
  implements PromiseLike<QuadTerm[]>
{
  constructor(
    variables: DescribeVariables,
    prefixes: DescribeQuery['prefixes'],
    base: string | undefined,
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string
  ) {
    super(
      {
        type: 'query',
        queryType: 'DESCRIBE',
        variables: variables.length !== 0 ? variables : [new SparqlJs.Wildcard()],
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
