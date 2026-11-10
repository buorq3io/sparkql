import type {
  ExpressionInput,
  OrderingInput,
  PatternInput,
  QuerySelectInput,
  SolutionModifierGroupBindInput,
  TermIriInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, DialectPattern } from './dialect.js';
import { SparkqlError } from './errors.js';
import {
  ModuleQueryBuilder,
  type QueryModule,
  type QueryModuleContext,
  type QueryNormalizer,
} from './query-module.js';

/** Configuration of a custom query form that has a standard `WHERE` body. */
export interface PatternQueryConfig {
  /** SELECT body that holds the dataset, `WHERE` and solution modifier clauses. */
  body: QuerySelectInput;
}

/**
 * Base class for builders of custom query forms that have a `WHERE` clause, such as ARQ's
 * `JSON`.
 *
 * Provides `where`, `from`, `fromNamed`, `groupBy`, `having`, `orderBy`, `limit`, `offset` and
 * `values` with the standard builders' normalization, writing into `config.body`. The module
 * then reads the body through {@link QueryNormalizer}. Each clause method narrows the chain so
 * clauses come in SPARQL order and once each; `limit` and `offset` can come in either order.
 */
export abstract class PatternModuleQueryBuilder<
  C extends PatternQueryConfig,
  A,
  R,
  D extends AnySparqlDialect,
> extends ModuleQueryBuilder<C, A, R, D> {
  private readonly body: QueryNormalizer<D>;
  protected constructor(
    config: C,
    module: QueryModule<C, A, R, D>,
    context: QueryModuleContext<D>
  ) {
    super(config, module, context);
    this.body = context.normalizer(config.body);
  }
  /**
   * Sets the `WHERE` graph pattern of the query.
   *
   * Patterns accept the dialect's extension patterns, such as ARQ `LET` and `LATERAL`. Can be
   * called once. After it, `from` and `fromNamed` are no longer available on the chain.
   *
   * @param patterns - Graph patterns to join into the `WHERE` group.
   *
   * @example
   * List the name and age of every person as JSON objects.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const people = db
   *   .json({ name: v.name, age: v.age })
   *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.age, v.age));
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name , "age" : ?age } WHERE {
   *   ?person foaf:name ?name .
   *   ?person foaf:age ?age .
   * }
   * ```
   */
  where(
    ...patterns: PatternInput<DialectPattern<D>>[]
  ): Omit<this, 'where' | 'from' | 'fromNamed'> {
    this.body.where(...patterns);
    return this;
  }
  /**
   * Adds a `FROM` dataset clause.
   *
   * Can be called several times, but only before `where`, `groupBy` and the later clauses.
   *
   * @param iri - IRI of a graph to merge into the default graph.
   *
   * @example
   * Read names only from the people graph.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const names = db
   *   .json({ name: v.name })
   *   .from(db.iri('https://example.org/people'))
   *   .where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name } FROM <https://example.org/people> WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  from(iri: TermIriInput): this {
    this.body.from(iri);
    return this;
  }
  /**
   * Adds a `FROM NAMED` dataset clause.
   *
   * Can be called several times, but only before `where`, `groupBy` and the later clauses.
   *
   * @param iri - IRI of a graph to make available to `GRAPH` patterns.
   *
   * @example
   * Read names from the people graph through a `GRAPH` pattern.
   *
   * ```ts
   * import { SparqlDatabase, graph, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const names = db
   *   .json({ name: v.name })
   *   .fromNamed(db.iri('https://example.org/people'))
   *   .where(graph(v.g, triples(v.person, n.foaf.name, v.name)));
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name } FROM NAMED <https://example.org/people> WHERE {
   *   GRAPH ?g {
   *     ?person foaf:name ?name .
   *   }
   * }
   * ```
   */
  fromNamed(iri: TermIriInput): this {
    this.body.fromNamed(iri);
    return this;
  }
  /**
   * Adds a `GROUP BY` clause.
   *
   * Can be called once. After it, `where`, `from` and `fromNamed` are no longer available on the
   * chain, so call it after `where` and before `having`.
   *
   * @param expressions - Variables, expressions or `as(...)` bindings to group by.
   *
   * @example
   * List each name once, however many people share it.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const names = db
   *   .json({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .groupBy(v.name);
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name } WHERE {
   *   ?person foaf:name ?name .
   * }
   * GROUP BY ?name
   * ```
   */
  groupBy(
    ...expressions: (ExpressionInput | SolutionModifierGroupBindInput)[]
  ): Omit<this, 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    this.body.groupBy(...expressions);
    return this;
  }
  /**
   * Adds a `HAVING` clause that filters groups.
   *
   * Can be called once. After it, `groupBy`, `where`, `from` and `fromNamed` are no longer
   * available on the chain.
   *
   * @param expressions - Boolean expressions over the groups, usually with aggregates such as
   * {@link count}.
   *
   * @example
   * List names whose people know more than two others in total.
   *
   * ```ts
   * import { SparqlDatabase, count, gt, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const popular = db
   *   .json({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.knows, v.friend))
   *   .groupBy(v.name)
   *   .having(gt(count(v.friend), 2));
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name } WHERE {
   *   ?person foaf:name ?name .
   *   ?person foaf:knows ?friend .
   * }
   * GROUP BY ?name
   * HAVING ( COUNT( ?friend ) > "2"^^<http://www.w3.org/2001/XMLSchema#integer> )
   * ```
   */
  having(
    ...expressions: ExpressionInput[]
  ): Omit<this, 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    this.body.having(...expressions);
    return this;
  }
  /**
   * Adds an `ORDER BY` clause.
   *
   * A bare variable or expression sorts ascending; wrap it in {@link desc} to reverse. Can be
   * called once. After it, `having`, `groupBy`, `where`, `from` and `fromNamed` are no longer
   * available on the chain.
   *
   * @param orderings - Variables, expressions or `asc(...)`/`desc(...)` orderings.
   *
   * @example
   * List people oldest first.
   *
   * ```ts
   * import { SparqlDatabase, desc, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const people = db
   *   .json({ name: v.name, age: v.age })
   *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.age, v.age))
   *   .orderBy(desc(v.age));
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name , "age" : ?age } WHERE {
   *   ?person foaf:name ?name .
   *   ?person foaf:age ?age .
   * }
   * ORDER BY DESC ( ?age )
   * ```
   */
  orderBy(
    ...orderings: (OrderingInput | ExpressionInput)[]
  ): Omit<this, 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'> {
    this.body.orderBy(...orderings);
    return this;
  }
  /**
   * Adds a `LIMIT` clause.
   *
   * Can be called once, before or after `offset`. After it, only `offset` (if not given yet)
   * and `values` remain available on the chain.
   *
   * @param value - Maximum number of solutions.
   * @throws When `value` is not a non-negative safe integer.
   *
   * @example
   * Return the first ten names alphabetically.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const firstPage = db
   *   .json({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .orderBy(v.name)
   *   .limit(10);
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name } WHERE {
   *   ?person foaf:name ?name .
   * }
   * ORDER BY ASC ( ?name )
   * LIMIT 10
   * ```
   */
  limit<Self extends object>(
    this: Self,
    value: number
  ): Omit<Self, 'limit' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'>;
  limit(value: number): this {
    assertNonNegativeInteger(value, 'LIMIT');
    this.body.limit(value);
    return this;
  }
  /**
   * Adds an `OFFSET` clause.
   *
   * Can be called once, before or after `limit`. After it, only `limit` (if not given yet) and
   * `values` remain available on the chain. The query always lists `LIMIT` first.
   *
   * @param value - Number of solutions to skip.
   * @throws When `value` is not a non-negative safe integer.
   *
   * @example
   * Return the third page of ten names.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const thirdPage = db
   *   .json({ name: v.name })
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .orderBy(v.name)
   *   .limit(10)
   *   .offset(20);
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name } WHERE {
   *   ?person foaf:name ?name .
   * }
   * ORDER BY ASC ( ?name )
   * LIMIT 10 OFFSET 20
   * ```
   */
  offset<Self extends object>(
    this: Self,
    value: number
  ): Omit<Self, 'offset' | 'orderBy' | 'having' | 'groupBy' | 'where' | 'from' | 'fromNamed'>;
  offset(value: number): this {
    assertNonNegativeInteger(value, 'OFFSET');
    this.body.offset(value);
    return this;
  }
  /**
   * Adds a trailing `VALUES` clause that restricts the solutions to the given bindings.
   *
   * Must come last: after it, no other clause method is available on the chain. Every column
   * must have the same length; `undefined` becomes `UNDEF`.
   *
   * @param columns - Values for each variable, keyed by variable name.
   * @throws {@link SparkqlError} When the columns do not all have the same length.
   *
   * @example
   * Return the ages of Ada and Grace only.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const ages = db
   *   .json({ name: v.name, age: v.age })
   *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.age, v.age))
   *   .values({ name: ['Ada', 'Grace'] });
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name , "age" : ?age } WHERE {
   *   ?person foaf:name ?name .
   *   ?person foaf:age ?age .
   * }
   * VALUES ?name {
   *   "Ada"
   *   "Grace"
   * }
   * ```
   */
  values(
    columns: ValuePatternColumnsInput
  ): Omit<
    this,
    | 'values'
    | 'offset'
    | 'limit'
    | 'orderBy'
    | 'having'
    | 'groupBy'
    | 'where'
    | 'from'
    | 'fromNamed'
  > {
    this.body.values(columns);
    return this;
  }
}

/**
 * Throws unless `value` is a non-negative safe integer, as `LIMIT`, `OFFSET` and similar
 * clauses require.
 *
 * @param value - Value to validate.
 * @param clause - Clause name, used in the error message.
 * @throws {@link SparkqlError} When `value` is negative, fractional, or not a safe integer.
 *
 * @example
 * Validate the page size of a custom query form before storing it.
 *
 * ```ts
 * function pageSize(size: number) {
 *   assertNonNegativeInteger(size, 'LIMIT');
 *   return size;
 * }
 * ```
 */
export function assertNonNegativeInteger(value: number, clause: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new SparkqlError({ message: `${clause} requires a non-negative safe integer.` });
}
