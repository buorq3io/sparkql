import type {
  PatternInput,
  QuadsInput,
  TermIriInput,
  UpdateInput,
  UpdateOperationModifyInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, DialectPattern, SparqlDialect } from './dialect.js';
import type { MergePlaceholders, PlaceholderCarrier, placeholderTypes } from './prepared.js';
import type { QueryModuleContext } from './query-module.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import type { UpdateQueryBuilderBase } from './update.js';

export type WithBuilderBaseWithout<
  T extends WithQueryBuilderBase<any, any>,
  TDynamic extends boolean,
  TExcluded extends keyof T & string,
> = TDynamic extends true ? T : Omit<T, TExcluded>;

/** The update request a WITH/INSERT/DELETE operation is appended to. */
export interface WithParent<D extends AnySparqlDialect = SparqlDialect> {
  context: UpdateInput['updates'][number]['context'];
  config: UpdateInput;
  builder: UpdateQueryBuilderBase<D>;
}

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

  delete<Self extends PlaceholderCarrier<object>, Q extends QuadsInput[]>(
    this: Self,
    ...quads: Q
  ): WithBuilderBaseWithout<this, TDynamic, 'delete'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Q[number]>>;

  delete(...quads: QuadsInput[]): WithBuilderBaseWithout<this, TDynamic, 'delete'> {
    this.operation.delete = [...this.operation.delete, ...quads];
    return this;
  }

  insert<Self extends PlaceholderCarrier<object>, Q extends QuadsInput[]>(
    this: Self,
    ...quads: Q
  ): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Q[number]>>;

  insert(...quads: QuadsInput[]): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> {
    this.operation.insert = [...this.operation.insert, ...quads];
    return this;
  }

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

  $dynamic<Self extends PlaceholderCarrier<object>>(
    this: Self
  ): WithBuilderBaseWithout<this, true, never> &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]>>;

  $dynamic(): WithBuilderBaseWithout<this, true, any> {
    return this;
  }

  /** Appends this operation to the update request, once, and returns the request builder. */
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

  /** Runs the whole update request this operation belongs to. Errors carry that request's SPARQL. */
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
