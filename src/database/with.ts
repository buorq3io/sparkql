import {
  Triple,
  IriTerm,
  Pattern,
  Update,
  UpdateQuads,
  SparqlClient,
  UpdateOperation,
  InsertDeleteOperation,
} from '../generic';
import { UpdateQueryBuilderBase } from './update';
import { SparqlQueryBuilderBase } from './sparql-query';
import { createBgpPatterns, createBgpQuads } from '../structures';

export class WithQueryBuilderBase
  extends SparqlQueryBuilderBase<Update, void>
  implements PromiseLike<void>
{
  private where_call = false;
  private insert_call = false;
  private delete_call = false;

  private _operation_push = false;
  private readonly _operation: Extract<
    InsertDeleteOperation,
    { updateType: 'insertdelete' }
  >;

  constructor(
    updates: UpdateOperation[],
    prefixes: Update['prefixes'],
    iri?: IriTerm
  ) {
    super({
      type: 'update',
      updates: updates,
      prefixes: prefixes,
    });
    this._operation = {
      updateType: 'insertdelete',
      where: [],
      insert: [],
      delete: [],
      graph: iri,
      using: {
        default: [],
        named: [],
      },
    };
  }

  insert(...quads: UpdateQuads) {
    this._operation.insert = [
      ...this._operation.insert,
      ...createBgpQuads(quads),
    ];
    this.insert_call = true;
    return this;
  }

  delete(...quads: UpdateQuads) {
    this._operation.delete = [
      ...this._operation.delete,
      ...createBgpQuads(quads),
    ];
    this.delete_call = true;
    return this;
  }

  where(...patterns: (Pattern | Triple)[]) {
    this._operation.where = [
      ...this._operation.where,
      ...createBgpPatterns(patterns),
    ];
    this.where_call = true;
    return this;
  }

  using(...iris: IriTerm[]) {
    this._operation.using!.default = [
      ...this._operation.using!.default,
      ...iris,
    ];
    return this;
  }

  usingNamed(...iris: IriTerm[]) {
    this._operation.using!.named = [...this._operation.using!.named, ...iris];
    return this;
  }

  end() {
    this.checkoutOperation();
    return new UpdateQueryBuilderBase(
      this.config.updates,
      this.config.prefixes
    );
  }

  protected makeQuery(client: SparqlClient): Promise<void> {
    this.checkoutOperation();
    return client.query.update(this.toSPARQL());
  }

  private checkoutOperation() {
    if (!(this.where_call && this.insert_call && this.delete_call)) {
      throw Error(
        '.insert(), .delete() and .where() should be called on modify operation.'
      );
    }
    if (this._operation_push) {
      this.config.updates.pop();
    }
    this.config.updates.push(this._operation);
    this._operation_push = true;
  }
}
