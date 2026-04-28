import { UpdateQueryBuilderBase } from './update.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import {
  FactoryFunctions,
  PatternInput,
  QuadsInput,
  TermIriInput,
  UpdateInput,
  UpdateOperationModifyInput,
} from '../helpers/types.js';

export class WithQueryBuilderBase
  extends SparqlQueryBuilderBase<UpdateInput, void>
  implements PromiseLike<void>
{
  private updateConfig: UpdateInput;
  private updateContext: UpdateInput['updates'][number]['context'];
  private updateBuilder: UpdateQueryBuilderBase;
  private readonly operation: UpdateOperationModifyInput;

  constructor(
    updateContext: UpdateInput['updates'][number]['context'],
    updateConfig: UpdateInput,
    updateBuilder: UpdateQueryBuilderBase,
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string,
    iri?: TermIriInput
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
      endpointUrl
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

  insert(...quads: QuadsInput[]) {
    this.operation.insert = [...this.operation.insert, ...quads];
    return this;
  }

  delete(...quads: QuadsInput[]) {
    this.operation.delete = [...this.operation.delete, ...quads];
    return this;
  }

  where(...patterns: PatternInput[]) {
    this.operation.where.patterns = [...this.operation.where.patterns, ...patterns];
    return this;
  }

  using(iri: TermIriInput) {
    this.operation.from.clauses = [
      ...this.operation.from.clauses,
      {
        clauseType: 'default',
        value: iri,
      },
    ];
    return this;
  }

  usingNamed(iri: TermIriInput) {
    this.operation.from.clauses = [
      ...this.operation.from.clauses,
      {
        clauseType: 'named',
        value: iri,
      },
    ];
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
    return await this.updateBuilder
  }
}
