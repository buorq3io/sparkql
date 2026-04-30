import {
  Presence,
  SparqlClient,
  FactoryFunctions,
  QuerySelectInput,
  TermVariableTransform,
  TermVariableAndBinding,
  DefaultQueryReturnType,
  TermVariableOptionalTransform,
} from '../helpers/types.js';
import { group } from '../index.mjs';
import { QueryBuilderBase } from './query.js';
import { createWildCardInput } from '../functions/utils.js';

export type SelectedVariables = Record<string, TermVariableAndBinding<any, Presence>>;

type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type OptionalKeys<T> = keyof {
  [Key in keyof T as Omit<T, Key> extends T ? Key : never]: T[Key];
};

export type TypedSelectedVariables<T extends Record<string, any>> = {
  [K in RequiredKeys<T>]-?: undefined extends T[K]
    ?
        | TermVariableAndBinding<Exclude<T[K], undefined>, Presence.optional>
        | TermVariableAndBinding<T[K], Presence>
    : TermVariableAndBinding<T[K]>;
} & {
  [K in OptionalKeys<T>]?:
    | TermVariableAndBinding<Exclude<T[K], undefined>, Presence>
    | TermVariableAndBinding<T[K], Presence>;
};

export type ExtractDataType<V> = V extends TermVariableAndBinding<infer T, any> ? T : never;
export type ExtractPresenceType<V> = V extends TermVariableAndBinding<any, infer P> ? P : never;

export type InferredSelectResult<T extends SelectedVariables> = {
  [K in keyof T]: ExtractPresenceType<T[K]> extends Presence.optional
    ? ExtractDataType<T[K]> | undefined
    : ExtractDataType<T[K]>;
};

export class SelectQueryBuilderBase<T extends Record<string, any>>
  extends QueryBuilderBase<QuerySelectInput, T[]>
  implements PromiseLike<T[]>
{
  private lookup: Record<string, string> = {};
  private lookupTransform: Record<
    string,
    TermVariableOptionalTransform | TermVariableTransform | undefined
  > = {};

  constructor(
    variables: TypedSelectedVariables<T> | undefined,
    context: QuerySelectInput['context'],
    factoryFunctions: FactoryFunctions,
    distict: QuerySelectInput['distinct'] = undefined,
    reduced: QuerySelectInput['reduced'] = undefined,
    endpointUrl?: string
  ) {
    super(
      {
        type: 'query',
        subType: 'select',
        context: context,
        datasets: {
          type: 'datasetClauses',
          clauses: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        solutionModifiers: {},
        where: {
          type: 'pattern',
          subType: 'group',
          patterns: [],
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        },
        variables: variables
          ? <TermVariableAndBinding[]>Object.values(variables)
          : [createWildCardInput()],
        distinct: distict,
        reduced: reduced,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      },
      factoryFunctions,
      endpointUrl
    );

    function createMaybeTransform<T extends DefaultQueryReturnType, K extends any[]>(
      t: TermVariableTransform<T, K>
    ): TermVariableOptionalTransform<T, K> {
      return (self: DefaultQueryReturnType | undefined, ...other: K) => {
        if (!self) {
          return;
        }
        return t(self, ...other);
      };
    }

    for (const key in variables) {
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        const value = variables[key as keyof T] as TermVariableAndBinding<any, Presence>;
        if (value.type === "term") {
          this.lookup[value.value] = key;
          if (value.presence === Presence.optional) {
            this.lookupTransform[value.value] = value.transform
              ? createMaybeTransform(value.transform)
              : undefined;
          } else {
            this.lookupTransform[value.value] = value.transform ? value.transform : undefined;
          }
        }
        else if (value.type === "pattern") {
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
  }

  $asSubQuery() {
    return group(this.config);
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
