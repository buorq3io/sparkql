import {
  IriTerm,
  Update,
  Quads,
  SparqlClient,
  GraphReference,
  GraphOrDefault,
  LoadOperation,
  UpdateOperation,
  CreateOperation,
  ClearDropOperation,
  CopyMoveAddOperation,
  DataFactory,
  FactoryFunctions,
} from '../generic';
import { WithQueryBuilderBase } from './with';
import { SparqlQueryBuilderBase } from './sparql-query';

export class UpdateQueryBuilderBase extends SparqlQueryBuilderBase<Update, void> {
  constructor(
    updates: UpdateOperation[],
    prefixes: Update['prefixes'],
    base: string | undefined,
    factoryFunctions: FactoryFunctions
  ) {
    super(
      {
        type: 'update',
        updates: updates,
        base: base,
        prefixes: prefixes,
      },
      factoryFunctions
    );
  }

  insert(...quads: Quads[]) {
    this.config.updates = [
      ...this.config.updates,
      {
        updateType: 'insert',
        insert: quads.map(q => this.sanitizeQuads(q)),
      },
    ];
    return this;
  }

  delete(...quads: Quads[]) {
    this.config.updates = [
      ...this.config.updates,
      {
        updateType: 'delete',
        delete: quads.map(q => this.sanitizeQuads(q)),
      },
    ];
    return this;
  }

  deleteWhere(...quads: Quads[]) {
    this.config.updates = [
      ...this.config.updates,
      {
        updateType: 'deletewhere',
        delete: quads.map(q => this.sanitizeQuads(q)),
      },
    ];
    return this;
  }

  with(iri?: IriTerm) {
    return new WithQueryBuilderBase(
      this.config.updates,
      this.config.prefixes,
      this.config.base,
      this.factoryFunctions,
      iri
    );
  }

  private createCopyMoveAddOperation(
    type: 'copy' | 'move' | 'add',
    source: GraphOrDefault,
    destination: GraphOrDefault,
    silent: boolean = false
  ) {
    this.config.updates = [
      ...this.config.updates,
      {
        type: type,
        silent: silent,
        source: source,
        destination: destination,
      } as CopyMoveAddOperation,
    ];
    return this;
  }

  copy(source: GraphOrDefault, destination: GraphOrDefault) {
    return this.createCopyMoveAddOperation('copy', source, destination);
  }

  copySilent(source: GraphOrDefault, destination: GraphOrDefault) {
    return this.createCopyMoveAddOperation('copy', source, destination, true);
  }

  move(source: GraphOrDefault, destination: GraphOrDefault) {
    return this.createCopyMoveAddOperation('move', source, destination);
  }

  moveSilent(source: GraphOrDefault, destination: GraphOrDefault) {
    return this.createCopyMoveAddOperation('move', source, destination, true);
  }

  add(source: GraphOrDefault, destination: GraphOrDefault) {
    return this.createCopyMoveAddOperation('add', source, destination);
  }

  addSilent(source: GraphOrDefault, destination: GraphOrDefault) {
    return this.createCopyMoveAddOperation('add', source, destination, true);
  }

  private createLoadOperation(
    source: IriTerm,
    destination: IriTerm | false,
    silent: boolean = false
  ) {
    this.config.updates = [
      ...this.config.updates,
      {
        type: 'load',
        silent: silent,
        source: source,
        destination: destination,
      } as LoadOperation,
    ];
    return this;
  }

  load(source: IriTerm, destination: IriTerm | false) {
    return this.createLoadOperation(source, destination);
  }

  loadSilent(source: IriTerm, destination: IriTerm | false) {
    return this.createLoadOperation(source, destination, true);
  }

  private createCreateOperation(graph: GraphOrDefault, silent: boolean = false) {
    this.config.updates = [
      ...this.config.updates,
      {
        type: 'create',
        silent: silent,
        graph: graph,
      } as CreateOperation,
    ];
    return this;
  }

  create(graph: GraphOrDefault) {
    return this.createCreateOperation(graph);
  }

  createSilent(graph: GraphOrDefault) {
    return this.createCreateOperation(graph, true);
  }

  private createClearDropOperation(
    type: 'clear' | 'drop',
    graph: GraphReference,
    silent: boolean = false
  ) {
    this.config.updates = [
      ...this.config.updates,
      {
        type: type,
        silent: silent,
        graph: graph,
      } as ClearDropOperation,
    ];
    return this;
  }

  clear(graph: GraphOrDefault) {
    return this.createClearDropOperation('clear', graph);
  }

  clearSilent(graph: GraphOrDefault) {
    return this.createClearDropOperation('clear', graph, true);
  }

  drop(graph: GraphOrDefault) {
    return this.createClearDropOperation('drop', graph);
  }

  dropSilent(graph: GraphOrDefault) {
    return this.createClearDropOperation('drop', graph, true);
  }

  protected makeQuery(client: SparqlClient): Promise<void> {
    return client.query.update(this.toSPARQL());
  }
}
