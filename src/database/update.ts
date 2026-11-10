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
import type { MergePlaceholders, PlaceholderCarrier, placeholderTypes } from './prepared.js';
import type { QueryModuleContext } from './query-module.js';
import type { SparqlSession } from './session.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';
import { TransferQueryBuilderBase } from './transfer.js';
import { type WithParent, WithQueryBuilderBase } from './with.js';

/** A builder for a sequence of SPARQL Update operations. */
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

  /**
   * Adds an `INSERT DATA` update operation.
   *
   * Appends an operation to the request; placeholders are carried into preparation.
   *
   * @param quads - Quad patterns to include.
   *
   * @example
   * Add the name Ada to foaf:Person.
   *
   * ```ts
   * db.insertData(triples(n.foaf.Person, n.foaf.name, 'Ada'));
   * ```
   *
   * ```sparql
   * INSERT DATA {
   *   foaf:Person foaf:name "Ada" .
   * }
   * ```
   */
  insertData<Self extends PlaceholderCarrier<object>, Q extends QuadsInput[]>(
    this: Self,
    ...quads: Q
  ): this &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Q[number]>>;

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

  /**
   * Adds a `DELETE DATA` update operation.
   *
   * Appends an operation to the request; placeholders are carried into preparation.
   *
   * @param quads - Quad patterns to include.
   *
   * @example
   * Remove the name Ada from foaf:Person.
   *
   * ```ts
   * db.deleteData(triples(n.foaf.Person, n.foaf.name, 'Ada'));
   * ```
   *
   * ```sparql
   * DELETE DATA {
   *   foaf:Person foaf:name "Ada" .
   * }
   * ```
   */
  deleteData<Self extends PlaceholderCarrier<object>, Q extends QuadsInput[]>(
    this: Self,
    ...quads: Q
  ): this &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Q[number]>>;

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

  /**
   * Adds a `DELETE WHERE` update operation.
   *
   * Appends an operation to the request; placeholders are carried into preparation.
   *
   * @param quads - Quad patterns to include.
   *
   * @example
   * Remove every matching person name.
   *
   * ```ts
   * db.deleteWhere(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * DELETE WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  deleteWhere<Self extends PlaceholderCarrier<object>, Q extends QuadsInput[]>(
    this: Self,
    ...quads: Q
  ): this &
    PlaceholderCarrier<NonNullable<Self[typeof placeholderTypes]> & MergePlaceholders<Q[number]>>;

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

  /**
   * Adds an `INSERT` update operation.
   *
   * Starts a modify operation; add its patterns with `where()`. Without them the operation
   * is generated with an empty `WHERE { }`.
   *
   * @param quads - Quad templates for the operation.
   *
   * @example
   * Add Ada as a name for every person who already has a name.
   *
   * ```ts
   * db.insert(triples(v.person, n.foaf.name, 'Ada')).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * INSERT {
   *   ?person foaf:name "Ada" .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  insert(...quads: QuadsInput[]) {
    const base = new WithQueryBuilderBase<false, D>(this.builderContext, this.parent());
    return base.insert(...quads);
  }

  /**
   * Adds a `DELETE` update operation.
   *
   * Starts a modify operation; add its patterns with `where()`. Without them the operation
   * is generated with an empty `WHERE { }`.
   *
   * @param quads - Quad templates for the operation.
   *
   * @example
   * Remove all matching person names.
   *
   * ```ts
   * db.delete(triples(v.person, n.foaf.name, v.name)).where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * DELETE {
   *   ?person foaf:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  delete(...quads: QuadsInput[]) {
    const base = new WithQueryBuilderBase<false, D>(this.builderContext, this.parent());
    return base.delete(...quads);
  }

  private parent(): WithParent<D> {
    return { context: this.context, config: this.config, builder: this };
  }

  /**
   * Adds a `WITH` update operation.
   *
   * Starts a modify operation using the specified graph.
   *
   * @param graph - Graph used by the modify operation.
   *
   * @example
   * Remove person names from the schema:Person graph.
   *
   * ```ts
   * db.with(n.schema.Person).delete(triples(v.person, n.foaf.name, v.name))
   *   .where(triples(v.person, n.foaf.name, v.name));
   * ```
   *
   * ```sparql
   * WITH schema:Person DELETE {
   *   ?person foaf:name ?name .
   * }
   * WHERE {
   *   ?person foaf:name ?name .
   * }
   * ```
   */
  with(graph: TermIriInput) {
    return new WithQueryBuilderBase<false, D>(this.builderContext, this.parent(), graph);
  }

  /**
   * Adds a `COPY` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Replace the schema:Person graph with the foaf:Person graph.
   *
   * ```ts
   * db.copy(n.foaf.Person).to(n.schema.Person);
   * ```
   *
   * ```sparql
   * COPY GRAPH foaf:Person TO GRAPH schema:Person
   * ```
   */
  copy(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'copy',
      createGraphRefSpecific(source)
    );
  }

  /**
   * Adds a `COPY DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @example
   * Replace the schema:Person graph with the default graph.
   *
   * ```ts
   * db.copyDefault().to(n.schema.Person);
   * ```
   *
   * ```sparql
   * COPY DEFAULT TO GRAPH schema:Person
   * ```
   */
  copyDefault() {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'copy',
      graphRefDefault
    );
  }

  /**
   * Adds a `COPY SILENT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Replace the schema:Person graph with the foaf:Person graph, suppressing errors.
   *
   * ```ts
   * db.copySilent(n.foaf.Person).to(n.schema.Person);
   * ```
   *
   * ```sparql
   * COPY SILENT GRAPH foaf:Person TO GRAPH schema:Person
   * ```
   */
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

  /**
   * Adds a `COPY SILENT DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Replace the schema:Person graph with the default graph, suppressing errors.
   *
   * ```ts
   * db.copySilentDefault().to(n.schema.Person);
   * ```
   *
   * ```sparql
   * COPY SILENT DEFAULT TO GRAPH schema:Person
   * ```
   */
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

  /**
   * Adds a `MOVE` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Move into the schema:Person graph the contents of the foaf:Person graph.
   *
   * ```ts
   * db.move(n.foaf.Person).to(n.schema.Person);
   * ```
   *
   * ```sparql
   * MOVE GRAPH foaf:Person TO GRAPH schema:Person
   * ```
   */
  move(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'move',
      createGraphRefSpecific(source)
    );
  }

  /**
   * Adds a `MOVE DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @example
   * Move into the schema:Person graph the contents of the default graph.
   *
   * ```ts
   * db.moveDefault().to(n.schema.Person);
   * ```
   *
   * ```sparql
   * MOVE DEFAULT TO GRAPH schema:Person
   * ```
   */
  moveDefault() {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'move',
      graphRefDefault
    );
  }

  /**
   * Adds a `MOVE SILENT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Move into the schema:Person graph the contents of the foaf:Person graph, suppressing errors.
   *
   * ```ts
   * db.moveSilent(n.foaf.Person).to(n.schema.Person);
   * ```
   *
   * ```sparql
   * MOVE SILENT GRAPH foaf:Person TO GRAPH schema:Person
   * ```
   */
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

  /**
   * Adds a `MOVE SILENT DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Move into the schema:Person graph the contents of the default graph, suppressing errors.
   *
   * ```ts
   * db.moveSilentDefault().to(n.schema.Person);
   * ```
   *
   * ```sparql
   * MOVE SILENT DEFAULT TO GRAPH schema:Person
   * ```
   */
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

  /**
   * Adds an `ADD` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Add to the schema:Person graph the contents of the foaf:Person graph.
   *
   * ```ts
   * db.add(n.foaf.Person).to(n.schema.Person);
   * ```
   *
   * ```sparql
   * ADD GRAPH foaf:Person TO GRAPH schema:Person
   * ```
   */
  add(source: TermIriInput) {
    return new TransferQueryBuilderBase<D>(
      this.context,
      this.config,
      this,
      'add',
      createGraphRefSpecific(source)
    );
  }

  /**
   * Adds an `ADD DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation.
   *
   * @example
   * Add to the schema:Person graph the contents of the default graph.
   *
   * ```ts
   * db.addDefault().to(n.schema.Person);
   * ```
   *
   * ```sparql
   * ADD DEFAULT TO GRAPH schema:Person
   * ```
   */
  addDefault() {
    return new TransferQueryBuilderBase<D>(this.context, this.config, this, 'add', graphRefDefault);
  }

  /**
   * Adds an `ADD SILENT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param source - Source graph IRI.
   *
   * @example
   * Add to the schema:Person graph the contents of the foaf:Person graph, suppressing errors.
   *
   * ```ts
   * db.addSilent(n.foaf.Person).to(n.schema.Person);
   * ```
   *
   * ```sparql
   * ADD SILENT GRAPH foaf:Person TO GRAPH schema:Person
   * ```
   */
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

  /**
   * Adds an `ADD SILENT DEFAULT` update operation.
   *
   * Choose the destination with `to()` or `toDefault()` to append the operation. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Add to the schema:Person graph the contents of the default graph, suppressing errors.
   *
   * ```ts
   * db.addSilentDefault().to(n.schema.Person);
   * ```
   *
   * ```sparql
   * ADD SILENT DEFAULT TO GRAPH schema:Person
   * ```
   */
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

  /**
   * Adds a `LOAD` update operation.
   *
   * Appends the operation to the request.
   *
   * @param source - Source document IRI.
   *
   * @example
   * Load the foaf:Person document into the default graph.
   *
   * ```ts
   * db.load(n.foaf.Person);
   * ```
   *
   * ```sparql
   * LOAD foaf:Person
   * ```
   */
  load(source: TermIriInput) {
    return this.createLoadOperation(source);
  }

  /**
   * Adds a `LOAD INTO` update operation.
   *
   * Appends the operation to the request.
   *
   * @param source - Source document IRI.
   * @param destination - Destination graph IRI.
   *
   * @example
   * Load the foaf:Person document into the schema:Person graph.
   *
   * ```ts
   * db.loadInto(n.foaf.Person, n.schema.Person);
   * ```
   *
   * ```sparql
   * LOAD foaf:Person INTO GRAPH schema:Person
   * ```
   */
  loadInto(source: TermIriInput, destination: TermIriInput) {
    return this.createLoadOperation(source, destination);
  }

  /**
   * Adds a `LOAD SILENT` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param source - Source document IRI.
   *
   * @example
   * Load the foaf:Person document, suppressing errors.
   *
   * ```ts
   * db.loadSilent(n.foaf.Person);
   * ```
   *
   * ```sparql
   * LOAD SILENT foaf:Person
   * ```
   */
  loadSilent(source: TermIriInput) {
    return this.createLoadOperation(source, undefined, true);
  }

  /**
   * Adds a `LOAD SILENT INTO` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param source - Source document IRI.
   * @param destination - Destination graph IRI.
   *
   * @example
   * Load the foaf:Person document into schema:Person, suppressing errors.
   *
   * ```ts
   * db.loadSilentInto(n.foaf.Person, n.schema.Person);
   * ```
   *
   * ```sparql
   * LOAD SILENT foaf:Person INTO GRAPH schema:Person
   * ```
   */
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

  /**
   * Adds a `CREATE` update operation.
   *
   * Appends the operation to the request.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Create the foaf:Person graph.
   *
   * ```ts
   * db.create(n.foaf.Person);
   * ```
   *
   * ```sparql
   * CREATE GRAPH foaf:Person
   * ```
   */
  create(graph: TermIriInput) {
    return this.createCreateOperation(createGraphRefSpecific(graph));
  }

  /**
   * Adds a `CREATE SILENT` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Create the foaf:Person graph, suppressing errors.
   *
   * ```ts
   * db.createSilent(n.foaf.Person);
   * ```
   *
   * ```sparql
   * CREATE SILENT GRAPH foaf:Person
   * ```
   */
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

  /**
   * Adds a `CLEAR` update operation.
   *
   * Appends the operation to the request.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Clear the foaf:Person graph.
   *
   * ```ts
   * db.clear(n.foaf.Person);
   * ```
   *
   * ```sparql
   * CLEAR GRAPH foaf:Person
   * ```
   */
  clear(graph: TermIriInput) {
    return this.createClearDropOperation('clear', createGraphRefSpecific(graph));
  }

  /**
   * Adds a `CLEAR ALL` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Clear all graphs.
   *
   * ```ts
   * db.clearAll();
   * ```
   *
   * ```sparql
   * CLEAR ALL
   * ```
   */
  clearAll() {
    return this.createClearDropOperation('clear', graphRefAll);
  }

  /**
   * Adds a `CLEAR DEFAULT` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Clear the default graph.
   *
   * ```ts
   * db.clearDefault();
   * ```
   *
   * ```sparql
   * CLEAR DEFAULT
   * ```
   */
  clearDefault() {
    return this.createClearDropOperation('clear', graphRefDefault);
  }

  /**
   * Adds a `CLEAR NAMED` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Clear all named graphs.
   *
   * ```ts
   * db.clearNamed();
   * ```
   *
   * ```sparql
   * CLEAR NAMED
   * ```
   */
  clearNamed() {
    return this.createClearDropOperation('clear', graphRefNamed);
  }

  /**
   * Adds a `CLEAR SILENT` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Clear the foaf:Person graph, suppressing errors.
   *
   * ```ts
   * db.clearSilent(n.foaf.Person);
   * ```
   *
   * ```sparql
   * CLEAR SILENT GRAPH foaf:Person
   * ```
   */
  clearSilent(graph: TermIriInput) {
    return this.createClearDropOperation('clear', createGraphRefSpecific(graph), true);
  }

  /**
   * Adds a `CLEAR SILENT ALL` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Clear all graphs, suppressing errors.
   *
   * ```ts
   * db.clearSilentAll();
   * ```
   *
   * ```sparql
   * CLEAR SILENT ALL
   * ```
   */
  clearSilentAll() {
    return this.createClearDropOperation('clear', graphRefAll, true);
  }

  /**
   * Adds a `CLEAR SILENT DEFAULT` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Clear the default graph, suppressing errors.
   *
   * ```ts
   * db.clearSilentDefault();
   * ```
   *
   * ```sparql
   * CLEAR SILENT DEFAULT
   * ```
   */
  clearSilentDefault() {
    return this.createClearDropOperation('clear', graphRefDefault, true);
  }

  /**
   * Adds a `CLEAR SILENT NAMED` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Clear all named graphs, suppressing errors.
   *
   * ```ts
   * db.clearSilentNamed();
   * ```
   *
   * ```sparql
   * CLEAR SILENT NAMED
   * ```
   */
  clearSilentNamed() {
    return this.createClearDropOperation('clear', graphRefNamed, true);
  }

  /**
   * Adds a `DROP` update operation.
   *
   * Appends the operation to the request.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Drop the foaf:Person graph.
   *
   * ```ts
   * db.drop(n.foaf.Person);
   * ```
   *
   * ```sparql
   * DROP GRAPH foaf:Person
   * ```
   */
  drop(graph: TermIriInput) {
    return this.createClearDropOperation('drop', createGraphRefSpecific(graph));
  }

  /**
   * Adds a `DROP ALL` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Drop all graphs.
   *
   * ```ts
   * db.dropAll();
   * ```
   *
   * ```sparql
   * DROP ALL
   * ```
   */
  dropAll() {
    return this.createClearDropOperation('drop', graphRefAll);
  }

  /**
   * Adds a `DROP DEFAULT` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Drop the default graph.
   *
   * ```ts
   * db.dropDefault();
   * ```
   *
   * ```sparql
   * DROP DEFAULT
   * ```
   */
  dropDefault() {
    return this.createClearDropOperation('drop', graphRefDefault);
  }

  /**
   * Adds a `DROP NAMED` update operation.
   *
   * Appends the operation to the request.
   *
   * @example
   * Drop all named graphs.
   *
   * ```ts
   * db.dropNamed();
   * ```
   *
   * ```sparql
   * DROP NAMED
   * ```
   */
  dropNamed() {
    return this.createClearDropOperation('drop', graphRefNamed);
  }

  /**
   * Adds a `DROP SILENT` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @param graph - Graph IRI.
   *
   * @example
   * Drop the foaf:Person graph, suppressing errors.
   *
   * ```ts
   * db.dropSilent(n.foaf.Person);
   * ```
   *
   * ```sparql
   * DROP SILENT GRAPH foaf:Person
   * ```
   */
  dropSilent(graph: TermIriInput) {
    return this.createClearDropOperation('drop', createGraphRefSpecific(graph), true);
  }

  /**
   * Adds a `DROP SILENT ALL` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Drop all graphs, suppressing errors.
   *
   * ```ts
   * db.dropSilentAll();
   * ```
   *
   * ```sparql
   * DROP SILENT ALL
   * ```
   */
  dropSilentAll() {
    return this.createClearDropOperation('drop', graphRefAll, true);
  }

  /**
   * Adds a `DROP SILENT DEFAULT` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Drop the default graph, suppressing errors.
   *
   * ```ts
   * db.dropSilentDefault();
   * ```
   *
   * ```sparql
   * DROP SILENT DEFAULT
   * ```
   */
  dropSilentDefault() {
    return this.createClearDropOperation('drop', graphRefDefault, true);
  }

  /**
   * Adds a `DROP SILENT NAMED` update operation.
   *
   * Appends the operation to the request. The `SILENT` modifier requests suppression of errors for this operation.
   *
   * @example
   * Drop all named graphs, suppressing errors.
   *
   * ```ts
   * db.dropSilentNamed();
   * ```
   *
   * ```sparql
   * DROP SILENT NAMED
   * ```
   */
  dropSilentNamed() {
    return this.createClearDropOperation('drop', graphRefNamed, true);
  }

  protected makeQuery(session: SparqlSession, sparql: string): Promise<void> {
    return session.update(sparql);
  }
}

/** @internal Graph reference to one named graph (`GRAPH <iri>`). */
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

/** @internal Graph reference to every graph (`ALL`). */
export const graphRefAll: GraphRefAllInput = {
  type: 'graphRef',
  subType: 'all',
  loc: {
    sourceLocationType: 'autoGenerate',
  },
};

/** @internal Graph reference to the default graph (`DEFAULT`). */
export const graphRefDefault: GraphRefDefaultInput = {
  type: 'graphRef',
  subType: 'default',
  loc: {
    sourceLocationType: 'autoGenerate',
  },
};

/** @internal Graph reference to every named graph (`NAMED`). */
export const graphRefNamed: GraphRefNamedInput = {
  type: 'graphRef',
  subType: 'named',
  loc: {
    sourceLocationType: 'autoGenerate',
  },
};
