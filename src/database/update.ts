import type {
  GraphRefAllInput,
  GraphRefDefaultInput,
  GraphRefInput,
  GraphRefNamedInput,
  GraphRefSpecificInput,
  QuadsInput,
  TermIriInput,
  UpdateInput,
  UpdateOperationClearInput,
  UpdateOperationCreateInput,
  UpdateOperationDeleteDataInput,
  UpdateOperationDeleteWhereInput,
  UpdateOperationDropInput,
  UpdateOperationInsertDataInput,
  UpdateOperationLoadInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import { TransferQueryBuilderBase } from './transfer.js';
import { type WithParent, WithQueryBuilderBase } from './with.js';

export class UpdateQueryBuilderBase<
  D extends AnySparqlDialect = SparqlDialect,
> extends SparqlQueryBuilderBase<UpdateInput, void, D> {
  private context: UpdateInput['updates'][number]['context'];

  constructor(context: QueryModuleContext<D>) {
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
    this.context = [...context.context];
  }

  insertData(...quads: QuadsInput[]) {
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

  deleteData(...quads: QuadsInput[]) {
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

  insert(...quads: QuadsInput[]) {
    const base = new WithQueryBuilderBase<false, D>(this.builderContext, this.parent());
    return base.insert(...quads);
  }

  delete(...quads: QuadsInput[]) {
    const base = new WithQueryBuilderBase<false, D>(this.builderContext, this.parent());
    return base.delete(...quads);
  }

  private parent(): WithParent<D> {
    return { context: this.context, config: this.config, builder: this };
  }

  with(graph: TermIriInput) {
    return new WithQueryBuilderBase<false, D>(this.builderContext, this.parent(), graph);
  }

  copy(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'copy',
      createGraphRefSpecific(source)
    );
  }

  copyDefault() {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'copy',
      graphRefDefault
    );
  }

  copySilent(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'copy',
      createGraphRefSpecific(source),
      true
    );
  }

  copySilentDefault() {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'copy',
      graphRefDefault,
      true
    );
  }

  move(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'move',
      createGraphRefSpecific(source)
    );
  }

  moveDefault() {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'move',
      graphRefDefault
    );
  }

  moveSilent(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'move',
      createGraphRefSpecific(source),
      true
    );
  }

  moveSilentDefault() {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'move',
      graphRefDefault,
      true
    );
  }

  add(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'add',
      createGraphRefSpecific(source)
    );
  }

  addDefault() {
    return new TransferQueryBuilderBase<D>(this.context, this.config, this, 'add', graphRefDefault);
  }

  addSilent(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'add',
      createGraphRefSpecific(source),
      true
    );
  }

  addSilentDefault() {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'add',
      graphRefDefault,
      true
    );
  }

  private createLoadOperation(source: TermIriInput, destination?: TermIriInput, silent?: boolean) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: 'load',
          source: source,
          destination: destination ? createGraphRefSpecific(destination) : undefined,
          silent: silent ?? false,
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        } satisfies UpdateOperationLoadInput,
      },
    ];
    return this;
  }

  load(source: TermIriInput) {
    return this.createLoadOperation(source);
  }

  loadInto(source: TermIriInput, destination: TermIriInput) {
    return this.createLoadOperation(source, destination);
  }

  loadSilent(source: TermIriInput) {
    return this.createLoadOperation(source, undefined, true);
  }

  loadSilentInto(source: TermIriInput, destination: TermIriInput) {
    return this.createLoadOperation(source, destination, true);
  }

  private createCreateOperation(graph: GraphRefSpecificInput, silent?: boolean) {
    this.config.updates = [
      ...this.config.updates,
      {
        context: this.context,
        operation: {
          type: 'updateOperation',
          subType: 'create',
          destination: graph,
          silent: silent ?? false,
          loc: {
            sourceLocationType: 'autoGenerate',
          },
        } satisfies UpdateOperationCreateInput,
      },
    ];
    return this;
  }

  create(graph: TermIriInput) {
    return this.createCreateOperation(createGraphRefSpecific(graph));
  }

  createSilent(graph: TermIriInput) {
    return this.createCreateOperation(createGraphRefSpecific(graph), true);
  }

  private createClearDropOperation(type: 'clear' | 'drop', graph: GraphRefInput, silent?: boolean) {
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
            sourceLocationType: 'autoGenerate',
          },
        } satisfies UpdateOperationClearInput | UpdateOperationDropInput,
      },
    ];
    return this;
  }

  clear(graph: TermIriInput) {
    return this.createClearDropOperation('clear', createGraphRefSpecific(graph));
  }

  clearAll() {
    return this.createClearDropOperation('clear', graphRefAll);
  }

  clearDefault() {
    return this.createClearDropOperation('clear', graphRefDefault);
  }

  clearNamed() {
    return this.createClearDropOperation('clear', graphRefNamed);
  }

  clearSilent(graph: TermIriInput) {
    return this.createClearDropOperation('clear', createGraphRefSpecific(graph), true);
  }

  clearSilentAll() {
    return this.createClearDropOperation('clear', graphRefAll, true);
  }

  clearSilentDefault() {
    return this.createClearDropOperation('clear', graphRefDefault, true);
  }

  clearSilentNamed() {
    return this.createClearDropOperation('clear', graphRefNamed, true);
  }

  drop(graph: TermIriInput) {
    return this.createClearDropOperation('drop', createGraphRefSpecific(graph));
  }

  dropAll() {
    return this.createClearDropOperation('drop', graphRefAll);
  }

  dropDefault() {
    return this.createClearDropOperation('drop', graphRefDefault);
  }

  dropNamed() {
    return this.createClearDropOperation('drop', graphRefNamed);
  }

  dropSilent(graph: TermIriInput) {
    return this.createClearDropOperation('drop', createGraphRefSpecific(graph), true);
  }

  dropSilentAll() {
    return this.createClearDropOperation('drop', graphRefAll, true);
  }

  dropSilentDefault() {
    return this.createClearDropOperation('drop', graphRefDefault, true);
  }

  dropSilentNamed() {
    return this.createClearDropOperation('drop', graphRefNamed, true);
  }

  protected makeQuery(session: SparqlSession, sparql: string): Promise<void> {
    return session.update(sparql);
  }
}

export function createGraphRefSpecific(graph: TermIriInput): GraphRefSpecificInput {
  return {
    type: 'graphRef',
    subType: 'specific',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    graph: graph,
  };
}

export const graphRefAll: GraphRefAllInput = {
  type: 'graphRef',
  subType: 'all',
  loc: {
    sourceLocationType: 'autoGenerate',
  },
};

export const graphRefDefault: GraphRefDefaultInput = {
  type: 'graphRef',
  subType: 'default',
  loc: {
    sourceLocationType: 'autoGenerate',
  },
};

export const graphRefNamed: GraphRefNamedInput = {
  type: 'graphRef',
  subType: 'named',
  loc: {
    sourceLocationType: 'autoGenerate',
  },
};
