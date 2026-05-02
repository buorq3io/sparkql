import {
  UpdateInput,
  TermIriInput,
  GraphRefSpecificInput,
  UpdateOperationMoveInput,
  UpdateOperationCopyInput,
  UpdateOperationAddInput,
  GraphRefDefaultInput,
} from '../helpers/types.js';
import { createGraphRefSpecific, graphRefDefault, UpdateQueryBuilderBase } from './update.js';

export class TransferQueryBuilderBase {
  private updateConfig: UpdateInput;
  private updateContext: UpdateInput['updates'][number]['context'];
  private updateBuilder: UpdateQueryBuilderBase;
  private readonly operation:
    | UpdateOperationCopyInput
    | UpdateOperationMoveInput
    | UpdateOperationAddInput;

  constructor(
    updateContext: UpdateInput['updates'][number]['context'],
    updateConfig: UpdateInput,
    updateBuilder: UpdateQueryBuilderBase,
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

  to(graph: TermIriInput) {
    this.operation.destination = createGraphRefSpecific(graph);
    return this.$end();
  }

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
