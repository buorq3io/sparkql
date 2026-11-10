import type {
  GraphRefDefaultInput,
  GraphRefSpecificInput,
  TermIriInput,
  UpdateInput,
  UpdateOperationAddInput,
  UpdateOperationCopyInput,
  UpdateOperationMoveInput,
} from '../helpers/types.js';
import type { AnySparqlDialect, SparqlDialect } from './dialect.js';
import { createGraphRefSpecific, graphRefDefault, type UpdateQueryBuilderBase } from './update.js';

/** Destination selection for a `COPY`, `MOVE`, or `ADD` update. */
export class TransferQueryBuilderBase<D extends AnySparqlDialect = SparqlDialect> {
  private updateConfig: UpdateInput;
  private updateContext: UpdateInput['updates'][number]['context'];
  private updateBuilder: UpdateQueryBuilderBase<D>;
  private readonly operation:
    | UpdateOperationCopyInput
    | UpdateOperationMoveInput
    | UpdateOperationAddInput;

  constructor(
    updateContext: UpdateInput['updates'][number]['context'],
    updateConfig: UpdateInput,
    updateBuilder: UpdateQueryBuilderBase<D>,
    type: 'copy' | 'move' | 'add',
    source: GraphRefSpecificInput | GraphRefDefaultInput,
    silent: boolean = false
  ) {
    this.operation = {
      type: 'updateOperation',
      subType: type,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      silent: silent,
      source: source,
    } as any;
    this.updateContext = updateContext;
    this.updateConfig = updateConfig;
    this.updateBuilder = updateBuilder;
  }

  /**
   * Sets a named graph as the destination and returns the update builder.
   *
   * @param graph - Destination graph IRI.
   *
   * @example
   * Select a destination.
   *
   * ```ts
   * import type { TransferQueryBuilderBase } from './transfer.js';
   * const transfer = {} as TransferQueryBuilderBase;
   * import type { TermIriInput } from '../helpers/types.js';
   * transfer.to({} as TermIriInput);
   * ```
   */
  to(graph: TermIriInput) {
    this.operation.destination = createGraphRefSpecific(graph);
    return this.$end();
  }

  /**
   * Sets the default graph as the destination and returns the update builder.
   *
   * @example
   * Select the default graph.
   *
   * ```ts
   * import type { TransferQueryBuilderBase } from './transfer.js';
   * const transfer = {} as TransferQueryBuilderBase;
   * transfer.toDefault();
   * ```
   */
  toDefault() {
    this.operation.destination = graphRefDefault;
    return this.$end();
  }

  private $end() {
    this.updateConfig.updates.push({
      context: this.updateContext,
      operation: this.operation,
    });
    return this.updateBuilder;
  }
}
