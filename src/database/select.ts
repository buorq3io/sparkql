import {
  Variable,
  VariableTerm,
  Grouping,
  Ordering,
  Presence,
  Expression,
  SelectQuery,
  SparqlClient,
  Transform,
  OptionalTransform,
  FactoryFunctions,
  BaseQueryReturnType,
} from '../generic.js';
import { QueryBuilderBase } from './query.js';
import { group } from '../structures/index.js';

export type SelectVariables<T extends Record<string, any>> = {
  [K in keyof T]-?: undefined extends T[K]
    ? Variable<Exclude<T[K], undefined>, Presence.optional> | Variable<T[K], Presence>
    : Variable<T[K]>;
};

export type ExtractDataType<V> = V extends Variable<infer T, any> ? T : never;
export type ExtractPresenceType<V> = V extends Variable<any, infer P> ? P : never;

export type InferredSelectResult<T extends Record<string, Variable<any, any>>> = {
  [K in keyof T]: ExtractPresenceType<T[K]> extends Presence.optional
    ? ExtractDataType<T[K]> | undefined
    : ExtractDataType<T[K]>;
};

export class SelectQueryBuilderBase<T extends Record<string, any>>
  extends QueryBuilderBase<SelectQuery, T[]>
  implements PromiseLike<T[]>
{
  private lookup: Record<string, string> = {};
  private lookupTransform: Record<string, OptionalTransform | Transform | undefined> = {};

  constructor(
    variables: SelectVariables<T> | undefined,
    prefixes: SelectQuery['prefixes'],
    base: string | undefined,
    factoryFunctions: FactoryFunctions,
    distict: SelectQuery['distinct'] = undefined,
    reduced: SelectQuery['reduced'] = undefined
  ) {
    super(
      {
        type: 'query',
        queryType: 'SELECT',
        variables: variables ? <Variable[]>Object.values(variables) : [],
        base: base,
        prefixes: prefixes,
      },
      factoryFunctions
    );

    function isVariableTerm<T extends BaseQueryReturnType, K extends Presence>(
      obj: any
    ): obj is VariableTerm<T, K> {
      return (
        typeof obj === 'object' && obj !== null && 'termType' in obj && obj.termType === 'Variable'
      );
    }

    function createMaybeTransform<T extends BaseQueryReturnType, K extends any[]>(
      t: Transform<T, K>
    ): OptionalTransform<T, K> {
      return (self: BaseQueryReturnType | undefined, ...other: K) => {
        if (!self) {
          return;
        }
        return t(self, ...other);
      };
    }

    for (const key in variables) {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        const value = variables[key];
        // Case 1: The value is a Variable directly
        if (isVariableTerm(value)) {
          this.lookup[value.value] = key;
          if (value.presence === Presence.optional) {
            this.lookupTransform[value.value] = value.transform
              ? createMaybeTransform(value.transform)
              : undefined;
          } else {
            this.lookupTransform[value.value] = value.transform ? value.transform : undefined;
          }
        }
        // Case 2: The value is an object that contains a 'variable' property
        else if (
          typeof value === 'object' &&
          value !== null &&
          'variable' in value &&
          isVariableTerm(value.variable)
        ) {
          this.lookup[value.variable.value] = key;
          if (value.variable.presence === Presence.optional) {
            this.lookupTransform[value.variable.value] = value.variable.transform
              ? createMaybeTransform(value.variable.transform)
              : undefined;
          } else {
            this.lookupTransform[value.variable.value] = value.variable.transform
              ? value.variable.transform
              : undefined;
          }
        }
      }
    }

    if (distict != undefined) {
      this.config.distinct = distict;
    }

    if (reduced != undefined) {
      this.config.reduced = reduced;
    }
  }

  having(...expressions: Expression[]) {
    if (expressions.length === 0) {
      return this;
    }

    if (this.config.having) {
      this.config.having = [...this.config.having, ...expressions];
    } else {
      this.config.having = expressions;
    }
    return this;
  }

  groupBy(...groupings: Grouping[]) {
    if (groupings.length === 0) {
      return this;
    }

    if (this.config.group) {
      this.config.group = [...this.config.group, ...groupings];
    } else {
      this.config.group = groupings;
    }

    return this;
  }

  orderBy(...orderings: Ordering[]) {
    if (orderings.length === 0) {
      return this;
    }

    if (this.config.order) {
      this.config.order = [...this.config.order, ...orderings];
    } else {
      this.config.order = orderings;
    }

    return this;
  }

  limit(limit: number) {
    this.config.limit = limit;
    return this;
  }

  offset(offset: number) {
    this.config.offset = offset;
    return this;
  }

  $asSubQuery() {
    return group(this);
  }

  protected async makeQuery(client: SparqlClient): Promise<T[]> {
    const stream = client.query.select(this.toSPARQL());

    const items: T[] = [];
    for await (const binding of stream) {
      const temp = Object.entries(this.lookup).reduce((acc, curr) => {
        const func = this.lookupTransform[curr[0]] ?? ((self: any) => self);
        acc[curr[1]] = func(binding[curr[0]]);
        return acc;
      }, {} as Record<string, any>);
      items.push(temp as T);
    }
    return items;
  }
}
