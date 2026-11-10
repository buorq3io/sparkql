import { createWildCardInput } from '../functions/utils.js';
import {
  type DefaultQueryReturnType,
  Presence,
  type QuerySelectInput,
  type TermVariableAndBinding,
  type TermVariableOptionalTransform,
  type TermVariableTransform,
} from '../helpers/types.js';
import { group } from '../structures/pattern.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { QueryBuilderBase } from './query.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';

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

export class SelectQueryBuilderBase<
    T extends Record<string, any>,
    D extends AnySparqlDialect = SparqlDialect,
  >
  extends QueryBuilderBase<QuerySelectInput, T[], false, D>
  implements PromiseLike<T[]>
{
  private lookup: Record<string, string> = {};
  private lookupTransform: Record<
    string,
    TermVariableOptionalTransform | TermVariableTransform | undefined
  > = {};

  constructor(
    context: QueryModuleContext<D>,
    select: {
      variables?: TypedSelectedVariables<T>;
      distinct?: QuerySelectInput['distinct'];
      reduced?: QuerySelectInput['reduced'];
    } = {}
  ) {
    const { variables } = select;
    super(
      {
        type: 'query',
        subType: 'select',
        context: [...context.context],
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
        distinct: select.distinct,
        reduced: select.reduced,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      },
      context
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
      // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn requires ES2022; this package targets ES2020.
      if (Object.prototype.hasOwnProperty.call(variables, key)) {
        const value = variables[key as keyof T] as TermVariableAndBinding<any, Presence>;
        if (value.type === 'term') {
          this.lookup[value.value] = key;
          if (value.presence === Presence.optional) {
            this.lookupTransform[value.value] = value.transform
              ? createMaybeTransform(value.transform)
              : undefined;
          } else {
            this.lookupTransform[value.value] = value.transform ? value.transform : undefined;
          }
        } else if (value.type === 'pattern') {
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

  protected async makeQuery(session: SparqlSession, sparql: string): Promise<T[]> {
    const items: T[] = [];
    const codecs = this.builderContext.codecs;
    // An explicit transform wins over the codec table, which wins over the raw term.
    const decode =
      codecs && codecs.size > 0
        ? (term: DefaultQueryReturnType | undefined) => (term ? codecs.decode(term) : term)
        : (term: DefaultQueryReturnType | undefined) => term;
    for (const binding of await session.bindings(sparql)) {
      const temp = Object.entries(this.lookup).reduce(
        (acc, curr) => {
          const term = binding[curr[0]];
          const transform = this.lookupTransform[curr[0]];
          // Unbound variables are absent; optional transforms accept undefined.
          acc[curr[1]] = transform ? transform(term as DefaultQueryReturnType) : decode(term);
          return acc;
        },
        {} as Record<string, any>
      );
      items.push(temp as T);
    }
    return items;
  }
}
