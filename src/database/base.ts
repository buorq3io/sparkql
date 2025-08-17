import {
  IriManagerConfig,
  createIriManager,
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
import { BlankTerm, IriTerm, LiteralTerm, VariableTerm } from '../generic';

export class SparqlDatabase<T extends IriManagerConfig> {
  private readonly queryPrefixes;
  protected readonly factory: DataFactory = new DataFactory();

  constructor(nodes: T) {
    this.queryPrefixes = transformIntoPrefixObject(nodes);
  }

  select<U extends Record<string, any> = Record<string, any>>(
    variables?: SelectVariables<U>
  ): SelectQueryBuilderBase<U> {
    return new SelectQueryBuilderBase(variables, this.queryPrefixes);
  }

  selectDistinct<U extends Record<string, any> = Record<string, any>>(
    variables?: SelectVariables<U>
  ): SelectQueryBuilderBase<U> {
    return new SelectQueryBuilderBase(variables, this.queryPrefixes, true, undefined);
  }

  selectReduced<U extends Record<string, any> = Record<string, any>>(
    variables?: SelectVariables<U>
  ): SelectQueryBuilderBase<U> {
    return new SelectQueryBuilderBase(variables, this.queryPrefixes, undefined, true);
  }

  ask() {
    return new AskQueryBuilderBase(this.queryPrefixes);
  }

  describe(...variables: DescribeVariables): DescribeQueryBuilderBase {
    return new DescribeQueryBuilderBase(variables, this.queryPrefixes);
  }

  construct(...templates: ConstructTemplates): ConstructQueryBuilderBase {
    return new ConstructQueryBuilderBase(templates, this.queryPrefixes);
  }

  update() {
    return new UpdateQueryBuilderBase([], this.queryPrefixes);
  }

  variable(value: string): VariableTerm {
    return this.factory.variable(value);
  }

  iri<T extends string>(value: T): IriTerm {
    return this.factory.namedNode(value);
  }

  blank<T extends string>(value?: T): BlankTerm {
    return this.factory.blankNode(value);
  }

  literal(value: string, lang?: string | IriTerm): LiteralTerm {
    return this.factory.literal(value, lang);
  }

  create<T extends string, K extends IriManagerConfig, P extends 'strict' | 'allow' = 'allow'>(
    variableKeys: readonly VariableManagerConfig<T>[],
    nodeConfig: K,
    mode?: P
  ) {
    const nodes = createIriManager(nodeConfig, mode ?? 'allow', this.iri);
    const variables = createVariableManager(variableKeys, mode ?? 'allow', this.variable);
    return [variables, nodes] as const;
  }
}
