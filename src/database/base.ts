import {
  createBlankManager,
  createIriManager,
  createVariableManager,
  IriManagerConfig,
  transformIntoPrefixObject,
  VariableManagerConfig,
} from '../structures/index.js';
import * as SparqlJs from 'sparqljs';
import * as RdfJs from 'rdf-data-factory';
import { AskQueryBuilderBase } from './ask.js';
import { UpdateQueryBuilderBase } from './update.js';
import {
  SelectedVariables,
  InferredSelectResult,
  SelectQueryBuilderBase,
  TypedSelectedVariables,
} from './select.js';
import { DescribeQueryBuilderBase, DescribeVariables } from './describe.js';
import { ConstructQueryBuilderBase, ConstructTemplates } from './construct.js';
import { ExcludePrefix, FactoryFunctions, IriTerm, Strictness, Variable } from '../generic.js';

export class SparqlDatabase<T extends IriManagerConfig, K extends string = 'g_'> {
  private readonly nodes;
  private readonly queryBase?: string;
  private readonly queryPrefixes;
  private readonly blankNodePrefix: K;
  protected readonly factory: RdfJs.DataFactory;
  protected readonly factoryFunctions: FactoryFunctions<K>;

  private constructor(nodes?: T, base?: string, factory?: RdfJs.DataFactory, blankNodePrefix?: K) {
    this.nodes = nodes;
    this.queryBase = base;
    this.blankNodePrefix = blankNodePrefix ?? ('g_' as K);
    this.queryPrefixes = transformIntoPrefixObject(nodes ?? {});
    this.factory = factory ?? new RdfJs.DataFactory({ blankNodePrefix: this.blankNodePrefix });

    this.factoryFunctions = {
      variable: this.variable,
      iri: this.iri,
      blank: this.blank,
      literal: this.literal,
    };
  }

  static create<T extends IriManagerConfig, K extends string = 'g_'>(
    nodes?: T,
    options?: { blankNodePrefix?: K }
  ): SparqlDatabase<T, K> {
    const blankNodePrefix = (options?.blankNodePrefix ?? ('g_' as K)) as K;
    const factory = new RdfJs.DataFactory({ blankNodePrefix });
    return new SparqlDatabase<T, K>(nodes, undefined, factory, blankNodePrefix);
  }

  public base(value: string) {
    return new SparqlDatabase<T, K>(this.nodes, value, this.factory, this.blankNodePrefix);
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
      this.queryBase,
      this.factoryFunctions
    );
  }

  selectDistinct<U extends Record<string, Variable<any, any>>>(
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
      this.queryBase,
      this.factoryFunctions,
      true,
      undefined
    );
  }

  selectReduced<U extends Record<string, Variable<any, any>>>(
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
      this.queryBase,
      this.factoryFunctions,
      undefined,
      true
    );
  }

  ask() {
    return new AskQueryBuilderBase(this.queryPrefixes, this.queryBase, this.factoryFunctions);
  }

  describe(...variables: DescribeVariables): DescribeQueryBuilderBase {
    return new DescribeQueryBuilderBase(
      variables,
      this.queryPrefixes,
      this.queryBase,
      this.factoryFunctions
    );
  }

  construct(...templates: ConstructTemplates): ConstructQueryBuilderBase {
    return new ConstructQueryBuilderBase(
      templates,
      this.queryPrefixes,
      this.queryBase,
      this.factoryFunctions
    );
  }

  update() {
    return new UpdateQueryBuilderBase(
      [],
      this.queryPrefixes,
      this.queryBase,
      this.factoryFunctions
    );
  }

  variable = (value: string): SparqlJs.VariableTerm => {
    return Object.freeze(this.factory.variable(value));
  };

  iri = <T extends string>(value: T): SparqlJs.IriTerm => {
    return Object.freeze(this.factory.namedNode(value));
  };

  blank = <T extends string>(value?: ExcludePrefix<T, K>): SparqlJs.BlankTerm => {
    if (value && value.startsWith(this.blankNodePrefix)) {
      throw Error(
        `For blank terms, the prefix "${this.blankNodePrefix}" is reserved for internal use.`
      );
    }
    return Object.freeze(this.factory.blankNode(value));
  };

  literal = (value: string, lang?: string | IriTerm): SparqlJs.LiteralTerm => {
    return Object.freeze(this.factory.literal(value, lang));
  };

  resetBlankCounter() {
    this.factory.resetBlankNodeCounter();
  }

  create<T extends string, K extends IriManagerConfig, P extends Strictness = Strictness.loose>(
    variableKeys: readonly VariableManagerConfig<T>[],
    nodeConfig: K,
    mode?: P
  ) {
    const blanks = createBlankManager(this.factoryFunctions);
    const nodes = createIriManager(nodeConfig, mode ?? Strictness.loose, this.factoryFunctions);
    const variables = createVariableManager(
      variableKeys,
      mode ?? Strictness.loose,
      this.factoryFunctions
    );
    return [variables, nodes, blanks] as const;
  }
}
