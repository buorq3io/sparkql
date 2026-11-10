import { Generator } from '@traqula/generator-sparql-1-1';
import { Parser } from '@traqula/parser-sparql-1-1';
import type * as AST from '@traqula/rules-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import {
  castString,
  eq,
  filter,
  group,
  optional,
  SparkqlQueryError,
  SparqlDatabase,
  type SparqlSession,
  sparql,
  sparql11Dialect,
  triples,
} from '../src/index.js';

const rdf = new DataFactory();
function fixture() {
  const session: SparqlSession = {
    bindings: vi.fn(async () => [{ name: rdf.literal('decoded') }]),
    boolean: vi.fn(async () => true),
    quads: vi.fn(async () => []),
    update: vi.fn(async () => {}),
    raw: vi.fn(async () => new Response()),
  };
  const generate = vi.fn(new Generator().generate.bind(new Generator()));
  const db = SparqlDatabase.create({
    session,
    dialect: { ...sparql11Dialect, generator: { generate } },
  });
  const s = db.variable('s');
  const p = db.iri('https://example.com/p');
  const value = sparql.placeholder<'value', string>('value');
  return { db, session, generate, s, p, value };
}

describe('prepared queries', () => {
  test('prepares SELECT once, decodes results, and binds safe values on every execution', async () => {
    const { db, session, generate, s, p, value } = fixture();
    const name = castString(db.variable('name'));
    const query = db.select({ name }).where(triples(s, p, value));
    const normalize = vi.spyOn(
      query as never as { normalizeConfig: (value: unknown) => unknown },
      'normalizeConfig'
    );
    const prepared = query.prepare();
    expect(await prepared.execute({ value: 'Ada' })).toEqual([{ name: 'decoded' }]);
    const malicious = '" . } INSERT DATA { <x> <y> <z> } #\n\\';
    await prepared.execute({ value: malicious });
    await prepared.execute({ value: 'Alan' });
    expectTypeOf(prepared.execute).returns.toEqualTypeOf<Promise<{ name: string }[]>>();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(normalize).toHaveBeenCalledTimes(1);
    expect(session.bindings).toHaveBeenCalledTimes(3);
    const text = prepared.toSPARQL({ value: malicious });
    expect(text).toContain('\\"');
    expect(text).toContain('\\n');
    const ast = new Parser().parse(text) as AST.QuerySelect;
    const triple = (ast.where.patterns[0] as AST.PatternBgp).triples[0] as AST.TripleNesting;
    expect((triple.object as AST.TermLiteral).value).toBe(malicious);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('supports ASK, CONSTRUCT, UPDATE and WITH with different values', async () => {
    const { db, session, generate, s, p, value } = fixture();
    const pattern = triples(s, p, value);
    const forms = [
      db.ask().where(pattern).prepare(),
      db
        .construct(triples(s, p, db.variable('o')))
        .where(pattern)
        .prepare(),
      db.insertData(triples(db.iri('https://example.com/s'), p, value)).prepare(),
      db.with(db.iri('https://example.com/g')).insert(pattern).where(pattern).prepare(),
    ];
    for (const prepared of forms) {
      await prepared.execute({ value: 'one' });
      await prepared.execute({ value: 'two' });
    }
    expect(generate).toHaveBeenCalledTimes(4);
    for (const method of ['boolean', 'quads', 'update'] as const) {
      expect(session[method]).toHaveBeenCalled();
    }
    const updates = vi.mocked(session.update).mock.calls.map(([text]) => text);
    expect(updates[2]).toContain('WITH');
    expect(updates[2]).toContain('"one"');
    expect(updates[3]).toContain('"two"');
  });

  test('formats URLs, escaped IRIs, custom values and typed/language literals', () => {
    class Money {
      constructor(readonly amount: number) {}
    }
    const db = SparqlDatabase.create({
      formats: {
        literal: [
          {
            test: (value): value is Money => value instanceof Money,
            format: (value, factory) => factory.literal(`USD ${value.amount}`),
          },
        ],
      },
    }).prefix({ ex: 'https://example.com/' });
    const s = db.variable('s');
    const p = db.iri('https://example.com/p');
    const prepared = db
      .ask()
      .where(triples(s, p, sparql.placeholder('value')))
      .prepare();
    expect(prepared.toSPARQL({ value: new Money(42) })).toContain('"USD 42"');
    expect(prepared.toSPARQL({ value: new URL('https://example.com/>') })).toContain(
      '<https://example.com/%3E>'
    );
    const iri = db.iri('https://example.com/>\\"\n');
    const text = prepared.toSPARQL({ value: iri });
    expect(text).toContain('<https://example.com/%3E%5C%22%0A>');
    expect(() => new Parser().parse(text)).not.toThrow();
    expect(prepared.toSPARQL({ value: db.literal('bonjour', 'fr') })).toContain('"bonjour"@fr');
    expect(prepared.toSPARQL({ value: db.literal(42) })).toContain('XMLSchema#integer>');
    expect(prepared.toSPARQL({ value: db.blank('123.é') })).toContain('_:123.é');
    expect(() => prepared.toSPARQL({ value: db.blank('x . } #') })).toThrow('blank node');
    expect(prepared.toSPARQL({ value: db.iri('item', 'ex') })).toContain(
      '<https://example.com/item>'
    );
  });

  test('requires own values, ignores extra values, and never sends incomplete queries', async () => {
    const { db, session, s, p, value } = fixture();
    const prepared = db
      .ask()
      .where(triples(s, p, value))
      .prepare();
    await expect(prepared.execute({} as { value: string })).rejects.toThrow(
      'No value for placeholder "value"'
    );
    expect(() => prepared.toSPARQL(Object.create({ value: 'inherited' }))).toThrow('No value');
    const extra = { value: 'Ada', extra: 42 };
    expect(prepared.toSPARQL(extra)).toContain('"Ada"');
    expect(session.boolean).not.toHaveBeenCalled();
    expect(() =>
      db
        .ask()
        .where(triples(s, p, value))
        .toSPARQL()
    ).toThrow('must be prepared');
    // biome-ignore lint/correctness/noConstantCondition: Compile-time assertions must never execute.
    if (false) {
      // @ts-expect-error Required names are checked.
      prepared.execute();
      // @ts-expect-error Required names are checked.
      prepared.execute({});
      // @ts-expect-error Placeholder value types are checked.
      prepared.execute({ value: 42 });
      // @ts-expect-error Extra names on fresh object literals are checked.
      prepared.execute({ value: 'Ada', extra: true });
    }
  });

  test('binds LIMIT and OFFSET as non-negative integers and preserves required names', async () => {
    const { db, session, s, p, value } = fixture();
    const prepared = db
      .select()
      .where(triples(s, p, value))
      .limit(sparql.placeholder<'limit', number>('limit'))
      .offset(sparql.placeholder<'offset', number>('offset'))
      .prepare();
    expect(prepared.toSPARQL({ value: 'Ada', limit: 5, offset: 0 })).toMatch(/LIMIT 5\s+OFFSET 0/);
    for (const limit of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(prepared.execute({ value: 'Ada', limit, offset: 0 })).rejects.toThrow(
        'non-negative safe integer'
      );
    }
    expect(session.bindings).not.toHaveBeenCalled();
    // biome-ignore lint/correctness/noConstantCondition: Compile-time assertions must never execute.
    if (false) {
      // @ts-expect-error All placeholder names survive fluent chaining.
      prepared.execute({ limit: 5, offset: 0 });
      // @ts-expect-error LIMIT must be a number.
      prepared.execute({ value: 'Ada', limit: '5', offset: 0 });
    }
  });
  test('keeps names through nested patterns, expressions, VALUES and dynamic builders', () => {
    const { db, s, p, value } = fixture();
    const prepared = db
      .ask()
      .where(
        group(
          optional(triples(s, p, value)),
          filter(eq(s, sparql.placeholder<'other', string>('other')))
        )
      )
      .$dynamic()
      .values({ s: [sparql.placeholder<'row', number>('row')] })
      .prepare();
    expect(prepared.toSPARQL({ value: 'Ada', other: 'Alan', row: 42 })).toContain('"Ada"');
    // biome-ignore lint/correctness/noConstantCondition: Compile-time assertions must never execute.
    if (false) {
      // @ts-expect-error Nested expressions retain required names.
      prepared.execute({ value: 'Ada', row: 42 });
      // @ts-expect-error VALUES retain required names.
      prepared.execute({ value: 'Ada', other: 'Alan' });
      // @ts-expect-error Nested triples retain required names.
      prepared.execute({ other: 'Alan', row: 42 });
      const update = db.insertData(triples(db.iri('https://example.com/s'), p, value)).prepare();
      // @ts-expect-error UPDATE retains required names.
      update.execute({});
    }
  });

  test('matches fresh AST generation and snapshots mutable builders at preparation time', () => {
    const { db, s, p, value } = fixture();
    const builder = db
      .ask()
      .where(triples(s, p, value))
      .$dynamic();
    const prepared = builder.prepare();
    for (const value of ['Ada', '"\\\\\n', 'urn:sparkql:placeholder:user-text']) {
      expect(prepared.toSPARQL({ value })).toBe(
        db
          .ask()
          .where(triples(s, p, value))
          .toSPARQL()
      );
    }
    builder.where(triples(s, p, 'later'));
    expect(prepared.toSPARQL({ value: 'Ada' })).not.toContain('later');
    expect(builder.prepare().toSPARQL({ value: 'Ada' })).toContain('later');
    expect(db.ask().where().prepare().toSPARQL()).toBe(db.ask().where().toSPARQL());
  });

  test('uses the existing logger and wraps errors with the filled query', async () => {
    const { session } = fixture();
    const logQuery = vi.fn();
    const failure = new Error('offline');
    vi.mocked(session.boolean).mockRejectedValue(failure);
    const db = SparqlDatabase.create({ session, logger: { logQuery } });
    const prepared = db
      .ask()
      .where(
        triples(
          db.variable('s'),
          db.iri('https://example.com/p'),
          sparql.placeholder<'name', string>('name')
        )
      )
      .prepare();
    const text = prepared.toSPARQL({ name: 'Ada' });
    const error = await prepared.execute({ name: 'Ada' }).catch(error => error);
    expect(error).toBeInstanceOf(SparkqlQueryError);
    expect(error.query).toBe(text);
    expect(error.cause).toBe(failure);
    expect(logQuery).toHaveBeenCalledWith(text, expect.objectContaining({ operation: 'ask' }));
    await expect(SparqlDatabase.create().ask().where().prepare().execute()).rejects.toThrow(
      'build-only'
    );
  });

  test('formats repeated names once per execution and rejects marker collisions', async () => {
    const format = vi.fn((value: string, factory: import('../src/index.js').FactoryFunctions) =>
      factory.literal(value)
    );
    const db = SparqlDatabase.create({
      formats: {
        literal: [{ test: (value): value is string => typeof value === 'string', format }],
      },
    });
    const value = sparql.placeholder<'name', string>('name');
    const prepared = db
      .ask()
      .where(
        triples(db.variable('s'), db.iri('https://example.com/p'), value),
        triples(db.variable('s'), db.iri('https://example.com/q'), value)
      )
      .prepare();
    expect(prepared.toSPARQL({ name: 'Ada' }).match(/"Ada"/g)).toHaveLength(2);
    expect(format).toHaveBeenCalledTimes(1);
    prepared.toSPARQL({ name: 'Alan' });
    expect(format).toHaveBeenCalledTimes(2);
    const generator = new Generator();
    const broken = SparqlDatabase.create({
      dialect: {
        ...sparql11Dialect,
        generator: { generate: ast => generator.generate(ast) + generator.generate(ast) },
      },
    });
    expect(() =>
      broken
        .ask()
        .where(triples(broken.variable('s'), broken.iri('https://example.com/p'), value))
        .prepare()
    ).toThrow('unique placeholder marker');
  });
});
