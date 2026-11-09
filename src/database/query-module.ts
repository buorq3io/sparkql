import type * as AST from '@traqula/rules-sparql-1-1';
import type {
  ContextDefinitionInput,
  ExpressionInput,
  FactoryFunctions,
  PathInput,
  PatternInput,
  QuadsInput,
  QuerySelectInput,
  SparqlClient,
} from '../helpers/types.js';
import type { AnySparqlDialect, DialectAST, DialectPattern } from './dialect.js';
import { QueryBuilderBase } from './query.js';
import { ExecutableQuery } from './executable.js';

/** Shared normalization with the same semantics as the standard builders. */
export class QueryNormalizer<D extends AnySparqlDialect> extends QueryBuilderBase<
  QuerySelectInput,
  never,
  false,
  D
> {
  constructor(input: QuerySelectInput, factory: FactoryFunctions, dialect: D) {
    super(input, factory, undefined, dialect);
  }
  pattern(value: PatternInput<DialectPattern<D>>): DialectAST<D, AST.Pattern> {
    return this.sanitizePattern(value as unknown as PatternInput) as unknown as DialectAST<
      D,
      AST.Pattern
    >;
  }
  expression(value: ExpressionInput): AST.Expression {
    return this.sanitizeExpression(value);
  }
  quads(value: QuadsInput): AST.Quads {
    return this.sanitizeQuads(value);
  }
  path(value: PathInput): AST.Path {
    return this.sanitizePropertyPath(value);
  }
  protected async makeQuery(): Promise<never> {
    throw new Error('A normalizer cannot execute queries.');
  }
}

export interface QueryModuleContext<D extends AnySparqlDialect = AnySparqlDialect> {
  readonly context: readonly ContextDefinitionInput[];
  readonly factory: FactoryFunctions;
  readonly dialect: D;
  readonly endpointUrl?: string;
  normalizer(input?: QuerySelectInput): QueryNormalizer<D>;
}

export function emptySelect(context: readonly ContextDefinitionInput[]): QuerySelectInput {
  const loc = { sourceLocationType: 'autoGenerate' } as const;
  return {
    type: 'query',
    subType: 'select',
    loc,
    context: [...context],
    variables: [{ type: 'wildcard', loc }],
    datasets: { type: 'datasetClauses', loc, clauses: [] },
    where: { type: 'pattern', subType: 'group', loc, patterns: [] },
    solutionModifiers: {},
  };
}

/** Each query form owns its AST, generation and result decoding. */
export interface QueryModule<Config, Ast, Result, D extends AnySparqlDialect = AnySparqlDialect> {
  normalize(config: Config, context: QueryModuleContext<D>): Ast;
  generate(ast: Ast, context: QueryModuleContext<D>): string;
  execute(sparql: string, client: SparqlClient, ast: Ast): Promise<Result>;
}

export abstract class ModuleQueryBuilder<
  Config,
  Ast,
  Result,
  D extends AnySparqlDialect
> extends ExecutableQuery<Result> {
  protected constructor(
    protected readonly config: Config,
    protected readonly module: QueryModule<Config, Ast, Result, D>,
    protected readonly moduleContext: QueryModuleContext<D>
  ) {
    super(moduleContext.endpointUrl);
  }

  public getSPARQL(): Ast {
    return this.module.normalize(this.config, this.moduleContext);
  }
  public toSPARQL(): string {
    return this.module.generate(this.getSPARQL(), this.moduleContext);
  }
  protected makeQuery(client: SparqlClient): Promise<Result> {
    const ast = this.getSPARQL();
    return this.module.execute(this.module.generate(ast, this.moduleContext), client, ast);
  }
}

/** Factory functions return the methods installed on a database instance. */
export type QueryFactories = Readonly<
  Record<string, (context: QueryModuleContext<any>) => (...args: any[]) => unknown>
>;
export type QueryMethods<D> = D extends { readonly queries?: infer Q }
  ? { [K in keyof Q]: Q[K] extends (...args: any[]) => infer Method ? Method : never }
  : {};
export type WithQueryMethods<Database, D> = Database & QueryMethods<D>;

/** Submit a query using its result format instead of SELECT's bindings decoder. */
export async function requestQueryJson(
  client: SparqlClient,
  sparql: string,
  accept: string
): Promise<unknown> {
  const response = await client.postDirect(sparql, { headers: { accept } });
  if (!response.ok)
    throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
  return response.json();
}
