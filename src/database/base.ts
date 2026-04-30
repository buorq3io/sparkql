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
  Strictness,
  TermIriInput,
  TermVariableInput,
} from '../helpers/types.js';
import { termIri } from '../helpers/utilities.js';

interface PrivateSparqlDatabaseOptions<T extends IriManagerConfig, K extends string = 'g_'>
  extends SparqlDatabaseOptions<T, K> {
  base?: string;
  factory?: AST.AstFactory;
}

export interface SparqlDatabaseOptions<T extends IriManagerConfig, K extends string = 'g_'> {
  prefixes?: T;
  blankNodePrefix?: K;
  endpointUrl?: string;
}

export class SparqlDatabase<T extends IriManagerConfig, R extends string = 'g_'> {
  private readonly nodes;
  private readonly endpointUrl?: string;
  private readonly queryPrefixes;
  private readonly blankNodePrefix: R;
  protected readonly factory: AST.AstFactory;
  protected readonly factoryFunctions: FactoryFunctions;

  private constructor(options?: PrivateSparqlDatabaseOptions<T, R>) {
    this.nodes = options?.prefixes;
    this.endpointUrl = options?.endpointUrl;
    this.blankNodePrefix = options?.blankNodePrefix ?? ('g_' as R);
    this.queryPrefixes = transformIntoPrefixObject(options?.prefixes ?? {});
    this.factory = options?.factory ?? new AST.AstFactory();
    this.factoryFunctions = {
      variable: value => this.variable(value),
      iri: (value, prefix) => prefix === undefined ? this.iri(value) : this.iri(value, prefix),
      blank: value => this.blank(value),
      literal: (value, lang) => this.literal(value, lang),
    };
  }

  static create<T extends IriManagerConfig, K extends string = 'g_'>(
    options?: SparqlDatabaseOptions<T, K>
  ): SparqlDatabase<T, K> {
    const factory = new AST.AstFactory();
    return new SparqlDatabase<T, K>({
      ...options,
      factory: factory,
    });
  }

  public base(value: string) {
    return new SparqlDatabase<T, R>({
      blankNodePrefix: this.blankNodePrefix,
      prefixes: this.nodes,
      factory: this.factory,
      base: value,
    });
  }

  select<U extends SelectedVariables>(
    variables?: U
  ): SelectQueryBuilderBase<InferredSelectResult<U>>;

  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): SelectQueryBuilderBase<U>;

  select<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): SelectQueryBuilderBase<U> {
    return new SelectQueryBuilderBase(
      variables,
      this.queryPrefixes,
      this.factoryFunctions,
      undefined,
      undefined,
      this.endpointUrl
    );
  }

  selectDistinct<U extends SelectedVariables>(
    variables?: U
  ): SelectQueryBuilderBase<InferredSelectResult<U>>;

  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): SelectQueryBuilderBase<U>;

  selectDistinct<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): SelectQueryBuilderBase<U> {
    return new SelectQueryBuilderBase(
      variables,
      this.queryPrefixes,
      this.factoryFunctions,
      true,
      undefined,
      this.endpointUrl
    );
  }

  selectReduced<U extends SelectedVariables>(
    variables?: U
  ): SelectQueryBuilderBase<InferredSelectResult<U>>;

  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): SelectQueryBuilderBase<U>;

  selectReduced<U extends Record<string, any>>(
    variables?: TypedSelectedVariables<U>
  ): SelectQueryBuilderBase<U> {
    return new SelectQueryBuilderBase(
      variables,
      this.queryPrefixes,
      this.factoryFunctions,
      undefined,
      true,
      this.endpointUrl
    );
  }

  ask() {
    return new AskQueryBuilderBase(this.queryPrefixes, this.factoryFunctions, this.endpointUrl);
  }

  describe(...variables: (TermIriInput | TermVariableInput)[]): DescribeQueryBuilderBase {
    return new DescribeQueryBuilderBase(
      variables,
      this.queryPrefixes,
      this.factoryFunctions,
      this.endpointUrl
    );
  }

  construct(...templates: BasicGraphPatternInput): ConstructQueryBuilderBase {
    return new ConstructQueryBuilderBase(
      templates,
      this.queryPrefixes,
      this.factoryFunctions,
      this.endpointUrl
    );
  }

  update() {
    return new UpdateQueryBuilderBase(this.queryPrefixes, this.factoryFunctions, this.endpointUrl);
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

  create<T extends string, K extends IriManagerConfig, P extends Strictness = Strictness.loose>(
    variableKeys: readonly VariableManagerConfig<T>[],
    nodeConfig: K,
    mode?: P
  ) {
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
