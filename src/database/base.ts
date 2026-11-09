import { sparql11Dialect, type AnySparqlDialect, type SparqlDialect } from './dialect.js';
import * as AST from '@traqula/rules-sparql-1-1';

import {
  createBlankManager,
  createIriManager,
  createVariableManager,
  IriManagerConfig,
  transformIntoPrefixObject,
  VariableManagerConfig,
} from '../structures/index.js';
import { AskQueryBuilderBase } from './ask.js';
import { UpdateQueryBuilderBase } from './update.js';
import {
  SelectedVariables,
  InferredSelectResult,
  SelectQueryBuilderBase,
  TypedSelectedVariables,
} from './select.js';
import { DescribeQueryBuilderBase } from './describe.js';
import { ConstructQueryBuilderBase } from './construct.js';
import {
  FactoryFunctions,
  PatternBgpInput,
  QuadsInput,
  QueryInput,
  Strictness,
  TermIriInput,
  TermLiteralInput,
  TermBlankInput,
  TermVariableInput,
} from '../helpers/types.js';
import { termIri, termLiteral, termBlank } from '../helpers/utilities.js';
import { FormatInput, TermFormats } from '../helpers/term-formats.js';
import { Formatter } from '../helpers/generators.js';
import { RootQueryBuilderBaseWithout } from './query.js';

interface PrivateSparqlDatabaseOptions {
  context: QueryInput['context'];
  formats?: TermFormats;
  factory?: AST.AstFactory;
  endpointUrl?: string;
  dialect?: AnySparqlDialect;
}

export interface SparqlDatabaseOptions<
  T extends IriManagerConfig,
  F extends TermFormats = {},
  D extends AnySparqlDialect = SparqlDialect
> {
  dialect?: D;
  formats?: F & TermFormats;
  managerConfig?: T;
  endpointUrl?: string;
}

export class SparqlDatabase<
  T extends IriManagerConfig,
  R extends string = 'g_',
  F extends TermFormats = {},
  D extends AnySparqlDialect = SparqlDialect
> {
  private readonly dialect: D;
  private readonly formats: TermFormats;
  private readonly endpointUrl?: string;
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
    this.endpointUrl = options?.endpointUrl;
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
  }

  static create<
    T extends IriManagerConfig,
    K extends string = 'g_',
    F extends TermFormats = {},
    D extends AnySparqlDialect = SparqlDialect
  >(options?: SparqlDatabaseOptions<T, F, D>): SparqlDatabase<T, K, F, D> {
    return new SparqlDatabase<T, K, F, D>({
      dialect: options?.dialect,
      formats: options?.formats,
      endpointUrl: options?.endpointUrl,
      context: transformIntoPrefixObject(options?.managerConfig ?? {}),
    });
  }

  base(value: string) {
    return new SparqlDatabase<T, R, F, D>({
      dialect: this.dialect,
      formats: this.formats,
      endpointUrl: this.endpointUrl,
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
    });
  }

  prefix(values: { [x in string]: string }) {
    return new SparqlDatabase<T, R, F, D>({
      dialect: this.dialect,
      formats: this.formats,
      endpointUrl: this.endpointUrl,
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
            } as const)
        ),
      ],
    });
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
    return new SelectQueryBuilderBase<U, D>(
      variables,
      this.initialContext,
      this.factoryFunctions,
      undefined,
      undefined,
      this.endpointUrl,
      this.dialect
    );
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
    return new SelectQueryBuilderBase<U, D>(
      variables,
      this.initialContext,
      this.factoryFunctions,
      true,
      undefined,
      this.endpointUrl,
      this.dialect
    );
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
    return new SelectQueryBuilderBase<U, D>(
      variables,
      this.initialContext,
      this.factoryFunctions,
      undefined,
      true,
      this.endpointUrl,
      this.dialect
    );
  }

  ask(): RootQueryBuilderBaseWithout<AskQueryBuilderBase<D>> {
    return new AskQueryBuilderBase<D>(
      this.initialContext,
      this.factoryFunctions,
      this.endpointUrl,
      this.dialect
    );
  }

  describe(
    ...variables: (TermIriInput | TermVariableInput)[]
  ): RootQueryBuilderBaseWithout<DescribeQueryBuilderBase<D>> {
    return new DescribeQueryBuilderBase<D>(
      variables,
      this.initialContext,
      this.factoryFunctions,
      this.endpointUrl,
      this.dialect
    );
  }

  construct(
    ...templates: PatternBgpInput[]
  ): RootQueryBuilderBaseWithout<ConstructQueryBuilderBase<D>> {
    return new ConstructQueryBuilderBase<D>(
      templates,
      this.initialContext,
      this.factoryFunctions,
      this.endpointUrl,
      this.dialect
    );
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
    return new UpdateQueryBuilderBase<D>(
      this.initialContext,
      this.factoryFunctions,
      this.endpointUrl,
      this.dialect
    );
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
    P extends Strictness = Strictness.loose
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
