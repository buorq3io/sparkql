import type {
  FactoryFunctions,
  PatternInput,
  QuadsInput,
  TermIriInput,
  UpdateInput,
  UpdateOperationModifyInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, DialectPattern, SparqlDialect } from './dialect.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import type { UpdateQueryBuilderBase } from './update.js';

export type WithBuilderBaseWithout<
  T extends WithQueryBuilderBase<any, any>,
  TDynamic extends boolean,
  TExcluded extends keyof T & string,
> = TDynamic extends true ? T : Omit<T, TExcluded>;

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

  constructor(
    updateContext: UpdateInput['updates'][number]['context'],
    updateConfig: UpdateInput,
    updateBuilder: UpdateQueryBuilderBase<D>,
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string,
    iri?: TermIriInput,
    dialect?: D,
    updateUrl?: string
  ) {
    super(
      {
        type: 'update',
        updates: [],
        loc: {
          sourceLocationType: 'autoGenerate',
        },
      },
      factoryFunctions,
      endpointUrl,
      dialect,
      updateUrl
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
    this.updateContext = updateContext;
    this.updateConfig = updateConfig;
    this.updateBuilder = updateBuilder;
  }

  delete(...quads: QuadsInput[]): WithBuilderBaseWithout<this, TDynamic, 'delete'> {
    this.operation.delete = [...this.operation.delete, ...quads];
    return this;
  }

  insert(...quads: QuadsInput[]): WithBuilderBaseWithout<this, TDynamic, 'insert' | 'delete'> {
    this.operation.insert = [...this.operation.insert, ...quads];
    return this;
  }

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

  where(
    ...patterns: PatternInput<DialectPattern<D>>[]
  ): WithBuilderBaseWithout<this, TDynamic, 'where' | 'insert' | 'delete'> {
    this.operation.where.patterns = [
      ...this.operation.where.patterns,
      ...(patterns as unknown as PatternInput[]),
    ];
    return this;
  }

  $dynamic(): WithBuilderBaseWithout<this, true, any> {
    return this;
  }

  $end() {
    this.updateConfig.updates.push({
      context: this.updateContext,
      operation: this.operation,
    });
    return this.updateBuilder;
  }

  protected async makeQuery(): Promise<void> {
    this.$end();
    return await this.updateBuilder;
  }
}
