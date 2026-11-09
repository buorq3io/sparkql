import type { PatternBgpInput, QuadsInput, QueryConstructInput } from '../helpers/types.js';
import { bgp } from '../structures/index.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { QueryBuilderBase } from './query.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';

export class ConstructQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect>
  extends QueryBuilderBase<QueryConstructInput, QuadsInput[], false, D>
  implements PromiseLike<QuadsInput[]>
{
  constructor(context: QueryModuleContext<D>, template: PatternBgpInput[]) {
    super(
      {
        type: 'query',
        subType: 'construct',
        context: [...context.context],
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
      context
    );
  }

  protected async makeQuery(session: SparqlSession): Promise<QuadsInput[]> {
    // The declared result type predates sessions; the values are RDF/JS quads.
    return (await session.quads(this.toSPARQL())) as unknown as QuadsInput[];
  }
}
