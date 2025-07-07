import {
  IriManagerConfig,
  createIriManager,
  createPrefixManager,
  VariableManagerConfig,
  createVariableManager,
  transformIntoPrefixObject,
} from '../structures';
import { Variable } from '../generic';
import { AskQueryBuilderBase } from './ask';
import { SelectQueryBuilderBase } from './select';

export type SelectVariables<T extends Record<string, any>> = {
  [K in keyof T]: Variable<T[K]>;
};

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
}

export function createObjects<T extends string, K extends IriManagerConfig>(
  variableKeys: readonly VariableManagerConfig<T>[],
  nodeConfig: K
) {
  const nodes = createIriManager(nodeConfig);
  const prefixes = createPrefixManager(nodeConfig);
  const variables = createVariableManager(...variableKeys);
  return [variables, nodes, prefixes] as const;
}
