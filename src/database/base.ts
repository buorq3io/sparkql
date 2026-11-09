import * as AST from '@traqula/rules-sparql-1-1';
import type { Formatter } from '../helpers/generators.js';
import type { FormatInput, TermFormats } from '../helpers/term-formats.js';
import {
  type FactoryFunctions,
  type PatternBgpInput,
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
import { DescribeQueryBuilderBase } from './describe.js';
import { type AnySparqlDialect, type SparqlDialect, sparql11Dialect } from './dialect.js';
import {
  HttpSparqlSession,
  type SparqlConnectionOptions,
  type SparqlHttpClient,
} from './http-session.js';
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
import { isSparqlSession, type SparqlSession } from './session.js';
import { UpdateQueryBuilderBase } from './update.js';

interface PrivateSparqlDatabaseOptions {
  context: QueryInput['context'];
  formats?: TermFormats;
  factory?: AST.AstFactory;
  session?: SparqlSession;
  dialect?: AnySparqlDialect;
}

export interface SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  D extends AnySparqlDialect = SparqlDialect,
> {
  dialect?: D;
  formats?: F & TermFormats;
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
    throw new Error(
      'Pass only one of `connection`, `client`, `session` or the deprecated `endpointUrl`/`updateUrl`.'
    );
  if (session !== undefined) {
    if (!isSparqlSession(session))
      throw new Error('`session` must implement bindings, boolean, quads, update and raw.');
    return session;
  }
  if (client !== undefined) return new HttpSparqlSession({ client });
  if (connection !== undefined) return new HttpSparqlSession({ connection });
  if (legacy) return new HttpSparqlSession({ connection: { endpointUrl, updateUrl } });
  return undefined;
}

export class SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  D extends AnySparqlDialect = SparqlDialect,
  C extends AnySparqlClient = AnySparqlClient,
> {
  private readonly dialect: D;
  private readonly formats: TermFormats;
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
    this.$session = options?.session;
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
      dialect: this.dialect,
      session: this.$session,
      normalizer: input =>
        new QueryNormalizer(input ?? emptySelect(this.initialContext), moduleContext),
    };
    this.moduleContext = moduleContext;
    for (const [name, factory] of Object.entries(this.dialect.queries ?? {})) {
      if (name === 'then' || name in this)
        throw new Error(`Query module name conflicts with database member: ${name}`);
      Object.defineProperty(this, name, { value: factory(moduleContext), enumerable: true });
    }
  }

  /**
   * The `sparql-http-client` instance behind the default HTTP session: the
   * `client` passed to `create()`, or a promise of the one created from
   * `connection`. `undefined` for custom-session and build-only databases.
   */
  get $client(): C {
    return (this.$session instanceof HttpSparqlSession ? this.$session.client : undefined) as C;
  }

  /**
   * Creates a database. Configure the transport once with `connection`
   * (options for the default HTTP session), `client` (a ready
   * `sparql-http-client` instance) or `session` (any {@link SparqlSession}).
   * Without one the database is build-only: queries generate SPARQL and
   * reject when awaited.
   */
  static create<
    T extends IriManagerConfig,
    K extends string = 'g_',
    F extends TermFormats = {},
    D extends AnySparqlDialect = SparqlDialect,
    C extends SparqlHttpClient = SparqlHttpClient,
  >(
    options: SparqlDatabaseOptions<T, F, D> & { client: C }
  ): WithQueryMethods<SparqlDatabase<T, K, F, D, C>, D>;
  static create<
    T extends IriManagerConfig,
    K extends string = 'g_',
    F extends TermFormats = {},
    D extends AnySparqlDialect = SparqlDialect,
  >(
    options?: SparqlDatabaseOptions<T, F, D>
  ): WithQueryMethods<SparqlDatabase<T, K, F, D, DefaultSparqlClient>, D>;
  static create<
    T extends IriManagerConfig,
    K extends string = 'g_',
    F extends TermFormats = {},
    D extends AnySparqlDialect = SparqlDialect,
  >(options?: SparqlDatabaseOptions<T, F, D>): WithQueryMethods<SparqlDatabase<T, K, F, D>, D> {
    return new SparqlDatabase<T, K, F, D>({
      dialect: options?.dialect,
      formats: options?.formats,
      session: resolveSession(options),
      context: transformIntoPrefixObject(options?.managerConfig ?? {}),
    }) as WithQueryMethods<SparqlDatabase<T, K, F, D>, D>;
  }

  base(value: string): this {
    return new SparqlDatabase<T, R, F, D>({
      dialect: this.dialect,
      formats: this.formats,
      session: this.$session,
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

  prefix(values: { [x in string]: string }): this {
    return new SparqlDatabase<T, R, F, D>({
      dialect: this.dialect,
      formats: this.formats,
      session: this.$session,
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

  select<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>, D>>;

  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>>;

  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>> {
    return new SelectQueryBuilderBase<U, D>(this.moduleContext, { variables });
  }

  selectDistinct<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>, D>>;

  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>>;

  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>> {
    return new SelectQueryBuilderBase<U, D>(this.moduleContext, { variables, distinct: true });
  }

  selectReduced<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>, D>>;

  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>>;

  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U, D>> {
    return new SelectQueryBuilderBase<U, D>(this.moduleContext, { variables, reduced: true });
  }

  ask(): RootQueryBuilderBaseWithout<AskQueryBuilderBase<D>> {
    return new AskQueryBuilderBase<D>(this.moduleContext);
  }

  describe(
    ...variables: (TermIriInput | TermVariableInput)[]
  ): RootQueryBuilderBaseWithout<DescribeQueryBuilderBase<D>> {
    return new DescribeQueryBuilderBase<D>(this.moduleContext, variables);
  }

  construct(
    ...templates: PatternBgpInput[]
  ): RootQueryBuilderBaseWithout<ConstructQueryBuilderBase<D>> {
    return new ConstructQueryBuilderBase<D>(this.moduleContext, templates);
  }

  insertData(...quads: QuadsInput[]) {
    return this.update().insertData(...quads);
  }

  deleteData(...quads: QuadsInput[]) {
    return this.update().deleteData(...quads);
  }

  deleteWhere(...quads: QuadsInput[]) {
    return this.update().deleteWhere(...quads);
  }

  insert(...quads: QuadsInput[]) {
    return this.update().insert(...quads);
  }

  delete(...quads: QuadsInput[]) {
    return this.update().delete(...quads);
  }

  with(graph: TermIriInput) {
    return this.update().with(graph);
  }

  copy(source: TermIriInput) {
    return this.update().copy(source);
  }

  copyDefault() {
    return this.update().copyDefault();
  }

  copySilent(source: TermIriInput) {
    return this.update().copySilent(source);
  }

  copySilentDefault() {
    return this.update().copySilentDefault();
  }

  move(source: TermIriInput) {
    return this.update().move(source);
  }

  moveDefault() {
    return this.update().moveDefault();
  }

  moveSilent(source: TermIriInput) {
    return this.update().moveSilent(source);
  }

  moveSilentDefault() {
    return this.update().moveSilentDefault();
  }

  add(source: TermIriInput) {
    return this.update().add(source);
  }

  addDefault() {
    return this.update().addDefault();
  }

  addSilent(source: TermIriInput) {
    return this.update().addSilent(source);
  }

  addSilentDefault() {
    return this.update().addSilentDefault();
  }

  load(source: TermIriInput) {
    return this.update().load(source);
  }

  loadInto(source: TermIriInput, destination: TermIriInput) {
    return this.update().loadInto(source, destination);
  }

  loadSilent(source: TermIriInput) {
    return this.update().loadSilent(source);
  }

  loadSilentInto(source: TermIriInput, destination: TermIriInput) {
    return this.update().loadSilentInto(source, destination);
  }

  create(graph: TermIriInput) {
    return this.update().create(graph);
  }

  createSilent(graph: TermIriInput) {
    return this.update().createSilent(graph);
  }

  clear(graph: TermIriInput) {
    return this.update().clear(graph);
  }

  clearAll() {
    return this.update().clearAll();
  }

  clearDefault() {
    return this.update().clearDefault();
  }

  clearNamed() {
    return this.update().clearNamed();
  }

  clearSilent(graph: TermIriInput) {
    return this.update().clearSilent(graph);
  }

  clearSilentAll() {
    return this.update().clearSilentAll();
  }

  clearSilentDefault() {
    return this.update().clearSilentDefault();
  }

  clearSilentNamed() {
    return this.update().clearSilentNamed();
  }

  drop(graph: TermIriInput) {
    return this.update().drop(graph);
  }

  dropAll() {
    return this.update().dropAll();
  }

  dropDefault() {
    return this.update().dropDefault();
  }

  dropNamed() {
    return this.update().dropNamed();
  }

  dropSilent(graph: TermIriInput) {
    return this.update().dropSilent(graph);
  }

  dropSilentAll() {
    return this.update().dropSilentAll();
  }

  dropSilentDefault() {
    return this.update().dropSilentDefault();
  }

  dropSilentNamed() {
    return this.update().dropSilentNamed();
  }

  protected update() {
    return new UpdateQueryBuilderBase<D>(this.moduleContext);
  }

  variable(value: string): AST.TermVariable {
    return this.factory.termVariable(value, { sourceLocationType: 'autoGenerate' });
  }

  iri(value: string): AST.TermIriFull;
  iri(value: string, prefix: string): AST.TermIriPrefixed;
  iri(value: TermIriInput | FormatInput<F, 'iri'>): AST.TermIri;
  iri(value: string | TermIriInput | FormatInput<F, 'iri'>, prefix?: string): AST.TermIri {
    if (typeof value === 'string') {
      return prefix === undefined
        ? this.factory.termNamed({ sourceLocationType: 'autoGenerate' }, value)
        : this.factory.termNamed({ sourceLocationType: 'autoGenerate' }, value, prefix);
    }
    return this.formatTerm(value, this.formats.iri, termIri);
  }

  blank(value?: string | TermBlankInput | FormatInput<F, 'blank'>): AST.TermBlank {
    if (value === undefined)
      return this.factory.termBlank(undefined, { sourceLocationType: 'autoGenerate' });
    if (typeof value === 'string') {
      return this.factory.termBlank(value, { sourceLocationType: 'autoGenerate' });
    }
    return this.formatTerm(value, this.formats.blank, termBlank);
  }

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

  resetBlankCounter() {
    this.factory.resetBlankNodeCounter();
  }

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
