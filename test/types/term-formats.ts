import type * as AST from '@traqula/rules-sparql-1-1';
import { expectTypeOf } from 'vitest';
import {
  type FormatInput,
  type Formatter,
  SparqlDatabase,
  type TermLiteralInput,
} from '../../src/index.js';

class Money {
  constructor(readonly amount: number) {}
}
class Entity {
  constructor(readonly id: string) {}
}
const money: Formatter<Money, AST.TermLiteral> = {
  test: (value): value is Money => value instanceof Money,
  format: (value, factory) => factory.literal(String(value.amount)),
};
const entity: Formatter<Entity, AST.TermIri> = {
  test: (value): value is Entity => value instanceof Entity,
  format: (value, factory) => factory.iri(`https://example.com/${value.id}`),
};

expectTypeOf<FormatInput<{ literal: [typeof money] }, 'literal'>>().toEqualTypeOf<Money>();
expectTypeOf<FormatInput<{ iri: [typeof entity] }, 'literal'>>().toEqualTypeOf<never>();

// A database's formats widen its own term inputs, and only the configured kind.
const db = SparqlDatabase.create({ formats: { literal: [money], iri: [entity] } });
expectTypeOf(db.literal).parameter(0).toEqualTypeOf<TermLiteralInput | Money>();
expectTypeOf(db.iri).toBeCallableWith(new Entity('a'));
expectTypeOf(db.literal(new Money(1))).toEqualTypeOf<AST.TermLiteral>();
expectTypeOf(db.iri(new Entity('a'))).toEqualTypeOf<AST.TermIri>();

const plain = SparqlDatabase.create();
expectTypeOf(plain.literal).parameter(0).toEqualTypeOf<TermLiteralInput>();
// @ts-expect-error Formats only widen the database that declares them.
plain.literal(new Money(1));
const literalOnly = SparqlDatabase.create({ formats: { literal: [money] } });
// @ts-expect-error Configuring literals does not widen IRI inputs.
literalOnly.iri(new Entity('a'));
