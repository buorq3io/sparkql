import {
  IriTerm,
  Update,
  UpdateQuads,
  SparqlClient,
  UpdateOperation,
} from '../generic';
import { createBgpQuads } from '../structures';
import { WithQueryBuilderBase } from './with';
import { SparqlQueryBuilderBase } from './sparql-query';

export class UpdateQueryBuilderBase extends SparqlQueryBuilderBase<
  Update,
  void
> {
  constructor(updates: UpdateOperation[], prefixes: Update['prefixes']) {
    super({
      type: 'update',
      updates: updates,
      prefixes: prefixes,
    });
  }

  insert(...quads: UpdateQuads) {
    this.config.updates = [
      ...this.config.updates,
      {
        updateType: 'insert',
        insert: createBgpQuads(quads),
      },
    ];
    return this;
  }

  delete(...quads: UpdateQuads) {
    this.config.updates = [
      ...this.config.updates,
      {
        updateType: 'delete',
        delete: createBgpQuads(quads),
      },
    ];
    return this;
  }

  deleteWhere(...quads: UpdateQuads) {
    this.config.updates = [
      ...this.config.updates,
      {
        updateType: 'deletewhere',
        delete: createBgpQuads(quads),
      },
    ];
    return this;
  }

  with(iri?: IriTerm) {
    return new WithQueryBuilderBase(
      this.config.updates,
      this.config.prefixes,
      iri
    );
  }

  protected makeQuery(client: SparqlClient): Promise<void> {
    return client.query.update(this.toSPARQL());
  }
}
