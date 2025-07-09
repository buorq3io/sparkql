import {
  IriManagerConfig,
  createIriManager,
  VariableManagerConfig,
  createVariableManager,
  transformIntoPrefixObject,
} from '../structures';
import { AskQueryBuilderBase } from './ask';
import { UpdateQueryBuilderBase } from './update';
import { SelectQueryBuilderBase, SelectVariables } from './select';
import { DescribeQueryBuilderBase, DescribeVariables } from './describe';
import { ConstructQueryBuilderBase, ConstructTemplates } from './construct';

export class SparqlDatabase<T extends IriManagerConfig> {
  private readonly queryPrefixes;

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
    return new SelectQueryBuilderBase(
      variables,
      this.queryPrefixes,
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
      undefined,
      true
    );
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
}

export function createObjects<
  T extends string,
  K extends IriManagerConfig,
  P extends 'strict' | 'allow' = 'allow'
>(variableKeys: readonly VariableManagerConfig<T>[], nodeConfig: K, mode?: P) {
  const nodes = createIriManager(nodeConfig, mode ?? 'allow');
  const variables = createVariableManager(variableKeys, mode ?? 'allow');
  return [variables, nodes] as const;
}
