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
  BasicGraphPatternInput,
  FactoryFunctions,
  GraphRefDefaultInput,
  GraphRefInput,
  GraphRefSpecificInput,
  QuadsInput,
  QueryInput,
  Strictness,
  TermIriInput,
  TermVariableInput,
} from '../helpers/types.js';
import { termIri } from '../helpers/utilities.js';
import { RootQueryBuilderBaseWithout } from './query.js';

interface PrivateSparqlDatabaseOptions<T extends IriManagerConfig>
  extends SparqlDatabaseOptions<T> {
  context?: QueryInput['context'];
  factory?: AST.AstFactory;
  managerConfig?: never;
}

export interface SparqlDatabaseOptions<T extends IriManagerConfig> {
  managerConfig?: T;
  endpointUrl?: string;
}

export class SparqlDatabase<T extends IriManagerConfig, R extends string = 'g_'> {
  private readonly endpointUrl?: string;
  private readonly initialContext;
  private readonly factory: AST.AstFactory;
  protected readonly factoryFunctions: FactoryFunctions;

  private constructor(options?: PrivateSparqlDatabaseOptions<T>) {
    this.endpointUrl = options?.endpointUrl;
    this.initialContext = transformIntoPrefixObject(options?.managerConfig ?? {});
    this.factory = options?.factory ?? new AST.AstFactory();
    this.factoryFunctions = {
      variable: value => this.variable(value),
      iri: (value, prefix) => (prefix === undefined ? this.iri(value) : this.iri(value, prefix)),
      blank: value => this.blank(value),
      literal: (value, lang) => this.literal(value, lang),
    };
  }

  static create<T extends IriManagerConfig, K extends string = 'g_'>(
    options?: SparqlDatabaseOptions<T>
  ): SparqlDatabase<T, K> {
    return new SparqlDatabase<T, K>({
      endpointUrl: options?.endpointUrl,
      context: transformIntoPrefixObject(options?.managerConfig ?? {}),
    });
  }

  base(value: string) {
    return new SparqlDatabase<T, R>({
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
    return new SparqlDatabase<T, R>({
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
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>>>;

  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U>>;

  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U>> {
    return new SelectQueryBuilderBase(
      variables,
      this.initialContext,
      this.factoryFunctions,
      undefined,
      undefined,
      this.endpointUrl
    );
  }

  selectDistinct<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>>>;

  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U>>;

  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U>> {
    return new SelectQueryBuilderBase(
      variables,
      this.initialContext,
      this.factoryFunctions,
      true,
      undefined,
      this.endpointUrl
    );
  }

  selectReduced<U extends SelectedVariables>(
    variables?: U
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<InferredSelectResult<U>>>;

  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U>>;

  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): RootQueryBuilderBaseWithout<SelectQueryBuilderBase<U>> {
    return new SelectQueryBuilderBase(
      variables,
      this.initialContext,
      this.factoryFunctions,
      undefined,
      true,
      this.endpointUrl
    );
  }

  ask(): RootQueryBuilderBaseWithout<AskQueryBuilderBase> {
    return new AskQueryBuilderBase(this.initialContext, this.factoryFunctions, this.endpointUrl);
  }

  describe(...variables: (TermIriInput | TermVariableInput)[]): RootQueryBuilderBaseWithout<DescribeQueryBuilderBase> {
    return new DescribeQueryBuilderBase(
      variables,
      this.initialContext,
      this.factoryFunctions,
      this.endpointUrl
    );
  }

  construct(...templates: BasicGraphPatternInput): RootQueryBuilderBaseWithout<ConstructQueryBuilderBase> {
    return new ConstructQueryBuilderBase(
      templates,
      this.initialContext,
      this.factoryFunctions,
      this.endpointUrl
    );
  }

  insert(...quads: QuadsInput[]) {
    return this.update().insert(...quads);
  }

  delete(...quads: QuadsInput[]) {
    return this.update().delete(...quads);
  }

  deleteWhere(...quads: QuadsInput[]) {
    return this.update().deleteWhere(...quads);
  }

  with(iri?: TermIriInput) {
    return this.update().with(iri);
  }

  copy(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.update().copy(source, destination);
  }

  copySilent(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.update().copySilent(source, destination);
  }

  move(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.update().move(source, destination);
  }

  moveSilent(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.update().moveSilent(source, destination);
  }

  add(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.update().add(source, destination);
  }

  addSilent(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.update().addSilent(source, destination);
  }

  load(source: TermIriInput, destination?: GraphRefSpecificInput) {
    return this.update().load(source, destination);
  }

  loadSilent(source: TermIriInput, destination?: GraphRefSpecificInput) {
    return this.update().loadSilent(source, destination);
  }

  create(graph: GraphRefSpecificInput) {
    return this.update().create(graph);
  }

  createSilent(graph: GraphRefSpecificInput) {
    return this.update().createSilent(graph);
  }

  clear(graph: GraphRefInput) {
    return this.update().clear(graph);
  }

  clearSilent(graph: GraphRefInput) {
    return this.update().dropSilent(graph);
  }

  drop(graph: GraphRefInput) {
    return this.update().drop(graph);
  }

  dropSilent(graph: GraphRefInput) {
    return this.update().dropSilent(graph);
  }

  protected update() {
    return new UpdateQueryBuilderBase(this.initialContext, this.factoryFunctions, this.endpointUrl);
  }

  variable(value: string): AST.TermVariable {
    return this.factory.termVariable(value, { sourceLocationType: 'autoGenerate' });
  }

  iri(value: string): AST.TermIriFull;
  iri(value: string, prefix: string): AST.TermIriPrefixed;
  iri(value: string, prefix?: string): AST.TermIri {
    return prefix === undefined
      ? this.factory.termNamed({ sourceLocationType: 'autoGenerate' }, value)
      : this.factory.termNamed({ sourceLocationType: 'autoGenerate' }, value, prefix);
  }

  blank(value?: string): AST.TermBlank {
    return this.factory.termBlank(value, { sourceLocationType: 'autoGenerate' });
  }

  literal(value: string, lang?: string | TermIriInput): AST.TermLiteral {
    return this.factory.termLiteral(
      { sourceLocationType: 'autoGenerate' },
      value,
      typeof lang === 'string' || !lang ? lang : termIri.parseOrThrow(lang, this.factoryFunctions)
    );
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
