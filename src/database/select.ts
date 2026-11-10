import { createWildCardInput } from '../functions/utils.js';
import {
  type DefaultQueryReturnType,
  type PatternGroupInput,
  Presence,
  type QuerySelectInput,
  type TermVariableAndBinding,
  type TermVariableInput,
  type TermVariableOptionalTransform,
  type TermVariableTransform,
} from '../helpers/types.js';
import { group } from '../structures/pattern.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { SparkqlError } from './errors.js';
import type { PlaceholderCarrier, placeholderTypes } from './prepared.js';
import { QueryBuilderBase } from './query.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';

/** Variables and bindings selected by a query. */
export type SelectedVariables = Record<string, TermVariableAndBinding<any, Presence>>;

type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type OptionalKeys<T> = keyof {
  [Key in keyof T as Omit<T, Key> extends T ? Key : never]: T[Key];
};

/** Selection compatible with a result row type. */
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

/** @internal Extracts the value type of a selected variable. */
export type ExtractDataType<V> = V extends TermVariableAndBinding<infer T, any> ? T : never;
/** @internal Extracts the presence of a selected variable. */
export type ExtractPresenceType<V> = V extends TermVariableAndBinding<any, infer P> ? P : never;

/** Result row inferred from selected variables, including optional values. */
export type InferredSelectResult<T extends SelectedVariables> = {
  [K in keyof T]: ExtractPresenceType<T[K]> extends Presence.optional
    ? ExtractDataType<T[K]> | undefined
    : ExtractDataType<T[K]>;
};

/** Projected variables retain their decoder and whether they can be unbound. */
export type SubqueryFields<T extends Record<string, any>> = {
  [K in keyof T]-?: TermVariableInput<
    Exclude<T[K], undefined>,
    undefined extends T[K] ? Presence.optional : Presence.required
  >;
};

/** Group pattern exposing the fields projected by a subquery. */
export type TypedSubquery<T extends Record<string, any>> = PatternGroupInput & SubqueryFields<T>;

/**
 * Builds an executable `SELECT` query.
 *
 * Each await or execution sends a new request. Variables wrapped in `maybe(...)` have type
 * `T | undefined` in the result; `optional(...)` patterns alone do not change the type.
 */
export class SelectQueryBuilderBase<
    T extends Record<string, any>,
    D extends AnySparqlDialect = SparqlDialect,
  >
  extends QueryBuilderBase<QuerySelectInput, T[], false, D>
  implements PromiseLike<T[]>
{
  private readonly selectedFields: SubqueryFields<T>;
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

    this.selectedFields = Object.fromEntries(
      Object.entries(variables ?? {}).map(([key, value]) => {
        const selected = value as TermVariableAndBinding<any, Presence>;
        return [key, { ...(selected.type === 'pattern' ? selected.variable : selected) }];
      })
    ) as SubqueryFields<T>;

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

  /**
   * Wraps this `SELECT` as a subquery group and exposes its projected variables on it.
   *
   * Each result key becomes a property holding the projected variable, so an outer query can
   * select `sub.name`. SPARQL variable names remain global: equal names join; use distinct
   * names when independent bindings are intended.
   *
   * @throws {@link SparkqlError} When a result key collides with a member of the group
   * pattern (such as `type` or `patterns`) or is `then`.
   *
   * @example
   * Select from a subquery.
   *
   * ```ts
   * const sub = db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name)).as();
   * db.select({ name: sub.name }).where(sub);
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   {
   *     SELECT ?name WHERE {
   *       ?person foaf:name ?name .
   *     }
   *   }
   * }
   * ```
   */
  as<Self extends PlaceholderCarrier<object>>(
    this: Self
  ): TypedSubquery<T> & PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]>>;
  as(): TypedSubquery<T> {
    const pattern = group(this.config);
    for (const key of Object.keys(this.selectedFields)) {
      if (key in pattern || key === 'then') {
        throw new SparkqlError({ message: `Subquery field conflicts with pattern member: ${key}` });
      }
    }
    return Object.assign(pattern, this.getSelectedFields());
  }

  /**
   * Returns the projected variables, keyed by result field.
   *
   * Each value is a copy of the variable term. A projected `BIND` such as
   * `as(strlen(v.name), v.length)` is returned as its target variable, not its expression.
   *
   * @example
   * Read the projected fields of a query.
   *
   * ```ts
   * const fields = db
   *   .select({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .getSelectedFields(); // { name: TermVariableInput }
   * ```
   */
  getSelectedFields(): SubqueryFields<T> {
    return Object.fromEntries(
      Object.entries(this.selectedFields).map(([key, value]) => [key, { ...value }])
    ) as SubqueryFields<T>;
  }

  /** @internal Wraps the query as a group pattern. */
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
