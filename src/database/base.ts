import * as AST from '@traqula/rules-sparql-1-1';
import {
  codecFormatters,
  type TermCodecs,
  TermCodecTable,
  type WithCodecFormats,
} from '../helpers/codecs.js';
import type { Formatter } from '../helpers/generators.js';
import type { FormatInput, TermFormats } from '../helpers/term-formats.js';
import {
  type FactoryFunctions,
  type PatternBgpInput,
  type PatternInput,
  type QuadsInput,
  type QueryInput,
  Strictness,
  type TermBlankInput,
  type TermIriInput,
  type TermLiteralInput,
  type TermVariableInput,
} from '../helpers/types.js';
import { termBlank, termIri, termLiteral } from '../helpers/utilities.js';
import {
  createBlankManager,
  createIriManager,
  createVariableManager,
  type IriManagerConfig,
  transformIntoPrefixObject,
  type VariableManagerConfig,
} from '../structures/index.js';
import { AskQueryBuilderBase } from './ask.js';
import { ConstructQueryBuilderBase } from './construct.js';
import { type CountOptions, CountQueryBuilder } from './count.js';
import { DescribeQueryBuilderBase } from './describe.js';
import {
  type AnySparqlDialect,
  type DialectPattern,
  type SparqlDialect,
  sparql11Dialect,
} from './dialect.js';
import { is } from './entity.js';
import { SparkqlError } from './errors.js';
import {
  HttpSparqlSession,
  type SparqlConnectionOptions,
  type SparqlHttpClient,
} from './http-session.js';
import { DefaultLogger, type Logger } from './logger.js';
import type { MergePlaceholders, PlaceholderCarrier } from './prepared.js';
import type { RootQueryBuilderBaseWithout } from './query.js';
import {
  emptySelect,
  type QueryModuleContext,
  QueryNormalizer,
  type WithQueryMethods,
} from './query-module.js';
import {
  type InferredSelectResult,
  type SelectedVariables,
  SelectQueryBuilderBase,
  type TypedSelectedVariables,
} from './select.js';
import { isSparqlSession, type SparqlQuad, type SparqlSession } from './session.js';
import { UpdateQueryBuilderBase } from './update.js';

interface PrivateSparqlDatabaseOptions {
  context: QueryInput['context'];
  formats?: TermFormats;
  codecs?: TermCodecTable;
  factory?: AST.AstFactory;
  session?: SparqlSession;
  dialect?: AnySparqlDialect;
  queryInErrors?: boolean;
  logger?: Logger;
}

/** Options for creating a SPARQL database. */
export interface SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  D extends AnySparqlDialect = SparqlDialect,
  X extends TermCodecs = {},
> {
  /** Query dialect and extensions. */
  dialect?: D;
  /** Log each request: `true` uses the console; omitted or `false` disables logging. */
  logger?: boolean | Logger;
  /** Formatters for input terms. */
  formats?: F & TermFormats;
  /**
   * How result terms decode by datatype, e.g. `defaultCodecs({ integer: 'number', decimal: 'number' })`.
   * Applies to projected SELECT variables without an explicit transform
   * (`castX`, `as`, typed functions). Without it, those return RDF/JS terms.
   * Codecs change runtime values only: such variables are still typed as RDF/JS terms.
   * Codec encoders extend `formats.literal`.
   */
  codecs?: X & TermCodecs;
  /** Prefix configuration used by the database. */
  managerConfig?: T;
  /**
   * Options for the default HTTP session. A string is the query endpoint URL,
   * which then also receives updates.
   */
  connection?: string | SparqlConnectionOptions;
  /** A ready `sparql-http-client` instance for the default HTTP session to use. */
  client?: SparqlHttpClient;
  /** A custom session, e.g. an in-process engine or a test double. */
  session?: SparqlSession;
  /**
   * Repeat the generated SPARQL in the `message` of a `SparkqlQueryError`.
   * Off by default: values inlined into a query (VALUES rows, literals) would
   * reach every log that records error messages. The `query` property always
   * holds it.
   */
  queryInErrors?: boolean;
  /** @deprecated Use `connection`. */
  endpointUrl?: string;
  /** @deprecated Use `connection.updateUrl`. */
  updateUrl?: string;
}

/**
 * The client behind a database made with `connection`: it is loaded on first
 * use, so it is a promise. `undefined` for custom-session and build-only databases.
 */
export type DefaultSparqlClient = Promise<SparqlHttpClient> | undefined;
/** Every value `$client` can hold when the way the database was created is unknown. */
export type AnySparqlClient = SparqlHttpClient | DefaultSparqlClient;

function resolveSession(
  options: SparqlDatabaseOptions<any, any, any> = {}
): SparqlSession | undefined {
  const { connection, client, session, endpointUrl, updateUrl } = options;
  const legacy = endpointUrl !== undefined || updateUrl !== undefined;
  const given = [connection !== undefined, client !== undefined, session !== undefined, legacy];
  if (given.filter(Boolean).length > 1)
    throw new SparkqlError({
      message:
        'Pass only one of `connection`, `client`, `session` or the deprecated `endpointUrl`/`updateUrl`.',
    });
  if (session !== undefined) {
    if (!isSparqlSession(session))
      throw new SparkqlError({
        message: '`session` must implement bindings, boolean, quads, update and raw.',
      });
    return session;
  }
  if (client !== undefined) return new HttpSparqlSession({ client });
  if (connection !== undefined) return new HttpSparqlSession({ connection });
  if (legacy) return new HttpSparqlSession({ connection: { endpointUrl, updateUrl } });
  return undefined;
}

/** Entry point for building and executing SPARQL requests. */
export class SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  D extends AnySparqlDialect = SparqlDialect,
  C extends AnySparqlClient = AnySparqlClient,
> {
  private readonly dialect: D;
  private readonly formats: TermFormats;
  private readonly codecs: TermCodecTable;
  private readonly queryInErrors: boolean;
  private readonly logger: Logger | undefined;
  /** The session queries run through. `undefined` on a build-only database. */
  readonly $session: SparqlSession | undefined;
  private readonly moduleContext: QueryModuleContext<D>;
  private readonly initialContext;
  private readonly factory: AST.AstFactory;
  protected readonly factoryFunctions: FactoryFunctions;

  private constructor(options?: PrivateSparqlDatabaseOptions) {
    this.dialect = (options?.dialect ?? sparql11Dialect) as D;
    this.formats = {
      iri: [...(options?.formats?.iri ?? [])],
      literal: [...(options?.formats?.literal ?? [])],
      blank: [...(options?.formats?.blank ?? [])],
    };
    this.codecs = options?.codecs ?? new TermCodecTable();
    this.$session = options?.session;
    this.logger = options?.logger;
    this.queryInErrors = options?.queryInErrors ?? false;
    this.initialContext = options?.context ?? [];
    this.factory = options?.factory ?? new AST.AstFactory();
    this.factoryFunctions = {
      variable: value => this.variable(value),
      iri: (value, prefix) => (prefix === undefined ? this.iri(value) : this.iri(value, prefix)),
      blank: value => this.blank(value),
      literal: (value, lang) =>
        this.factory.termLiteral(
          { sourceLocationType: 'autoGenerate' },
          value,
          typeof lang === 'string' || !lang
            ? lang
            : termIri.parseOrThrow(lang, this.factoryFunctions)
        ),
    };
    const moduleContext: QueryModuleContext<D> = {
      context: this.initialContext,
      factory: this.factoryFunctions,
      formats: this.formats,
      codecs: this.codecs,
      dialect: this.dialect,
      session: this.$session,
      queryInErrors: this.queryInErrors,
      logger: this.logger,
      normalizer: input =>
        new QueryNormalizer(input ?? emptySelect(this.initialContext), moduleContext),
    };
    this.moduleContext = moduleContext;
    for (const [name, factory] of Object.entries(this.dialect.queries ?? {})) {
      if (name === 'then' || name in this)
        throw new SparkqlError({
          message: `Query module name conflicts with database member: ${name}`,
        });
      Object.defineProperty(this, name, {
        value: factory({ ...moduleContext, operationName: name }),
        enumerable: true,
      });
    }
  }

  /**
   * The `sparql-http-client` instance behind the default HTTP session: the
   * `client` passed to `create()`, or a promise of the one created from
   * `connection`. `undefined` for custom-session and build-only databases.
   */
  get $client(): C {
    return (is(this.$session, HttpSparqlSession) ? this.$session.client : undefined) as C;
  }

  /**
   * Creates a database. Configure the transport once with `connection`
   * (options for the default HTTP session), `client` (a ready
   * `sparql-http-client` instance) or `session` (any {@link SparqlSession}).
   * Without one the database is build-only: queries generate SPARQL and
   * reject when awaited.
   *
   * @param options - Database configuration, including an optional transport.
   *
   * @example
   * Create a build-only database.
   *
   * ```ts
   * const database = SparqlDatabase.create();
   * ```
   */
  static create<
    T extends IriManagerConfig,
    K extends string = 'g_',
    F extends TermFormats = {},
    D extends AnySparqlDialect = SparqlDialect,
    C extends SparqlHttpClient = SparqlHttpClient,
    X extends TermCodecs = {},
  >(
    options: SparqlDatabaseOptions<T, F, D, X> & { client: C }
  ): WithQueryMethods<SparqlDatabase<T, K, WithCodecFormats<F, X>, D, C>, D>;
  /**
   * Creates a database.
   *
   * See the first overload for details.
   *
   * @param options - Database configuration, including an optional transport.
   *
   * @example
   * Connect to an endpoint.
   *
   * ```ts
   * const database = SparqlDatabase.create({ connection: 'https://example.org/sparql' });
   * ```
   */
  static create<
    T extends IriManagerConfig,
    K extends string = 'g_',
    F extends TermFormats = {},
    D extends AnySparqlDialect = SparqlDialect,
    X extends TermCodecs = {},
  >(
    options?: SparqlDatabaseOptions<T, F, D, X>
  ): WithQueryMethods<SparqlDatabase<T, K, WithCodecFormats<F, X>, D, DefaultSparqlClient>, D>;
  static create<
    T extends IriManagerConfig,
    K extends string = 'g_',
    F extends TermFormats = {},
    D extends AnySparqlDialect = SparqlDialect,
    X extends TermCodecs = {},
  >(
    options?: SparqlDatabaseOptions<T, F, D, X>
  ): WithQueryMethods<SparqlDatabase<T, K, WithCodecFormats<F, X>, D>, D> {
    const codecs = new TermCodecTable(options?.codecs);
    return new SparqlDatabase<T, K, WithCodecFormats<F, X>, D>({
      dialect: options?.dialect,
      formats: {
        ...options?.formats,
        literal: [...(options?.formats?.literal ?? []), ...codecFormatters(options?.codecs)],
      },
      codecs,
      session: resolveSession(options),
      logger: options?.logger === true ? new DefaultLogger() : options?.logger || undefined,
      queryInErrors: options?.queryInErrors,
      context: transformIntoPrefixObject(options?.managerConfig ?? {}),
    }) as WithQueryMethods<SparqlDatabase<T, K, WithCodecFormats<F, X>, D>, D>;
  }

  /**
   * Creates a database with a `BASE` declaration.
   *
   * The original database is unchanged; subsequent queries use the added base.
   *
   * @param value - Base IRI.
   *
   * @example
   * List names with a base IRI declared.
   *
   * ```ts
   * db.base('https://example.org/').select().where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * BASE <https://example.org/>
   * SELECT * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  base(value: string): this {
    return new SparqlDatabase<T, R, F, D>({
      dialect: this.dialect,
      formats: this.formats,
      codecs: this.codecs,
      session: this.$session,
      queryInErrors: this.queryInErrors,
      logger: this.logger,
      factory: this.factory,
      context: [
        ...this.initialContext,
        {
          type: 'contextDef',
          subType: 'base',
          loc: {
            sourceLocationType: 'autoGenerate',
          },
          value: this.iri(value),
        },
      ],
    }) as unknown as this;
  }

  /**
   * Creates a database with `PREFIX` declarations.
   *
   * The original database is unchanged; subsequent queries use the added prefixes.
   *
   * @param values - Prefix names mapped to namespace IRIs.
   *
   * @example
   * Declare a prefix while selecting people’s names.
   *
   * ```ts
   * db.prefix({ ex: 'https://example.org/' }).select().where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * PREFIX ex: <https://example.org/>
   * SELECT * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  prefix(values: { [x in string]: string }): this {
    return new SparqlDatabase<T, R, F, D>({
      dialect: this.dialect,
      formats: this.formats,
      codecs: this.codecs,
      session: this.$session,
      queryInErrors: this.queryInErrors,
      logger: this.logger,
      factory: this.factory,
      context: [
        ...this.initialContext,
        ...Object.entries(values).map(
          ([k, v]) =>
            ({
              type: 'contextDef',
              subType: 'prefix',
              loc: {
                sourceLocationType: 'autoGenerate',
              },
              key: k,
              value: this.iri(v),
            }) as const
        ),
      ],
    }) as unknown as this;
  }

  /**
   * Counts solutions to graph patterns.
   *
   * The returned builder can be serialized or awaited; each await executes a request.
   *
   * @param inputs - Graph patterns followed by count options.
   *
   * @example
   * Count distinct names.
   *
   * ```ts
   * db.$count(triples(v.person, n.foaf.name, v.name), { distinct: v.name });
   * ```
   *
   * ```sparql
   * SELECT ( COUNT( DISTINCT ?name ) AS ?count ) WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  $count<P extends PatternInput<DialectPattern<D>>[]>(
    ...inputs: [...P, CountOptions]
  ): CountQueryBuilder<D> & PlaceholderCarrier<MergePlaceholders<P[number]>>;
  /**
   * Counts solutions to graph patterns.
   *
   * See the first overload for details.
   *
   * @param patterns - Graph patterns to count.
   *
   * @example
   * Count people with a name.
   *
   * ```ts
   * db.$count(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT ( COUNT( * ) AS ?count ) WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  $count<P extends PatternInput<DialectPattern<D>>[]>(
    ...patterns: P
  ): CountQueryBuilder<D> & PlaceholderCarrier<MergePlaceholders<P[number]>>;
  $count(...inputs: (PatternInput<DialectPattern<D>> | CountOptions)[]): CountQueryBuilder<D> {
    const last = inputs[inputs.length - 1];
    const options =
      last && 'distinct' in last && !('type' in last) ? (inputs.pop() as CountOptions) : undefined;
    return new CountQueryBuilder(
      this.moduleContext,
      inputs as PatternInput<DialectPattern<D>>[],
      options
    );
  }

  /**
   * Builds a `SELECT` query.
   *
   * Add graph patterns with `where`, then modifiers such as `orderBy` and `limit`; the
   * modifiers and `values` are unavailable on the chain until `where` is called.
   * Each await executes a request. Bare variables are typed and returned as RDF/JS terms
   * ({@link DefaultQueryReturnType}); configured codecs decode matching datatypes at runtime
   * without changing that static type. Omit the projection for `SELECT *`: each row then holds
   * every variable the solution binds, keyed by name, decoded like a bare variable.
   *
   * @param variables - Projection mapping, or omit for all variables.
   *
   * @example
   * Select names and inspect their inferred row type.
   *
   * ```ts
   * const rows = await db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
   * // rows: { name: DefaultQueryReturnType }[]
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  select<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>, D>>;

  /**
   * Builds a `SELECT` query.
   *
   * See the first overload for details.
   *
   * @param variables - Typed projection mapping, or omit for all variables.
   *
   * @example
   * Select all variables for people and their names.
   *
   * ```ts
   * db.select().where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>>;

  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>> {
    return new SelectQueryBuilderBase<U, D>(this.moduleContext, { variables });
  }

  /**
   * Builds a `SELECT DISTINCT` query.
   *
   * Add graph patterns with `where`, then modifiers such as `orderBy` and `limit`; the
   * modifiers and `values` are unavailable on the chain until `where` is called.
   * Each await executes a request. Bare variables are typed and returned as RDF/JS terms
   * (`DefaultQueryReturnType`); configured codecs decode matching datatypes at runtime
   * without changing that static type. Omit the projection for `SELECT *`: each row then holds
   * every variable the solution binds, keyed by name, decoded like a bare variable.
   *
   * @param variables - Projection mapping, or omit for all variables.
   *
   * @example
   * Select distinct names.
   *
   * ```ts
   * const rows = await db
   *   .selectDistinct({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name));
   * // rows: { name: DefaultQueryReturnType }[]
   * ```
   *
   * ```sparql
   * SELECT DISTINCT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  selectDistinct<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>, D>>;

  /**
   * Builds a `SELECT DISTINCT` query.
   *
   * See the first overload for details.
   *
   * @param variables - Typed projection mapping, or omit for all variables.
   *
   * @example
   * Select all variables with duplicate rows removed.
   *
   * ```ts
   * db.selectDistinct().where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT DISTINCT * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>>;

  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>> {
    return new SelectQueryBuilderBase<U, D>(this.moduleContext, { variables, distinct: true });
  }

  /**
   * Builds a `SELECT REDUCED` query.
   *
   * Add graph patterns with `where`, then modifiers such as `orderBy` and `limit`; the
   * modifiers and `values` are unavailable on the chain until `where` is called.
   * Each await executes a request. Bare variables are typed and returned as RDF/JS terms
   * (`DefaultQueryReturnType`); configured codecs decode matching datatypes at runtime
   * without changing that static type. Omit the projection for `SELECT *`: each row then holds
   * every variable the solution binds, keyed by name, decoded like a bare variable.
   *
   * @param variables - Projection mapping, or omit for all variables.
   *
   * @example
   * Select names with duplicate reduction.
   *
   * ```ts
   * const rows = await db
   *   .selectReduced({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name));
   * // rows: { name: DefaultQueryReturnType }[]
   * ```
   *
   * ```sparql
   * SELECT REDUCED ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  selectReduced<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>, D>>;

  /**
   * Builds a `SELECT REDUCED` query.
   *
   * See the first overload for details.
   *
   * @param variables - Typed projection mapping, or omit for all variables.
   *
   * @example
   * Select all variables with duplicate reduction.
   *
   * ```ts
   * db.selectReduced().where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT REDUCED * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>>;

  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>> {
    return new SelectQueryBuilderBase<U, D>(this.moduleContext, { variables, reduced: true });
  }

  /**
   * Builds an `ASK` query.
   *
   * Add graph patterns with `where`. Each await executes a request and resolves to a boolean.
   *
   * @example
   * Check whether anyone has a name.
   *
   * ```ts
   * db.ask().where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * ASK WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  ask(): RootQueryBuilderBaseWithout<AskQueryBuilderBase<D>> {
    return new AskQueryBuilderBase<D>(this.moduleContext);
  }

  /**
   * Builds a `DESCRIBE` query.
   *
   * Add graph patterns with `where` and query modifiers. Each await executes a request and
   * resolves to the RDF/JS quads ({@link SparqlQuad}) the session returns.
   *
   * @param variables - Resources or variables to describe.
   *
   * @example
   * Describe people who have names.
   *
   * ```ts
   * db.describe(v.person).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * DESCRIBE ?person WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  describe(
    ...variables: (TermIriInput | TermVariableInput)[]
  ): RootQueryBuilderBaseWithout<DescribeQueryBuilderBase<D>> {
    return new DescribeQueryBuilderBase<D>(this.moduleContext, variables);
  }

  /**
   * Builds a `CONSTRUCT` query.
   *
   * Add graph patterns with `where` and query modifiers. Each await executes a request and
   * resolves to the RDF/JS quads ({@link SparqlQuad}) the session returns.
   *
   * @param templates - Triple templates for the result graph.
   *
   * @example
   * Construct a graph of people’s names.
   *
   * ```ts
   * db.construct(triples(v.person, n.foaf.name, v.name)).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * CONSTRUCT {
   *   ?person foaf:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  construct<Q extends PatternBgpInput[]>(
    ...templates: Q
  ): RootQueryBuilderBaseWithout<ConstructQueryBuilderBase<D>> &
    PlaceholderCarrier<MergePlaceholders<Q[number]>> {
    return new ConstructQueryBuilderBase<D>(
      this.moduleContext,
      templates
    ) as ConstructQueryBuilderBase<D> & PlaceholderCarrier<MergePlaceholders<Q[number]>>;
  }

  /**
   * Builds an `INSERT DATA` update.
   *
   * Further update operations can be appended. Awaiting executes a request each time.
   *
   * @param quads - Quads to include in the operation.
   *
   * @example
   * Insert Ada’s name.
   *
   * ```ts
   * db.insertData(triples(db.iri('http://example.org/people/ada'), n.foaf.name, 'Ada'));
   * ```
   *
   * ```sparql
   * INSERT DATA {
   *   <http://example.org/people/ada> foaf:name "Ada" .
   * }
   * ```
   */
  insertData<Q extends QuadsInput[]>(...quads: Q) {
    return this.update().insertData(...quads);
  }

  /**
   * Builds a `DELETE DATA` update.
   *
   * Further update operations can be appended. Awaiting executes a request each time.
   *
   * @param quads - Quads to include in the operation.
   *
   * @example
   * Delete Ada’s name.
   *
   * ```ts
   * db.deleteData(triples(db.iri('http://example.org/people/ada'), n.foaf.name, 'Ada'));
   * ```
   *
   * ```sparql
   * DELETE DATA {
   *   <http://example.org/people/ada> foaf:name "Ada" .
   * }
   * ```
   */
  deleteData<Q extends QuadsInput[]>(...quads: Q) {
    return this.update().deleteData(...quads);
  }

  /**
   * Builds a `DELETE WHERE` update.
   *
   * Further update operations can be appended. Awaiting executes a request each time.
   *
   * @param quads - Quads to include in the operation.
   *
   * @example
   * Remove all people’s names.
   *
   * ```ts
   * db.deleteWhere(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * DELETE WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  deleteWhere<Q extends QuadsInput[]>(...quads: Q) {
    return this.update().deleteWhere(...quads);
  }

  /**
   * Adds an `INSERT` update operation.
   *
   * Starts a modify operation; add its patterns with `where()`. Without them the operation
   * is generated with an empty `WHERE { }`.
   *
   * Awaiting the builder executes a request each time.
   *
   * @param quads - Quad templates for the operation.
   *
   * @example
   * Add Ada as a name for each named person.
   *
   * ```ts
   * db.insert(triples(v.person, n.foaf.name, 'Ada')).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * INSERT {
   *   ?person foaf:name "Ada" .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  insert<Q extends QuadsInput[]>(...quads: Q) {
    return this.update().insert(...quads);
  }

  /**
   * Adds a `DELETE` update operation.
   *
   * Starts a modify operation; add its patterns with `where()`. Without them the operation
   * is generated with an empty `WHERE { }`.
   *
   * Awaiting the builder executes a request each time.
   *
   * @param quads - Quad templates for the operation.
   *
   * @example
   * Remove names from every named person.
   *
   * ```ts
   * db.delete(triples(v.person, n.foaf.name, v.name)).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * DELETE {
   *   ?person foaf:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  delete<Q extends QuadsInput[]>(...quads: Q) {
    return this.update().delete(...quads);
  }

  /**
   * Adds a `WITH` update operation.
   *
   * Starts a modify operation using the specified graph.
   *
   * Awaiting the builder executes a request each time.
   *
   * @param graph - Graph used by the modify operation.
   *
   * @example
   * Remove names from people in the selected graph.
   *
   * ```ts
   * db.with(db.iri('http://example.org/graphs/staging')).delete(triples(v.person, n.foaf.name, v.name))
   *   .where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/staging> DELETE {
   *   ?person foaf:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  with(graph: TermIriInput) {
    return this.update().with(graph);
  }

  /**
   * Adds a `COPY` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Copy the staging graph into the archive graph.
   *
   * ```ts
   * db.copy(db.iri('http://example.org/graphs/staging')).to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * COPY GRAPH <http://example.org/graphs/staging> TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  copy(source: TermIriInput) {
    return this.update().copy(source);
  }

  /**
   * Adds a `COPY DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @example
   * Copy the default graph into the archive graph.
   *
   * ```ts
   * db.copyDefault().to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * COPY DEFAULT TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  copyDefault() {
    return this.update().copyDefault();
  }

  /**
   * Adds a `COPY SILENT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. The `SILENT` modifier suppresses endpoint errors for this operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Copy the staging graph into the archive graph, ignoring errors.
   *
   * ```ts
   * db.copySilent(db.iri('http://example.org/graphs/staging')).to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * COPY SILENT GRAPH <http://example.org/graphs/staging> TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  copySilent(source: TermIriInput) {
    return this.update().copySilent(source);
  }

  /**
   * Adds a `COPY SILENT DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Copy the default graph into the archive graph, ignoring errors.
   *
   * ```ts
   * db.copySilentDefault().to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * COPY SILENT DEFAULT TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  copySilentDefault() {
    return this.update().copySilentDefault();
  }

  /**
   * Adds a `MOVE` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Move the staging graph into the archive graph.
   *
   * ```ts
   * db.move(db.iri('http://example.org/graphs/staging')).to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * MOVE GRAPH <http://example.org/graphs/staging> TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  move(source: TermIriInput) {
    return this.update().move(source);
  }

  /**
   * Adds a `MOVE DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @example
   * Move the default graph into the archive graph.
   *
   * ```ts
   * db.moveDefault().to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * MOVE DEFAULT TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  moveDefault() {
    return this.update().moveDefault();
  }

  /**
   * Adds a `MOVE SILENT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Move the staging graph into the archive graph, ignoring errors.
   *
   * ```ts
   * db.moveSilent(db.iri('http://example.org/graphs/staging')).to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * MOVE SILENT GRAPH <http://example.org/graphs/staging> TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  moveSilent(source: TermIriInput) {
    return this.update().moveSilent(source);
  }

  /**
   * Adds a `MOVE SILENT DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Move the default graph into the archive graph, ignoring errors.
   *
   * ```ts
   * db.moveSilentDefault().to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * MOVE SILENT DEFAULT TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  moveSilentDefault() {
    return this.update().moveSilentDefault();
  }

  /**
   * Adds an `ADD` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Add triples from the staging graph to the archive graph.
   *
   * ```ts
   * db.add(db.iri('http://example.org/graphs/staging')).to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * ADD GRAPH <http://example.org/graphs/staging> TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  add(source: TermIriInput) {
    return this.update().add(source);
  }

  /**
   * Adds an `ADD DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @example
   * Add triples from the default graph to the archive graph.
   *
   * ```ts
   * db.addDefault().to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * ADD DEFAULT TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  addDefault() {
    return this.update().addDefault();
  }

  /**
   * Adds an `ADD SILENT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Add triples from the staging graph to the archive graph, ignoring errors.
   *
   * ```ts
   * db.addSilent(db.iri('http://example.org/graphs/staging')).to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * ADD SILENT GRAPH <http://example.org/graphs/staging> TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  addSilent(source: TermIriInput) {
    return this.update().addSilent(source);
  }

  /**
   * Adds an `ADD SILENT DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Add triples from the default graph to the archive graph, ignoring errors.
   *
   * ```ts
   * db.addSilentDefault().to(db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * ADD SILENT DEFAULT TO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  addSilentDefault() {
    return this.update().addSilentDefault();
  }

  /**
   * Adds a `LOAD` update operation.
   *
   * Appends the operation to the request.
   *
   * @param source - Source document IRI.
   *
   * @example
   * Load a Turtle document into the default graph.
   *
   * ```ts
   * db.load(db.iri('http://example.org/data/people.ttl'));
   * ```
   *
   * ```sparql
   * LOAD <http://example.org/data/people.ttl>
   * ```
   */
  load(source: TermIriInput) {
    return this.update().load(source);
  }

  /**
   * Adds a `LOAD INTO` update operation.
   *
   * Appends the operation to the request.
   *
   * @param source - Source document IRI.
   * @param destination - Destination graph IRI.
   *
   * @example
   * Load a Turtle document into the archive graph.
   *
   * ```ts
   * db.loadInto(db.iri('http://example.org/data/people.ttl'), db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * LOAD <http://example.org/data/people.ttl> INTO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  loadInto(source: TermIriInput, destination: TermIriInput) {
    return this.update().loadInto(source, destination);
  }

  /**
   * Adds a `LOAD SILENT` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @param source - Source document IRI.
   *
   * @example
   * Load a Turtle document into the default graph, ignoring errors.
   *
   * ```ts
   * db.loadSilent(db.iri('http://example.org/data/people.ttl'));
   * ```
   *
   * ```sparql
   * LOAD SILENT <http://example.org/data/people.ttl>
   * ```
   */
  loadSilent(source: TermIriInput) {
    return this.update().loadSilent(source);
  }

  /**
   * Adds a `LOAD SILENT INTO` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @param source - Source document IRI.
   * @param destination - Destination graph IRI.
   *
   * @example
   * Load a Turtle document into the archive graph, ignoring errors.
   *
   * ```ts
   * db.loadSilentInto(db.iri('http://example.org/data/people.ttl'), db.iri('http://example.org/graphs/archive'));
   * ```
   *
   * ```sparql
   * LOAD SILENT <http://example.org/data/people.ttl> INTO GRAPH <http://example.org/graphs/archive>
   * ```
   */
  loadSilentInto(source: TermIriInput, destination: TermIriInput) {
    return this.update().loadSilentInto(source, destination);
  }

  /**
   * Adds a `CREATE` update operation.
   *
   * Appends the operation to the request.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Create the staging graph.
   *
   * ```ts
   * db.create(db.iri('http://example.org/graphs/staging'));
   * ```
   *
   * ```sparql
   * CREATE GRAPH <http://example.org/graphs/staging>
   * ```
   */
  create(graph: TermIriInput) {
    return this.update().create(graph);
  }

  /**
   * Adds a `CREATE SILENT` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Create the staging graph, ignoring errors.
   *
   * ```ts
   * db.createSilent(db.iri('http://example.org/graphs/staging'));
   * ```
   *
   * ```sparql
   * CREATE SILENT GRAPH <http://example.org/graphs/staging>
   * ```
   */
  createSilent(graph: TermIriInput) {
    return this.update().createSilent(graph);
  }

  /**
   * Adds a `CLEAR` update operation.
   *
   * Appends the operation to the request.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Clear triples from the staging graph.
   *
   * ```ts
   * db.clear(db.iri('http://example.org/graphs/staging'));
   * ```
   *
   * ```sparql
   * CLEAR GRAPH <http://example.org/graphs/staging>
   * ```
   */
  clear(graph: TermIriInput) {
    return this.update().clear(graph);
  }

  /**
   * Adds a `CLEAR ALL` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Clear triples from all graphs.
   *
   * ```ts
   * db.clearAll();
   * ```
   *
   * ```sparql
   * CLEAR ALL
   * ```
   */
  clearAll() {
    return this.update().clearAll();
  }

  /**
   * Adds a `CLEAR DEFAULT` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Clear triples from the default graph.
   *
   * ```ts
   * db.clearDefault();
   * ```
   *
   * ```sparql
   * CLEAR DEFAULT
   * ```
   */
  clearDefault() {
    return this.update().clearDefault();
  }

  /**
   * Adds a `CLEAR NAMED` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Clear triples from all named graphs.
   *
   * ```ts
   * db.clearNamed();
   * ```
   *
   * ```sparql
   * CLEAR NAMED
   * ```
   */
  clearNamed() {
    return this.update().clearNamed();
  }

  /**
   * Adds a `CLEAR SILENT` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Clear triples from the staging graph, ignoring errors.
   *
   * ```ts
   * db.clearSilent(db.iri('http://example.org/graphs/staging'));
   * ```
   *
   * ```sparql
   * CLEAR SILENT GRAPH <http://example.org/graphs/staging>
   * ```
   */
  clearSilent(graph: TermIriInput) {
    return this.update().clearSilent(graph);
  }

  /**
   * Adds a `CLEAR SILENT ALL` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Clear triples from all graphs, ignoring errors.
   *
   * ```ts
   * db.clearSilentAll();
   * ```
   *
   * ```sparql
   * CLEAR SILENT ALL
   * ```
   */
  clearSilentAll() {
    return this.update().clearSilentAll();
  }

  /**
   * Adds a `CLEAR SILENT DEFAULT` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Clear triples from the default graph, ignoring errors.
   *
   * ```ts
   * db.clearSilentDefault();
   * ```
   *
   * ```sparql
   * CLEAR SILENT DEFAULT
   * ```
   */
  clearSilentDefault() {
    return this.update().clearSilentDefault();
  }

  /**
   * Adds a `CLEAR SILENT NAMED` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Clear triples from all named graphs, ignoring errors.
   *
   * ```ts
   * db.clearSilentNamed();
   * ```
   *
   * ```sparql
   * CLEAR SILENT NAMED
   * ```
   */
  clearSilentNamed() {
    return this.update().clearSilentNamed();
  }

  /**
   * Adds a `DROP` update operation.
   *
   * Appends the operation to the request.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Drop the staging graph.
   *
   * ```ts
   * db.drop(db.iri('http://example.org/graphs/staging'));
   * ```
   *
   * ```sparql
   * DROP GRAPH <http://example.org/graphs/staging>
   * ```
   */
  drop(graph: TermIriInput) {
    return this.update().drop(graph);
  }

  /**
   * Adds a `DROP ALL` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Drop all graphs.
   *
   * ```ts
   * db.dropAll();
   * ```
   *
   * ```sparql
   * DROP ALL
   * ```
   */
  dropAll() {
    return this.update().dropAll();
  }

  /**
   * Adds a `DROP DEFAULT` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Drop the default graph.
   *
   * ```ts
   * db.dropDefault();
   * ```
   *
   * ```sparql
   * DROP DEFAULT
   * ```
   */
  dropDefault() {
    return this.update().dropDefault();
  }

  /**
   * Adds a `DROP NAMED` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Drop all named graphs.
   *
   * ```ts
   * db.dropNamed();
   * ```
   *
   * ```sparql
   * DROP NAMED
   * ```
   */
  dropNamed() {
    return this.update().dropNamed();
  }

  /**
   * Adds a `DROP SILENT` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Drop the staging graph, ignoring errors.
   *
   * ```ts
   * db.dropSilent(db.iri('http://example.org/graphs/staging'));
   * ```
   *
   * ```sparql
   * DROP SILENT GRAPH <http://example.org/graphs/staging>
   * ```
   */
  dropSilent(graph: TermIriInput) {
    return this.update().dropSilent(graph);
  }

  /**
   * Adds a `DROP SILENT ALL` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Drop all graphs, ignoring errors.
   *
   * ```ts
   * db.dropSilentAll();
   * ```
   *
   * ```sparql
   * DROP SILENT ALL
   * ```
   */
  dropSilentAll() {
    return this.update().dropSilentAll();
  }

  /**
   * Adds a `DROP SILENT DEFAULT` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Drop the default graph, ignoring errors.
   *
   * ```ts
   * db.dropSilentDefault();
   * ```
   *
   * ```sparql
   * DROP SILENT DEFAULT
   * ```
   */
  dropSilentDefault() {
    return this.update().dropSilentDefault();
  }

  /**
   * Adds a `DROP SILENT NAMED` update operation.
   *
   * Appends the operation to the request. See {@link SparqlDatabase.copySilent} for `SILENT` behavior.
   *
   * @example
   * Drop all named graphs, ignoring errors.
   *
   * ```ts
   * db.dropSilentNamed();
   * ```
   *
   * ```sparql
   * DROP SILENT NAMED
   * ```
   */
  dropSilentNamed() {
    return this.update().dropSilentNamed();
  }

  protected update() {
    return new UpdateQueryBuilderBase<D>(this.moduleContext);
  }

  /**
   * Creates a variable term.
   *
   * A bare selected variable yields RDF/JS terms unless codecs decode them.
   *
   * @param value - Variable name.
   *
   * @example
   * Match names using an explicitly created variable.
   *
   * ```ts
   * db.select().where(triples(db.variable('person'), n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  variable(value: string): TermVariableInput {
    return this.factory.termVariable(value, { sourceLocationType: 'autoGenerate' });
  }

  /**
   * Creates a full IRI term.
   *
   * @param value - Full IRI.
   *
   * @example
   * Match Ada’s name using a full IRI.
   *
   * ```ts
   * db.select().where(triples(v.person, db.iri('http://xmlns.com/foaf/0.1/name'), db.literal('Ada')));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   ?person <http://xmlns.com/foaf/0.1/name> "Ada" .
   * }
   * ```
   */
  iri(value: string): AST.TermIriFull;
  /**
   * Creates a prefixed IRI term.
   *
   * See the first overload for details.
   *
   * @param value - Local name.
   * @param prefix - Prefix name.
   *
   * @example
   * Match an English name using a prefixed IRI.
   *
   * ```ts
   * db.select().where(triples(db.blank('person'), db.iri('name', 'foaf'), db.literal('Ada', 'en')));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   _:person foaf:name "Ada"@en .
   * }
   * ```
   */
  iri(value: string, prefix: string): AST.TermIriPrefixed;
  /**
   * Creates an IRI term from an input or configured formatter.
   *
   * See the first overload for details.
   *
   * @param value - IRI input or a value accepted by an IRI formatter.
   *
   * @example
   * Select names using an IRI term.
   *
   * ```ts
   * db.select().where(triples(v.person, db.iri(n.foaf.name), v.name));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  iri(value: TermIriInput | FormatInput<F, 'iri'>): AST.TermIri;
  iri(value: string | TermIriInput | FormatInput<F, 'iri'>, prefix?: string): AST.TermIri {
    if (typeof value === 'string') {
      return prefix === undefined
        ? this.factory.termNamed({ sourceLocationType: 'autoGenerate' }, value)
        : this.factory.termNamed({ sourceLocationType: 'autoGenerate' }, value, prefix);
    }
    return this.formatTerm(value, this.formats.iri, termIri);
  }

  /**
   * Creates a blank node term.
   *
   * An omitted value generates a fresh label.
   *
   * @param value - Optional label, blank term or formatted input.
   *
   * @example
   * Match an English name on a blank node.
   *
   * ```ts
   * db.select().where(triples(db.blank('person'), db.iri('name', 'foaf'), db.literal('Ada', 'en')));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   _:person foaf:name "Ada"@en .
   * }
   * ```
   */
  blank(value?: string | TermBlankInput | FormatInput<F, 'blank'>): AST.TermBlank {
    if (value === undefined)
      return this.factory.termBlank(undefined, { sourceLocationType: 'autoGenerate' });
    if (typeof value === 'string') {
      return this.factory.termBlank(value, { sourceLocationType: 'autoGenerate' });
    }
    return this.formatTerm(value, this.formats.blank, termBlank);
  }

  /**
   * Creates a literal term.
   *
   * A language or datatype overrides the input literal annotation.
   *
   * @param value - Literal input or formatted value.
   * @param lang - Optional language tag or datatype IRI.
   *
   * @example
   * Match an English-language name.
   *
   * ```ts
   * db.select().where(triples(db.blank('person'), db.iri('name', 'foaf'), db.literal('Ada', 'en')));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   _:person foaf:name "Ada"@en .
   * }
   * ```
   */
  literal(
    value: TermLiteralInput | FormatInput<F, 'literal'>,
    lang?: string | TermIriInput | FormatInput<F, 'iri'>
  ): AST.TermLiteral {
    const result = this.formatTerm(value, this.formats.literal, termLiteral);
    if (lang === undefined) return result;
    return this.factory.termLiteral(
      { sourceLocationType: 'autoGenerate' },
      result.value,
      typeof lang === 'string' ? lang : this.iri(lang)
    );
  }

  private formatTerm<O>(
    value: unknown,
    formats: readonly Formatter<any, O>[] | undefined,
    fallback: {
      is(value: unknown): value is O;
      parseOrThrow(value: unknown, factory: FactoryFunctions): O;
    }
  ): O {
    if (fallback.is(value)) return value;
    for (const formatter of formats ?? []) {
      if (formatter.test(value)) return formatter.format(value, this.factoryFunctions);
    }
    return fallback.parseOrThrow(value, this.factoryFunctions);
  }

  /**
   * Resets the generated blank node counter.
   *
   * Existing terms retain their labels; subsequent generated labels can collide.
   *
   * @example
   * Reset the counter before generating blank node labels.
   *
   * ```ts
   * db.resetBlankCounter();
   * ```
   */
  resetBlankCounter() {
    this.factory.resetBlankNodeCounter();
  }

  /**
   * Creates variable, IRI and blank node managers.
   *
   * The variable manager maps `v.x` to `?x`; the IRI manager maps
   * `n.prefix.local` to a prefixed IRI. The third manager creates blank nodes.
   *
   * @param variableKeys - Allowed variable names.
   * @param nodeConfig - Prefixes and their allowed fields.
   * @param mode - Strictness for variable and IRI access.
   *
   * @example
   * Select names using newly created managers.
   *
   * ```ts
   * const [variables, nodes] = db.createManagers([], prefixes);
   * db.select().where(triples(variables.person, nodes.foaf.name, variables.name));
   * ```
   *
   * ```sparql
   * SELECT * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  createManagers<
    T extends string,
    K extends IriManagerConfig,
    P extends Strictness = Strictness.loose,
  >(variableKeys: readonly VariableManagerConfig<T>[], nodeConfig: K, mode?: P) {
    const blanks = createBlankManager<R>(this.factoryFunctions);
    const nodes = createIriManager(nodeConfig, mode ?? Strictness.loose, this.factoryFunctions);
    const variables = createVariableManager(
      variableKeys,
      mode ?? Strictness.loose,
      this.factoryFunctions
    );
    return [variables, nodes, blanks] as const;
  }
}
