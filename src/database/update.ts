import { WithQueryBuilderBase } from './with.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import {
  FactoryFunctions,
  GraphRefDefaultInput,
  GraphRefInput,
  GraphRefSpecificInput,
  QuadsInput,
  SparqlClient,
  TermIriInput,
  UpdateInput,
  UpdateOperationAddInput,
  UpdateOperationClearInput,
  UpdateOperationCopyInput,
  UpdateOperationCreateInput,
  UpdateOperationDeleteDataInput,
  UpdateOperationDeleteWhereInput,
  UpdateOperationDropInput,
  UpdateOperationInsertDataInput,
  UpdateOperationLoadInput,
  UpdateOperationMoveInput,
} from '../helpers/types.js';

export class UpdateQueryBuilderBase extends SparqlQueryBuilderBase<UpdateInput, void> {
  private context;

  constructor(
    context: UpdateInput['updates'][number]['context'],
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string
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
    this.context = context;
  }

  insert(...quads: QuadsInput[]) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: 'insertdata',
          data: quads,
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        } satisfies UpdateOperationInsertDataInput,
      },
    ];

    return this;
  }

  delete(...quads: QuadsInput[]) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: 'deletedata',
          data: quads,
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        } satisfies UpdateOperationDeleteDataInput,
      },
    ];

    return this;
  }

  deleteWhere(...quads: QuadsInput[]) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: 'deletewhere',
          data: quads,
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        } satisfies UpdateOperationDeleteWhereInput,
      },
    ];

    return this;
  }

  with(iri?: TermIriInput) {
    return new WithQueryBuilderBase(
      this.context,
      this.config,
      this,
      this.factoryFunctions,
      this.endpointUrl,
      iri
    );
  }

  private createTransferOperation(
    type: 'copy' | 'move' | 'add',
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput,
    silent?: boolean
  ) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: type,
          source: source,
          destination: destination,
          silent: silent ?? false,
          loc: {
            sourceLocationType: "autoGenerate"
          }
        } satisfies UpdateOperationCopyInput | UpdateOperationMoveInput | UpdateOperationAddInput,
      },
    ];
    return this;
  }

  copy(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.createTransferOperation('copy', source, destination);
  }

  copySilent(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.createTransferOperation('copy', source, destination, true);
  }

  move(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.createTransferOperation('move', source, destination);
  }

  moveSilent(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.createTransferOperation('move', source, destination, true);
  }

  add(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.createTransferOperation('add', source, destination);
  }

  addSilent(
    source: GraphRefDefaultInput | GraphRefSpecificInput,
    destination: GraphRefDefaultInput | GraphRefSpecificInput
  ) {
    return this.createTransferOperation('add', source, destination, true);
  }

  private createLoadOperation(
    source: TermIriInput,
    destination?: GraphRefSpecificInput,
    silent?: boolean
  ) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: "load",
          source: source,
          destination: destination,
          silent: silent ?? false,
          loc: {
            sourceLocationType: "autoGenerate"
          }
        } satisfies UpdateOperationLoadInput,
      },
    ];
    return this;
  }

  load(source: TermIriInput, destination?: GraphRefSpecificInput) {
    return this.createLoadOperation(source, destination);
  }

  loadSilent(source: TermIriInput, destination?: GraphRefSpecificInput) {
    return this.createLoadOperation(source, destination, true);
  }

  private createCreateOperation(graph: GraphRefSpecificInput, silent?: boolean) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: "create",
          destination: graph,
          silent: silent ?? false,
          loc: {
            sourceLocationType: "autoGenerate"
          }
        } satisfies UpdateOperationCreateInput,
      },
    ];
    return this;
  }

  create(graph: GraphRefSpecificInput) {
    return this.createCreateOperation(graph);
  }

  createSilent(graph: GraphRefSpecificInput) {
    return this.createCreateOperation(graph, true);
  }

  private createClearDropOperation(
    type: 'clear' | 'drop',
    graph: GraphRefInput,
    silent?: boolean
  ) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: type,
          destination: graph,
          silent: silent ?? false,
          loc: {
            sourceLocationType: "autoGenerate"
          }
        } satisfies UpdateOperationClearInput | UpdateOperationDropInput,
      },
    ];
    return this;
  }

  clear(graph: GraphRefInput) {
    return this.createClearDropOperation('clear', graph);
  }

  clearSilent(graph: GraphRefInput) {
    return this.createClearDropOperation('clear', graph, true);
  }

  drop(graph: GraphRefInput) {
    return this.createClearDropOperation('drop', graph);
  }

  dropSilent(graph: GraphRefInput) {
    return this.createClearDropOperation('drop', graph, true);
  }

  protected makeQuery(client: SparqlClient): Promise<void> {
    return client.query.update(this.toSPARQL());
  }
}
