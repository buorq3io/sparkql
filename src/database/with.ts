import type {
  PatternInput,
  QuadsInput,
  TermIriInput,
  UpdateInput,
  UpdateOperationModifyInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, DialectPattern, SparqlDialect } from './dialect.js';
import type { MergePlaceholders, PlaceholderCarrier, placeholderTypes } from './prepared.js';
import type { DynamicQuery } from './query.js';
import type { QueryModuleContext } from './query-module.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import type { UpdateQueryBuilderBase } from './update.js';

/** @internal Removes unavailable methods from a modify operation. */
export type WithBuilderBaseWithout<
  T extends WithQueryBuilderBase<any, any>,
  TDynamic extends boolean,
  TExcluded extends keyof T & string,
> = TDynamic extends true ? T : [T] extends [DynamicQuery] ? T : Omit<T, TExcluded>;

/** The update request a WITH/INSERT/DELETE operation is appended to. */
export interface WithParent<D extends AnySparqlDialect = SparqlDialect> {
  /** Context for the appended operation. */
  context: UpdateInput['updates'][number]['context'];
  /** Update request configuration. */
  config: UpdateInput;
  /** Builder for the containing request. */
  builder: UpdateQueryBuilderBase<D>;
}

/** Builds a `DELETE`/`INSERT` modify operation in an update request. */
export class WithQueryBuilderBase<
    TDynamic extends boolean = false,
    D extends AnySparqlDialect = SparqlDialect,
  >
  extends SparqlQueryBuilderBase<UpdateInput, void, D>
  implements PromiseLike<void>
{
  private updateConfig: UpdateInput;
  private updateContext: UpdateInput['updates'][number]['context'];
  private updateBuilder: UpdateQueryBuilderBase<D>;
  private readonly operation: UpdateOperationModifyInput;
  private ended = false;

  constructor(context: QueryModuleContext<D>, parent: WithParent<D>, iri?: TermIriInput) {
    super(
      {
        type: 'update',
        updates: [],
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      },
      context
    );
    this.inheritComments(parent.builder);
    this.operation = {
      type: 'updateOperation',
      subType: 'modify',
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      delete: [],
      insert: [],
      from: {
        type: 'datasetClauses',
        loc: {
          sourceLocationType: 'autoGenerate',
        },
        clauses: [],
      },
      graph: iri,
      where: {
        type: 'pattern',
        subType: 'group',
        loc: {
          sourceLocationType: 'autoGenerate',
        },
        patterns: [],
      },
    };
    this.updateContext = parent.context;
    this.updateConfig = parent.config;
    this.updateBuilder = parent.builder;
  }

  /**
   * Adds a `DELETE` template.
   *
   * After this call `delete` is unavailable.
   *
   * @param quads - Template quads.
   *
   * @example
   * Replace every `foaf:mbox` in the people graph with `schema:email`.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * db.with(people)
   *   .delete(triples(v.person, n.foaf.mbox, v.mbox))
   *   .insert(triples(v.person, n.schema.email, v.mbox))
   *   .where(triples(v.person, n.foaf.mbox, v.mbox));
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> DELETE {
   *   ?person foaf:mbox ?mbox .
   * }
   * INSERT {
   *   ?person schema:email ?mbox .
   * }
   * WHERE {
   *   ?person foaf:mbox ?mbox .
   * }
   * ```
   */
  delete<Self extends PlaceholderCarrier<object>, Q extends QuadsInput[]>(
    this: Self,
    ...quads: Q
  ): WithBuilderBaseWithout<this, TDynamic, 'delete'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Q[number]>>;

  delete(...quads: QuadsInput[]): WithBuilderBaseWithout<this, TDynamic, 'delete'> {
    this.operation.delete = [...this.operation.delete, ...quads];
    return this;
  }

  /**
   * Adds an `INSERT` template.
   *
   * After this call `insert` and `delete` are unavailable.
   *
   * @param quads - Template quads.
   *
   * @example
   * Copy each `foaf:name` in the people graph to `schema:name`.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * db.with(people)
   *   .insert(triples(v.person, n.schema.name, v.name))
   *   .where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> INSERT {
   *   ?person schema:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  insert<Self extends PlaceholderCarrier<object>, Q extends QuadsInput[]>(
    this: Self,
    ...quads: Q
  ): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Q[number]>>;

  insert(...quads: QuadsInput[]): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> {
    this.operation.insert = [...this.operation.insert, ...quads];
    return this;
  }

  /**
   * Adds a `USING` dataset clause.
   *
   * It can be repeated; `insert` and `delete` are unavailable afterwards.
   *
   * @param iri - The graph IRI.
   *
   * @example
   * Copy names from an import graph into the people graph.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * const imports = db.iri('http://example.org/graphs/import');
   * db.with(people)
   *   .insert(triples(v.person, n.foaf.name, v.name))
   *   .using(imports)
   *   .where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> INSERT {
   *   ?person foaf:name ?name .
   * }
   * USING <http://example.org/graphs/import> WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  using<Self extends PlaceholderCarrier<object>>(
    this: Self,
    iri: TermIriInput
  ): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]>>;

  using(iri: TermIriInput): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> {
    this.operation.from.clauses = [
      ...this.operation.from.clauses,
      {
        clauseType: 'default',
        value: iri,
      },
    ];
    return this;
  }

  /**
   * Adds a `USING NAMED` dataset clause.
   *
   * It can be repeated; `insert` and `delete` are unavailable afterwards.
   *
   * @param iri - The graph IRI.
   *
   * @example
   * Copy names that a `GRAPH` pattern finds in the import graph.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * const imports = db.iri('http://example.org/graphs/import');
   * db.with(people)
   *   .insert(triples(v.person, n.foaf.name, v.name))
   *   .usingNamed(imports)
   *   .where(graph(imports, triples(v.person, n.foaf.name, v.name)));
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> INSERT {
   *   ?person foaf:name ?name .
   * }
   * USING NAMED <http://example.org/graphs/import> WHERE {
   *   GRAPH <http://example.org/graphs/import> {
   *     ?person foaf:name ?name .
   *   }
   * }
   * ```
   */
  usingNamed<Self extends PlaceholderCarrier<object>>(
    this: Self,
    iri: TermIriInput
  ): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]>>;

  usingNamed(iri: TermIriInput): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> {
    this.operation.from.clauses = [
      ...this.operation.from.clauses,
      {
        clauseType: 'named',
        value: iri,
      },
    ];
    return this;
  }

  /**
   * Adds patterns to the `WHERE` group.
   *
   * After this call `where`, `insert` and `delete` are unavailable.
   *
   * @param patterns - Patterns to match.
   *
   * @example
   * Add `schema:name` only to people who do not have one yet.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * db.with(people)
   *   .insert(triples(v.person, n.schema.name, v.name))
   *   .where(
   *     triples(v.person, n.foaf.name, v.name),
   *     filter(notExists(triples(v.person, n.schema.name, v.existing)))
   *   );
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> INSERT {
   *   ?person schema:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   *   FILTER ( NOT EXISTS {
   *     ?person schema:name ?existing .
   *   }
   *   )
   * }
   * ```
   */
  where<Self extends PlaceholderCarrier<object>, P extends PatternInput<DialectPattern<D>>[]>(
    this: Self,
    ...patterns: P
  ): WithBuilderBaseWithout<this, TDynamic, 'where' | 'insert' | 'delete'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<P[number]>>;

  where(
    ...patterns: PatternInput<DialectPattern<D>>[]
  ): WithBuilderBaseWithout<this, TDynamic, 'where' | 'insert' | 'delete'> {
    this.operation.where.patterns = [
      ...this.operation.where.patterns,
      ...(patterns as unknown as PatternInput[]),
    ];
    return this;
  }

  /**
   * Lifts clause-order restrictions for the rest of the chain.
   *
   * Helpers can add clauses in any order and more than once. Repeated `insert`, `delete`,
   * `using`, `usingNamed` and `where` calls append their arguments.
   *
   * @example
   * Assemble the templates in several calls, e.g. from configuration.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * db.with(people)
   *   .$dynamic()
   *   .insert(triples(v.person, n.schema.name, v.name))
   *   .insert(triples(v.person, n.schema.email, v.mbox))
   *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.mbox, v.mbox));
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> INSERT {
   *   ?person schema:name ?name .
   *   ?person schema:email ?mbox .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   *   ?person foaf:mbox ?mbox .
   * }
   * ```
   */
  $dynamic<Self extends PlaceholderCarrier<object>>(
    this: Self
  ): this & DynamicQuery & PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]>>;

  $dynamic(): this & DynamicQuery {
    return this as this & DynamicQuery;
  }

  /**
   * Appends this operation to the update request and returns the request builder.
   *
   * Later operations chained on the request run after this one, in the same request. Calling
   * `$end` again does not append the operation twice.
   *
   * @example
   * Copy names, then clear the import graph in the same request.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * const imports = db.iri('http://example.org/graphs/import');
   * db.with(people)
   *   .insert(triples(v.person, n.schema.name, v.name))
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .$end()
   *   .clearSilent(imports);
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> INSERT {
   *   ?person schema:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ;
   * CLEAR SILENT GRAPH <http://example.org/graphs/import>
   * ```
   */
  $end() {
    if (!this.ended) {
      this.ended = true;
      this.updateConfig.updates.push({
        context: this.updateContext,
        operation: this.operation,
      });
    }
    return this.updateBuilder;
  }

  /**
   * Runs the whole update request this operation belongs to.
   *
   * Sends one request each time it is called. Errors carry that request's SPARQL.
   *
   * @example
   * Copy names and wait for the endpoint to apply the update.
   *
   * ```ts
   * const people = db.iri('http://example.org/graphs/people');
   * await db.with(people)
   *   .insert(triples(v.person, n.schema.name, v.name))
   *   .where(triples(v.person, n.foaf.name, v.name))
   *   .execute();
   * ```
   *
   * ```sparql
   * WITH <http://example.org/graphs/people> INSERT {
   *   ?person schema:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  public override execute(): Promise<void> {
    return this.$end().execute();
  }

  protected override preparationInput(): UpdateInput {
    this.$end();
    return this.updateConfig;
  }

  protected makeQuery(
    session: import('./session.js').SparqlSession,
    sparql: string
  ): Promise<void> {
    return session.update(sparql);
  }
}
