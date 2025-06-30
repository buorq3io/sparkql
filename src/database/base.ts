import {
  IriManagerConfig,
  createIriManager,
  createPrefixManager,
  VariableManagerConfig,
  createVariableManager,
  transformIntoPrefixObject,
} from '../structures';
import { Variable } from '../struct';
import { SelectQueryBuilderBase } from './select';

export type SelectFields<T> = {
  [K in keyof T]: T[K] extends Variable ? T[K] : never ;
};

export class SparqlDatabase<T extends IriManagerConfig> {
  private readonly queryPrefixes;

  constructor(nodes: T) {
    this.queryPrefixes = transformIntoPrefixObject(nodes);
  }

  select<T>(variables?: SelectFields<T>): SelectQueryBuilderBase<T> {
    return new SelectQueryBuilderBase(variables, this.queryPrefixes);
  }

  selectDistinct<T>(variables?: SelectFields<T>): SelectQueryBuilderBase<T> {
    return new SelectQueryBuilderBase(
      variables,
      this.queryPrefixes,
      true,
      undefined
    );
  }

  selectReduced<T>(variables?: SelectFields<T>): SelectQueryBuilderBase<T> {
    return new SelectQueryBuilderBase(
      variables,
      this.queryPrefixes,
      undefined,
      true
    );
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
