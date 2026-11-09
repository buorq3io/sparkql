import { describe, expect, expectTypeOf, test } from 'vitest';
import type * as AST from '@traqula/rules-sparql-1-1';
import { SparqlDatabase, triples } from '#src/index.js';
import type { Formatter } from '#src/index.js';

class Money {
  constructor(readonly amount: number) {}
}
class Entity {
  constructor(readonly id: string) {}
}
class Anonymous {
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
const anonymous: Formatter<Anonymous, AST.TermBlank> = {
  test: (value): value is Anonymous => value instanceof Anonymous,
  format: (value, factory) => factory.blank(value.id),
};

const configured = () =>
  SparqlDatabase.create({
    formats: { literal: [money], iri: [entity], blank: [anonymous] },
  });

describe('database input formats', () => {
  test('infers custom inputs and produces standard terms for queries and updates', () => {
    const db = configured();
    const subject = db.iri(new Entity('alice'));
    const predicate = db.iri('https://example.com/balance');
    const value = db.literal(new Money(42));
    const blank = db.blank(new Anonymous('account'));
    expectTypeOf(subject).toEqualTypeOf<AST.TermIri>();
    expectTypeOf(value).toEqualTypeOf<AST.TermLiteral>();
    expectTypeOf(blank).toEqualTypeOf<AST.TermBlank>();

    const pattern = triples(subject, predicate, value);
    expect(db.ask().where(pattern).toSPARQL()).toContain('"42"');
    expect(db.insertData(pattern).toSPARQL()).toContain('https://example.com/alice');
    expect(db.ask().where(triples(blank, predicate, value)).toSPARQL()).toContain('_:account');
  });

  test('custom inputs and runtime behavior stay local to an instance', () => {
    const db = SparqlDatabase.create();
    const local = configured();
    expect(local.literal(new Money(42)).value).toBe('42');
    expect(() => {
      // @ts-expect-error Money is accepted only by the configured database.
      db.literal(new Money(42));
    }).toThrow('Unsupported literal term');
    expect(() => {
      // @ts-expect-error Entity is accepted only by the configured database.
      db.iri(new Entity('alice'));
    }).toThrow('Unsupported iri term');
    expect(() => {
      // @ts-expect-error Anonymous is accepted only by the configured database.
      db.blank(new Anonymous('account'));
    }).toThrow('Unsupported blank term');
    const literalOnly = SparqlDatabase.create({ formats: { literal: [money] } });
    expect(literalOnly.literal(new Money(1)).value).toBe('1');
    expect(() => {
      // @ts-expect-error Configuring literals must not widen the instance's IRI inputs.
      literalOnly.iri(new Entity('alice'));
    }).toThrow('Unsupported iri term');
  });

  test('instances can format the same input differently', () => {
    const first = configured();
    const second = SparqlDatabase.create({
      formats: {
        literal: [
          {
            ...money,
            format: (value, factory) => factory.literal(`USD ${value.amount}`),
          },
        ],
      },
    });
    expect(first.literal(new Money(1)).value).toBe('1');
    expect(second.literal(new Money(1)).value).toBe('USD 1');
    expect(first.literal(new Money(2)).value).toBe('2');
  });

  test('derived instances preserve the formats and their inferred types', () => {
    const db = configured().base('https://example.com/').prefix({ ex: 'https://example.com/' });
    expect(db.literal(new Money(3)).value).toBe('3');
    expect(db.iri(new Entity('alice')).value).toBe('https://example.com/alice');
    expect(db.blank(new Anonymous('account')).label).toBe(db.blank('account').label);
    expect(
      db
        .ask()
        .where(
          triples(db.iri(new Entity('alice')), db.iri('balance', 'ex'), db.literal(new Money(3)))
        )
        .toSPARQL()
    ).toContain('BASE');
  });

  test('snapshots the supplied formatter lists', () => {
    const literal = [money];
    const db = SparqlDatabase.create({ formats: { literal } });
    literal.length = 0;
    expect(db.literal(new Money(4)).value).toBe('4');
  });

  test('preserves builtin inputs, language tags, datatypes and term identity', () => {
    const db = SparqlDatabase.create();
    expect(db.literal(1)).toMatchObject({
      langOrIri: { value: 'http://www.w3.org/2001/XMLSchema#integer' },
    });
    expect(db.literal(1.5)).toMatchObject({
      langOrIri: { value: 'http://www.w3.org/2001/XMLSchema#decimal' },
    });
    expect(db.literal(1n).value).toBe('1');
    expect(db.literal(true).value).toBe('true');
    expect(db.literal(/alice/i).value).toBe('alice');
    expect(db.literal(new Date('2020-01-01T00:00:00Z')).value).toBe('2020-01-01T00:00:00.000Z');
    expect(db.literal('hello', 'en').langOrIri).toBe('en');
    const datatype = new URL('https://example.com/datatype');
    expect(db.literal('hello', datatype)).toMatchObject({ langOrIri: { value: datatype.href } });
    const iri = db.iri(datatype);
    const literal = db.literal('hello');
    const blank = db.blank([]);
    expect(db.iri(iri)).toBe(iri);
    expect(db.literal(literal)).toBe(literal);
    expect(db.blank(blank)).toBe(blank);
    expect(db.iri('name', 'ex').prefix).toBe('ex');
    expect(db.blank('account').label).toBe(db.blank('account').label);
  });

  test('formatters can call primitive factories without reapplying themselves', () => {
    const db = SparqlDatabase.create({
      formats: {
        literal: [
          {
            test: (value): value is string => typeof value === 'string',
            format: (value, factory) => factory.literal(value.toUpperCase()),
          },
        ],
      },
    });
    expect(db.literal('hello').value).toBe('HELLO');
  });
});
