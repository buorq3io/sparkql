import type * as AST from '@traqula/rules-sparql-1-1';
import type { TermCodecTable } from '../helpers/codecs.js';
import type { TermFormats } from '../helpers/term-formats.js';
import type {
  ContextDefinitionInput,
  ExpressionInput,
  FactoryFunctions,
  PathInput,
  PatternInput,
  QuadsInput,
  QuerySelectInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, DialectAST, DialectPattern } from './dialect.js';
import { SparkqlError, SparqlResponseError } from './errors.js';
import { ExecutableQuery, type ExecutionContext } from './executable.js';
import { QueryBuilderBase } from './query.js';
import type { SparqlSession } from './session.js';

/** Shared normalization with the same semantics as the standard builders. */
export class QueryNormalizer<D extends AnySparqlDialect> extends QueryBuilderBase<
  QuerySelectInput,
  never,
  false,
  D
> {
  constructor(input: QuerySelectInput, context: QueryModuleContext<D>) {
    super(input, context);
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
    throw new SparkqlError({ message: 'A normalizer cannot execute queries.' });
  }
}

/**
 * Everything a builder needs from its database. Standard builders and
 * dialect query modules receive the same object.
 */
export interface QueryModuleContext<D extends AnySparqlDialect = AnySparqlDialect>
  extends ExecutionContext {
  /** BASE and PREFIX definitions of the database. */
  readonly context: readonly ContextDefinitionInput[];
  readonly factory: FactoryFunctions;
  readonly formats?: TermFormats;
  /** Result decoders by datatype. Standard SELECT applies them; modules may. */
  readonly codecs?: TermCodecTable;
  readonly dialect: D;
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
  execute(sparql: string, session: SparqlSession, ast: Ast): Promise<Result>;
}

export abstract class ModuleQueryBuilder<
  Config,
  Ast,
  Result,
  D extends AnySparqlDialect,
> extends ExecutableQuery<Result> {
  protected constructor(
    protected readonly config: Config,
    protected readonly module: QueryModule<Config, Ast, Result, D>,
    protected readonly moduleContext: QueryModuleContext<D>
  ) {
    super(moduleContext);
  }

  public getSPARQL(): Ast {
    return this.module.normalize(this.config, this.moduleContext);
  }
  public toSPARQL(): string {
    return this.module.generate(this.getSPARQL(), this.moduleContext);
  }
  protected makeQuery(session: SparqlSession, sparql: string): Promise<Result> {
    return this.module.execute(sparql, session, this.getSPARQL());
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

/**
 * Run a query through `session.raw()` and parse a JSON result in the given
 * format. Rejects a non-2xx response with a {@link SparqlResponseError}.
 */
export async function requestQueryJson(
  session: SparqlSession,
  sparql: string,
  accept: string
): Promise<unknown> {
  const response = await session.raw(sparql, { accept });
  if (!response.ok)
    throw new SparqlResponseError({
      status: response.status,
      statusText: response.statusText,
      body: await response.text().catch(() => ''),
    });
  return response.json();
}
