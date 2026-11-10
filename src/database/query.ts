import type {
  ExpressionInput,
  OrderingInput,
  PatternGroupInput,
  PatternInput,
  QueryInput,
  SolutionModifierGroupBindInput,
  TermIriInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';
import { isObjectLike } from '../helpers/utilities.js';
import { group, values } from '../structures/pattern.js';
import type { AnySparqlDialect, DialectPattern, SparqlDialect } from './dialect.js';
import {
  type MergePlaceholders,
  Placeholder,
  type PlaceholderCarrier,
  type PlaceholderValues,
  type placeholderTypes,
} from './prepared.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';

/** @internal Type marker for dynamic query chains. */
export declare const dynamicQuery: unique symbol;
/**
 * Type-only marker added by `$dynamic()`. Clause restrictions do not apply to a
 * marked query, and every clause method keeps the marker on its result.
 */
export type DynamicQuery = { readonly [dynamicQuery]: true };

/** @internal Removes unavailable methods from a query chain. */
export type QueryBuilderBaseWithout<
  T,
  TDynamic extends boolean,
  TExcluded extends keyof T & string,
> = TDynamic extends true ? T : [T] extends [DynamicQuery] ? T : Omit<T, TExcluded>;

/** @internal Restricts solution modifiers before a root query has a pattern. */
export type RootQueryBuilderBaseWithout<T extends QueryBuilderBase<any, any, any, any>> =
  QueryBuilderBaseWithout<
    T,
    false,
    'values' | 'limit' | 'offset' | 'orderBy' | 'having' | 'groupBy'
  >;

/** Base class for read query clauses. */
export abstract class QueryBuilderBase<
  TConfig extends QueryInput,
  KReturn,
  TDynamic extends boolean = false,
  D extends AnySparqlDialect = SparqlDialect,
> extends SparqlQueryBuilderBase<TConfig, KReturn, D> {
  private fromBase(
    fromType: 'default' | 'named',
    iris: TermIriInput[]
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'groupBy' | 'having' | 'orderBy' | 'limit' | 'offset' | 'values'
  > {
    this.config.datasets.clauses = [
      ...this.config.datasets.clauses,
      ...iris.map(
        i =>
          ({
            clauseType: fromType,
            value: i,
          }) as const
      ),
    ];

    return this;
  }

  /**
   * Adds a `FROM` dataset clause.
   *
   * It can be repeated; afterwards `groupBy`, `having`, `orderBy`, `limit`,
   * `offset` and `values` are unavailable on the chain.
   *
   * @param iri - The default graph IRI.
   *
   * @example
   * Select names from a default graph.
   *
   * ```ts
   * db.select({ name: v.name }).from(n.foaf.name).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT ?name FROM foaf:name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  from(iri: TermIriInput) {
    return this.fromBase('default', [iri]);
  }

  /**
   * Adds a `FROM NAMED` dataset clause.
   *
   * It can be repeated; afterwards `groupBy`, `having`, `orderBy`, `limit`,
   * `offset` and `values` are unavailable on the chain.
   *
   * @param iri - The named graph IRI.
   *
   * @example
   * Declare a named graph when selecting names.
   *
   * ```ts
   * db.select({ name: v.name }).fromNamed(n.foaf.name).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT ?name FROM NAMED foaf:name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  fromNamed(iri: TermIriInput) {
    return this.fromBase('named', [iri]);
  }

  /**
   * Adds patterns to the `WHERE` group.
   *
   * After this call `where`, `from` and `fromNamed` are unavailable on the
   * chain; after `$dynamic()` a second call appends to the same group. Patterns do not
   * change result types: wrap a selected variable in {@link maybe} to type it
   * `T | undefined`, even when it is bound only inside {@link optional}.
   *
   * @param patterns - Patterns to add to the group.
   *
   * @example
   * Select the names of people.
   *
   * ```ts
   * db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  where<Self extends PlaceholderCarrier<object>, P extends PatternInput<DialectPattern<D>>[]>(
    this: Self,
    ...patterns: P
  ): QueryBuilderBaseWithout<this, TDynamic, 'where' | 'from' | 'fromNamed'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<P[number]>>;

  where<P extends PatternInput<DialectPattern<D>>[]>(
    ...patterns: P
  ): QueryBuilderBaseWithout<this, TDynamic, 'where' | 'from' | 'fromNamed'> &
    PlaceholderCarrier<MergePlaceholders<P[number]>> {
    if (!this.config.where) {
      this.config.where = group(...patterns) as unknown as PatternGroupInput;
    } else {
      this.config.where.patterns = [
        ...this.config.where.patterns,
        ...(patterns as unknown as PatternInput[]),
      ];
    }
    return this as typeof this & PlaceholderCarrier<MergePlaceholders<P[number]>>;
  }

  /**
   * Adds a `GROUP BY` clause.
   *
   * After this call `groupBy`, `where`, `from` and `fromNamed` are unavailable.
   *
   * @param expressions - Grouping expressions or bindings.
   *
   * @example
   * Group people by name.
   *
   * ```ts
   * db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name)).groupBy(v.name);
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * GROUP BY ?name
   * ```
   */
  groupBy<
    Self extends PlaceholderCarrier<object>,
    Inputs extends (ExpressionInput | SolutionModifierGroupBindInput)[],
  >(
    this: Self,
    ...expressions: Inputs
  ): QueryBuilderBaseWithout<this, TDynamic, 'groupBy' | 'where' | 'from' | 'fromNamed'> &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Inputs[number]>
    >;

  groupBy(
    ...expressions: (ExpressionInput | SolutionModifierGroupBindInput)[]
  ): QueryBuilderBaseWithout<this, TDynamic, 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    if (!this.config.solutionModifiers.group) {
      this.config.solutionModifiers.group = {
        type: 'solutionModifier',
        subType: 'group',
        groupings: expressions,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  /**
   * Adds a `HAVING` clause.
   *
   * After this call `having`, `groupBy`, `where`, `from` and `fromNamed` are unavailable.
   *
   * @param expressions - Conditions applied to groups.
   *
   * @example
   * Count friends per person and keep those with more than ten.
   *
   * ```ts
   * db.select({ person: v.person, friends: as(count(v.friend), v.friends) })
   *   .where(triples(v.person, n.foaf.knows, v.friend))
   *   .groupBy(v.person).having(gt(count(v.friend), 10));
   * ```
   *
   * ```sparql
   * SELECT ?person ( COUNT( ?friend ) AS ?friends ) WHERE {
   *   ?person foaf:knows ?friend .
   * }
   * GROUP BY ?person
   * HAVING ( COUNT( ?friend ) > "10"^^<http://www.w3.org/2001/XMLSchema#integer> )
   * ```
   */
  having<Self extends PlaceholderCarrier<object>, Inputs extends ExpressionInput[]>(
    this: Self,
    ...expressions: Inputs
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Inputs[number]>
    >;

  having(
    ...expressions: ExpressionInput[]
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    if (!this.config.solutionModifiers.having) {
      this.config.solutionModifiers.having = {
        type: 'solutionModifier',
        subType: 'having',
        having: expressions,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  /**
   * Adds an `ORDER BY` clause to the query.
   *
   * Orderings are applied left to right. A bare variable or expression sorts
   * ascending. Wrap it in {@link desc} (or {@link asc}) to choose the direction.
   * Can be called once. After it, `orderBy`, `where`, `groupBy`, `having`, `from` and
   * `fromNamed` are no longer available on the chain.
   *
   * @param orderings - Variables, expressions or `asc(...)`/`desc(...)` orderings.
   *
   * @example
   * Oldest first, then alphabetically.
   *
   * ```ts
   * db.select({ name: v.name })
   *   .where(
   *     triples(v.person, n.foaf.name, v.name),
   *     triples(v.person, n.foaf.age, v.age)
   *   )
   *   .orderBy(desc(v.age), v.name);
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   *   ?person foaf:age ?age .
   * }
   * ORDER BY DESC ( ?age ) ASC ( ?name )
   * ```
   */
  orderBy<
    Self extends PlaceholderCarrier<object>,
    Inputs extends (OrderingInput | ExpressionInput)[],
  >(
    this: Self,
    ...orderings: Inputs
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Inputs[number]>
    >;

  orderBy(
    ...orderings: (OrderingInput | ExpressionInput)[]
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > {
    if (!this.config.solutionModifiers.order) {
      this.config.solutionModifiers.order = {
        type: 'solutionModifier',
        subType: 'order',
        orderDefs: orderings.map(o => {
          if (isObjectLike(o) && 'descending' in o) return o;
          return {
            descending: false,
            loc: { sourceLocationType: 'autoGenerate' },
            expression: o,
          } as const;
        }),
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this;
  }

  /**
   * Adds a `LIMIT` clause.
   *
   * After this call `limit`, `orderBy`, `having`, `groupBy`, `where`, `from`
   * and `fromNamed` are unavailable. `offset` remains available.
   *
   * @param limit - Maximum number of solutions or a placeholder.
   *
   * @example
   * Return at most two names.
   *
   * ```ts
   * db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name)).limit(2);
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * LIMIT 2
   * ```
   */
  limit<Self extends PlaceholderCarrier<object>, P extends number | Placeholder<string, number>>(
    this: Self,
    limit: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & PlaceholderValues<P>>;

  limit<P extends number | Placeholder<string, number>>(
    limit: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<PlaceholderValues<P>> {
    if (
      !this.config.solutionModifiers.limitOffset ||
      this.config.solutionModifiers.limitOffset?.limit === undefined
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        // @ts-expect-error A workaround of a bug in the underlying library
        limit: limit instanceof Placeholder ? limit : String(limit),
        offset: this.config.solutionModifiers.limitOffset?.offset,
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this as typeof this & PlaceholderCarrier<PlaceholderValues<P>>;
  }

  /**
   * Adds an `OFFSET` clause.
   *
   * After this call `offset`, `limit`, `orderBy`, `having`, `groupBy`, `where`,
   * `from` and `fromNamed` are unavailable.
   *
   * @param offset - Number of solutions to skip or a placeholder.
   *
   * @example
   * Skip the first two names.
   *
   * ```ts
   * db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name)).offset(2);
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * OFFSET 2
   * ```
   */
  offset<Self extends PlaceholderCarrier<object>, P extends number | Placeholder<string, number>>(
    this: Self,
    offset: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'offset' | 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & PlaceholderValues<P>>;

  offset<P extends number | Placeholder<string, number>>(
    offset: P
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    'offset' | 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'
  > &
    PlaceholderCarrier<PlaceholderValues<P>> {
    if (
      !this.config.solutionModifiers.limitOffset ||
      this.config.solutionModifiers.limitOffset?.offset === undefined
    ) {
      this.config.solutionModifiers.limitOffset = {
        type: 'solutionModifier',
        subType: 'limitOffset',
        limit: this.config.solutionModifiers.limitOffset?.limit,
        // @ts-expect-error A workaround of a bug in the underlying library
        offset: offset instanceof Placeholder ? offset : String(offset),
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      };
    }
    return this as typeof this & PlaceholderCarrier<PlaceholderValues<P>>;
  }

  /**
   * Adds a trailing `VALUES` clause.
   *
   * After this call `values`, `limit`, `offset`, `orderBy`, `having`, `groupBy`,
   * `where`, `from` and `fromNamed` are unavailable. Every column must have the same length;
   * `undefined` becomes `UNDEF`.
   *
   * @param columns - Variables and their column values.
   * @throws {@link SparkqlError} When the columns do not all have the same length.
   *
   * @example
   * Restrict the results to the name Ada.
   *
   * ```ts
   * db.select({ name: v.name }).where(triples(v.person, n.foaf.name, v.name)).values({ name: ['Ada'] });
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * VALUES ?name {
   *   "Ada"
   * }
   * ```
   */
  values<Self extends PlaceholderCarrier<object>, Columns extends ValuePatternColumnsInput>(
    this: Self,
    columns: Columns
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    | 'values'
    | 'limit'
    | 'offset'
    | 'orderBy'
    | 'having'
    | 'groupBy'
    | 'where'
    | 'from'
    | 'fromNamed'
  > &
    PlaceholderCarrier<
      NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Columns[keyof Columns][number]>
    >;

  values(
    columns: ValuePatternColumnsInput
  ): QueryBuilderBaseWithout<
    this,
    TDynamic,
    | 'values'
    | 'limit'
    | 'offset'
    | 'orderBy'
    | 'having'
    | 'groupBy'
    | 'where'
    | 'from'
    | 'fromNamed'
  > {
    if (!this.config.values) {
      this.config.values = values(columns);
    }

    return this;
  }

  /**
   * Lifts clause-order restrictions for the rest of the chain.
   *
   * Helpers can add clauses in any order and more than once. The first
   * `groupBy`, `having`, `orderBy`, `limit`, `offset` and `values` call wins.
   *
   * @example
   * Add a name pattern to a dynamic query.
   *
   * ```ts
   * db.select({ name: v.name }).$dynamic().where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * SELECT ?name WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  $dynamic<Self extends PlaceholderCarrier<object>>(
    this: Self
  ): this & DynamicQuery & PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]>>;

  $dynamic(): this & DynamicQuery {
    return this as this & DynamicQuery;
  }
}
