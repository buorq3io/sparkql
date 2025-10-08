import {
  Quads,
  Update,
  IriTerm,
  Pattern,
  FactoryFunctions,
  SparqlClient,
  UpdateOperation,
  InsertDeleteOperation,
} from '../generic.js';
import { UpdateQueryBuilderBase } from './update.js';
import { SparqlQueryBuilderBase } from './sparql-query.js';

export class WithQueryBuilderBase
  extends SparqlQueryBuilderBase<Update, void>
  implements PromiseLike<void>
{
  private where_call = false;
  private insert_call = false;
  private delete_call = false;

  private _operation_push = false;
  private readonly _operation: Extract<InsertDeleteOperation, { updateType: 'insertdelete' }>;

  constructor(
    updates: UpdateOperation[],
    prefixes: Update['prefixes'],
    base: string | undefined,
    factoryFunctions: FactoryFunctions,
    endpointUrl?: string,
    iri?: IriTerm,
  ) {
    super(
      {
        type: 'update',
        updates: updates,
        base: base,
        prefixes: prefixes,
      },
      factoryFunctions,
      endpointUrl
    );
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

  insert(...quads: Quads[]) {
    if (quads.length === 0) {
      return this;
    }

    this._operation.insert = [...this._operation.insert, ...quads];
    this.insert_call = true;
    return this;
  }

  delete(...quads: Quads[]) {
    if (quads.length === 0) {
      return this;
    }

    this._operation.delete = [...this._operation.delete, ...quads];
    this.delete_call = true;
    return this;
  }

  where(...patterns: Pattern[]) {
    this._operation.where = [...this._operation.where, ...patterns];
    this.where_call = true;
    return this;
  }

  using(...iris: IriTerm[]) {
    if (iris.length === 0) {
      return this;
    }

    if (this._operation.using) {
      this._operation.using.default = [...this._operation.using.default, ...iris];
    } else {
      this._operation.using = {
        default: iris,
        named: [],
      };
    }
    return this;
  }

  usingNamed(...iris: IriTerm[]) {
    if (iris.length === 0) {
      return this;
    }

    if (this._operation.using) {
      this._operation.using.named = [...this._operation.using.named, ...iris];
    } else {
      this._operation.using = {
        default: [],
        named: iris,
      };
    }
    return this;
  }

  end() {
    this.checkoutOperation();
    return new UpdateQueryBuilderBase(
      this.config.updates,
      this.config.prefixes,
      this.config.base,
      this.factoryFunctions,
      this.endpointUrl
    );
  }

  protected makeQuery(client: SparqlClient): Promise<void> {
    this.checkoutOperation();
    return client.query.update(this.toSPARQL());
  }

  private checkoutOperation() {
    if (!(this.where_call && this.insert_call && this.delete_call)) {
      throw Error('.insert(), .delete() and .where() should be called on modify operation.');
    }
    if (this._operation_push) {
      this.config.updates.pop();
    }
    this.config.updates.push(this._operation);
    this._operation_push = true;
  }
}
