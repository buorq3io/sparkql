import type * as SparqlJs from 'sparqljs';
import {
  IriManagerConfig,
  createIriManager,
  createBlankManager,
  VariableManagerConfig,
  createVariableManager,
  transformIntoPrefixObject,
} from '../structures';
import { DataFactory } from 'rdf-data-factory';
import { AskQueryBuilderBase } from './ask';
import { UpdateQueryBuilderBase } from './update';
import { SelectQueryBuilderBase, SelectVariables } from './select';
import { DescribeQueryBuilderBase, DescribeVariables } from './describe';
import { ConstructQueryBuilderBase, ConstructTemplates } from './construct';
import { BlankPrefix, FactoryFunctions, IriTerm } from '../generic';

export class SparqlDatabase<T extends IriManagerConfig> {
  private readonly nodes;
  private readonly queryBase?: string;
  private readonly queryPrefixes;
  protected readonly factory: DataFactory;
  protected readonly factoryFunctions: FactoryFunctions;

  constructor(nodes: T, base?: string, factory?: DataFactory) {
    this.nodes = nodes;
    this.queryBase = base;
    this.queryPrefixes = transformIntoPrefixObject(nodes);
    this.factory = factory ?? new DataFactory({ blankNodePrefix: 'g_' });

    this.factoryFunctions = {
      variable: this.variable,
      iri: this.iri,
      blank: this.blank,
      literal: this.literal,
    };
  }

  public base(value: string) {
    return new SparqlDatabase(this.nodes, value, this.factory);
  }

  select<U extends Record<string, any> = Record<string, any>>(
    variables?: SelectVariables<U>
  ): SelectQueryBuilderBase<U> {
    return new SelectQueryBuilderBase(
      variables,
      this.queryPrefixes,
      this.queryBase,
      this.factoryFunctions
    );
  }

  selectDistinct<U extends Record<string, any> = Record<string, any>>(
    variables?: SelectVariables<U>
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

  selectReduced<U extends Record<string, any> = Record<string, any>>(
    variables?: SelectVariables<U>
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
    return this.factory.variable(value);
  };

  iri = <T extends string>(value: T): SparqlJs.IriTerm => {
    return this.factory.namedNode(value);
  };

  blank = <T extends string>(value?: BlankPrefix<T>): SparqlJs.BlankTerm => {
    if (value && (value.startsWith('e_') || value.startsWith('g_'))) {
      throw Error('For blank terms, prefixes "e_" and "g_" are reserved for internal use.');
    }
    return this.factory.blankNode(value);
  };

  literal = (value: string, lang?: string | IriTerm): SparqlJs.LiteralTerm => {
    return this.factory.literal(value, lang);
  };

  resetBlankCounter() {
    this.factory.resetBlankNodeCounter();
  }

  create<T extends string, K extends IriManagerConfig, P extends 'strict' | 'allow' = 'allow'>(
    variableKeys: readonly VariableManagerConfig<T>[],
    nodeConfig: K,
    mode?: P
  ) {
    const blanks = createBlankManager(this.factoryFunctions);
    const nodes = createIriManager(nodeConfig, mode ?? 'allow', this.factoryFunctions);
    const variables = createVariableManager(variableKeys, mode ?? 'allow', this.factoryFunctions);
    return [variables, nodes, blanks] as const;
  }
}
