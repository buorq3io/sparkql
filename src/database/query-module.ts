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

/**
 * Converts builder inputs (patterns, expressions, quads, paths) to the AST, exactly as the
 * standard builders do.
 *
 * Query modules get one from {@link QueryModuleContext.normalizer}. When created with a SELECT
 * body, its clause methods (`where`, `from`, `limit`, ...) write into that body object in place,
 * and `getSPARQL()` returns the normalized SELECT. It cannot execute: awaiting it rejects.
 */
export class QueryNormalizer<D extends AnySparqlDialect> extends QueryBuilderBase<
  QuerySelectInput,
  never,
  false,
  D
> {
  constructor(input: QuerySelectInput, context: QueryModuleContext<D>) {
    super(input, context);
  }
  /**
   * Normalizes a graph pattern, including the dialect's extension patterns.
   *
   * @param value - Graph pattern to normalize.
   *
   * @example
   * Turn a triple pattern into the AST a custom query form stores.
   *
   * ```ts
   * function nameTriple(context: QueryModuleContext<SparqlDialect>) {
   *   return context.normalizer().pattern(triples(v.person, n.foaf.name, v.name));
   * }
   * ```
   */
  pattern(value: PatternInput<DialectPattern<D>>): DialectAST<D, AST.Pattern> {
    return this.sanitizePattern(value as unknown as PatternInput) as unknown as DialectAST<
      D,
      AST.Pattern
    >;
  }
  /**
   * Normalizes an expression.
   *
   * @param value - Expression, variable or literal value to normalize.
   *
   * @example
   * Turn an age test into the AST a custom query form stores.
   *
   * ```ts
   * function adultTest(context: QueryModuleContext<SparqlDialect>) {
   *   return context.normalizer().expression(gte(v.age, 18));
   * }
   * ```
   */
  expression(value: ExpressionInput): AST.Expression {
    return this.sanitizeExpression(value);
  }
  /**
   * Normalizes a triple or quad template.
   *
   * @param value - Triples, or triples inside a named graph.
   *
   * @example
   * Turn a `foaf:knows` template into the AST of a construction query.
   *
   * ```ts
   * function knowsTemplate(context: QueryModuleContext<SparqlDialect>) {
   *   return context.normalizer().quads(triples(v.person, n.foaf.knows, v.friend));
   * }
   * ```
   */
  quads(value: QuadsInput): AST.Quads {
    return this.sanitizeQuads(value);
  }
  /**
   * Normalizes a property path.
   *
   * @param value - An IRI or a path built with {@link seq}, {@link oneOrMore} and the like.
   *
   * @example
   * Turn a chain of acquaintances (`foaf:knows+`) into a path AST.
   *
   * ```ts
   * function acquaintances(context: QueryModuleContext<SparqlDialect>) {
   *   return context.normalizer().path(oneOrMore(n.foaf.knows));
   * }
   * ```
   */
  path(value: PathInput): AST.Path {
    return this.sanitizePropertyPath(value);
  }
  protected async makeQuery(): Promise<never> {
    throw new SparkqlError({ message: 'A normalizer cannot execute queries.' });
  }
}

/**
 * Everything a builder needs from its database.
 *
 * Standard builders and dialect query modules receive the same object. Each factory in a
 * dialect's `queries` map gets one, with `operationName` set to the method name.
 */
export interface QueryModuleContext<D extends AnySparqlDialect = AnySparqlDialect>
  extends ExecutionContext {
  /** BASE and PREFIX definitions of the database. */
  readonly context: readonly ContextDefinitionInput[];
  /** Factory for canonical RDF terms. */
  readonly factory: FactoryFunctions;
  /** Configured term result formats. */
  readonly formats?: TermFormats;
  /** Result decoders by datatype. Standard SELECT applies them; modules may apply them. */
  readonly codecs?: TermCodecTable;
  /** Dialect used by the database. */
  readonly dialect: D;
  /**
   * Creates a {@link QueryNormalizer} for this database.
   *
   * Without `input` the normalizer works on a fresh {@link emptySelect} body with the database's
   * prefixes. With `input`, its clause methods modify that body in place.
   *
   * @param input - SELECT body for the normalizer's clause methods to fill.
   *
   * @example
   * Build the SELECT body of a custom query form from a `WHERE` pattern.
   *
   * ```ts
   * function namesBody(context: QueryModuleContext<SparqlDialect>) {
   *   const body = emptySelect(context.context);
   *   context.normalizer(body).where(triples(v.person, n.foaf.name, v.name));
   *   return body;
   * }
   * ```
   */
  normalizer(input?: QuerySelectInput): QueryNormalizer<D>;
}

/**
 * Creates an empty `SELECT * WHERE {}` body with the supplied base and prefix definitions.
 *
 * Custom query forms built on {@link PatternModuleQueryBuilder} start from this body; their
 * clause methods then fill it through a {@link QueryNormalizer}.
 *
 * @param context - `BASE` and `PREFIX` definitions, usually {@link QueryModuleContext.context}.
 *
 * @example
 * Start the body of a custom query form with the database's prefixes.
 *
 * ```ts
 * function newBody(context: QueryModuleContext) {
 *   return emptySelect(context.context);
 * }
 * ```
 */
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

/**
 * A custom query form: how its configuration becomes an AST, how the AST prints as SPARQL, and
 * how the response is decoded.
 *
 * {@link ModuleQueryBuilder} calls `normalize` on every `getSPARQL()`, `toSPARQL()` and
 * execution, then `generate`, then `execute` with the generated text. Dialects expose module
 * builders as database methods through their `queries` factories; `db.json()` in `sparkql/arq`
 * and `db.paths()` in `sparkql/stardog` are built this way.
 *
 * @typeParam Config - Builder state that the builder's methods fill in.
 * @typeParam Ast - Normalized form of the query.
 * @typeParam Result - What awaiting the query resolves to.
 */
export interface QueryModule<Config, Ast, Result, D extends AnySparqlDialect = AnySparqlDialect> {
  /**
   * Normalizes the configuration into the module’s AST.
   *
   * Throw here to reject incomplete configurations: the error surfaces synchronously from
   * `getSPARQL()` and `toSPARQL()`.
   *
   * @param config - The builder's current configuration.
   * @param context - The database's module context, for normalizing inputs.
   *
   * @example
   * Reuse a SELECT body as the AST of a query form that checks whether any solution exists.
   *
   * ```ts
   * type Ast = ReturnType<QueryNormalizer<SparqlDialect>['getSPARQL']>;
   * type AnyMatch = QueryModule<{ body: QuerySelectInput }, Ast, boolean, SparqlDialect>;
   *
   * const normalize: AnyMatch['normalize'] = (config, context) =>
   *   context.normalizer(config.body).getSPARQL();
   * ```
   */
  normalize(config: Config, context: QueryModuleContext<D>): Ast;
  /**
   * Prints the module’s AST as SPARQL text.
   *
   * @param ast - The AST returned by `normalize`.
   * @param context - The database's module context.
   *
   * @example
   * Print a standard SELECT AST with the stock generator.
   *
   * ```ts
   * type Ast = ReturnType<QueryNormalizer<SparqlDialect>['getSPARQL']>;
   * type AnyMatch = QueryModule<{ body: QuerySelectInput }, Ast, boolean, SparqlDialect>;
   *
   * const generate: AnyMatch['generate'] = ast => generateSparql(ast);
   * ```
   */
  generate(ast: Ast, context: QueryModuleContext<D>): string;
  /**
   * Sends the generated SPARQL through the session and decodes the response.
   *
   * @param sparql - The generated query text, including any `.comment()` lines.
   * @param session - The database's session.
   * @param ast - The AST the text was generated from, for decoding.
   *
   * @example
   * Resolve to whether a SELECT returned any solution.
   *
   * ```ts
   * type Ast = ReturnType<QueryNormalizer<SparqlDialect>['getSPARQL']>;
   * type AnyMatch = QueryModule<{ body: QuerySelectInput }, Ast, boolean, SparqlDialect>;
   *
   * const execute: AnyMatch['execute'] = async (sparql, session) => {
   *   const data = await requestQueryJson(session, sparql, 'application/sparql-results+json');
   *   return (data as { results: { bindings: unknown[] } }).results.bindings.length > 0;
   * };
   * ```
   */
  execute(sparql: string, session: SparqlSession, ast: Ast): Promise<Result>;
}

/**
 * Base class for builders of custom query forms, which delegate normalization, generation and
 * execution to a {@link QueryModule}.
 *
 * Subclasses add the chain methods that fill `config`. Awaiting the builder, or calling
 * `execute()`, generates the SPARQL and runs it with the module's `execute`; each await sends
 * a new request. Builders whose form has a `WHERE` clause extend
 * {@link PatternModuleQueryBuilder} instead.
 */
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

  /**
   * Returns the query's AST, normalized from the current configuration on every call.
   *
   * @throws When the module's `normalize` rejects the configuration, for example an ARQ `JSON`
   * query without projected members.
   *
   * @example
   * Inspect the AST of an ARQ `JSON` query.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const ast = db
   *   .json({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .getSPARQL();
   * // ast.subType === 'json'
   * ```
   */
  public getSPARQL(): Ast {
    return this.module.normalize(this.config, this.moduleContext);
  }
  /**
   * Generates the SPARQL text of the query, preceded by its `.comment()` lines.
   *
   * @throws When the module's `normalize` rejects the configuration.
   *
   * @example
   * Print a labelled ARQ `JSON` query.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const text = db
   *   .json({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .comment({ source: 'people' })
   *   .toSPARQL();
   * ```
   *
   * ```sparql
   * #source='people'
   * JSON { "name" : ?name } WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  public toSPARQL(): string {
    return this.withComments(this.module.generate(this.getSPARQL(), this.moduleContext));
  }
  protected makeQuery(session: SparqlSession, sparql: string): Promise<Result> {
    return this.module.execute(sparql, session, this.getSPARQL());
  }
}

/**
 * The `queries` map of a dialect: each factory receives the database's
 * {@link QueryModuleContext} and returns the method installed on the database under its key.
 *
 * Keys must not be `then` or the name of an existing database member: the database throws when
 * it is created otherwise.
 */
export type QueryFactories = Readonly<
  Record<string, (context: QueryModuleContext<any>) => (...args: any[]) => unknown>
>;
/** @internal Extracts methods exposed by a dialect’s query factories. */
export type QueryMethods<D> = D extends { readonly queries?: infer Q }
  ? { [K in keyof Q]: Q[K] extends (...args: any[]) => infer Method ? Method : never }
  : {};
/** @internal Augments a database with its dialect’s query methods. */
export type WithQueryMethods<Database, D> = Database & QueryMethods<D>;

/**
 * Sends a query through `session.raw()` and parses the response body as JSON.
 *
 * Rejects with a {@link SparqlResponseError} on a non-2xx response, and with a parse error when
 * the body is not JSON. The parsed value is not validated; check its shape before using it.
 *
 * @param session - Session used to send the request.
 * @param sparql - Generated query text.
 * @param accept - Media type for the `Accept` header, such as
 * `'application/sparql-results+json'`.
 * @returns The parsed JSON body.
 *
 * @example
 * Count the solutions of a query in a module's `execute`.
 *
 * ```ts
 * async function countSolutions(session: SparqlSession, sparql: string) {
 *   const data = await requestQueryJson(session, sparql, 'application/sparql-results+json');
 *   return (data as { results: { bindings: unknown[] } }).results.bindings.length;
 * }
 * ```
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
