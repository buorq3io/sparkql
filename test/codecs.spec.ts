import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../src/arq/index.js';
import {
  as,
  bound,
  castString,
  castWith,
  defaultCodecs,
  type LangString,
  refineCodecs,
  SparkqlQueryError,
  type SparqlBindings,
  SparqlDatabase,
  type SparqlSession,
  sparql,
  type TermCodecs,
  triples,
  xsd,
} from '../src/index.js';
import { SparqlDatabase as StardogDatabase } from '../src/stardog/index.js';

const rdf = new DataFactory();
const ex = (name: string) => `https://example.org/${name}`;
const typed = (value: string, datatype: string) => rdf.literal(value, rdf.namedNode(datatype));

/** Answers every SELECT with the given rows. */
function session(rows: SparqlBindings[]): SparqlSession {
  return {
    bindings: async () => rows,
    boolean: async () => true,
    quads: async () => [],
    update: async () => {},
    raw: async () => new Response('{}'),
  };
}

const row: SparqlBindings = {
  count: typed('42', xsd.integer),
  int: typed('7', `http://www.w3.org/2001/XMLSchema#int`),
  price: typed('3.50', xsd.decimal),
  ratio: typed('INF', xsd.double),
  ok: typed('1', xsd.boolean),
  day: typed('2020-01-02Z', xsd.date),
  at: typed('2020-01-02T03:04:05', xsd.dateTime),
  label: rdf.literal('chat', 'fr'),
  name: rdf.literal('Ada'),
  page: rdf.namedNode(ex('ada')),
  node: rdf.blankNode('b0'),
  other: typed('POINT(1 2)', 'http://www.opengis.net/ont/geosparql#wktLiteral'),
};

function selectAll<D extends { createManagers: SparqlDatabase<{}>['createManagers'] }>(db: D) {
  const [v] = db.createManagers([], {});
  const keys = [...Object.keys(row), 'missing'];
  return { v, variables: Object.fromEntries(keys.map(key => [key, v[key]])) };
}

describe('datatype codecs', () => {
  test('decode SELECT results by datatype', async () => {
    const db = SparqlDatabase.create({
      session: session([row]),
      codecs: {
        ...defaultCodecs({ integer: 'number', decimal: 'number' }),
        iri: { decode: term => new URL(term.value) },
      },
    });
    const { variables } = selectAll(db);
    const [result] = await db.select(variables);
    expect(result).toEqual({
      count: 42,
      int: 7,
      price: 3.5,
      ratio: Number.POSITIVE_INFINITY,
      ok: true,
      day: new Date('2020-01-02T00:00:00Z'),
      at: new Date('2020-01-02T03:04:05Z'),
      label: { value: 'chat', language: 'fr' },
      name: 'Ada',
      page: new URL(ex('ada')),
      node: row.node,
      other: row.other,
      missing: undefined,
    });
  });

  test('make the number representation an explicit choice', async () => {
    const db = SparqlDatabase.create({
      session: session([row]),
      codecs: defaultCodecs({ integer: 'bigint', decimal: 'string' }),
    });
    const [v] = db.createManagers([], {});
    const [result] = await db.select({ count: v.count, int: v.int, price: v.price });
    expect(result).toEqual({ count: 42n, int: 7n, price: '3.50' });
    expect(defaultCodecs({ integer: 'bigint', decimal: 'string' })[xsd.integer].decode).toBeTypeOf(
      'function'
    );
    expectTypeOf(
      defaultCodecs({ integer: 'bigint', decimal: 'string' })[xsd.integer]
    ).toEqualTypeOf<import('../src/index.js').TermCodec<bigint>>();
  });

  test('an explicit transform wins over the codec table', async () => {
    const codecs = defaultCodecs({ integer: 'number', decimal: 'number' });
    const db = SparqlDatabase.create({ session: session([row]), codecs });
    const [v] = db.createManagers([], {});
    const [result] = await db
      .select({ count: castString(v.count), at: castWith(codecs[xsd.dateTime], v.at), has: v.has })
      .where(as(bound(v.name), v.has));
    // `has` is unbound in the fixture; its transform still runs and gets undefined.
    expect(result).toMatchObject({ count: '42', at: new Date('2020-01-02T03:04:05Z') });
    expectTypeOf(result.count).toEqualTypeOf<string>();
    expectTypeOf(result.at).toEqualTypeOf<Date>();
  });

  test('without codecs, results stay RDF/JS terms', async () => {
    const db = SparqlDatabase.create({ session: session([row]) });
    const { variables } = selectAll(db);
    const [result] = await db.select(variables);
    expect(result).toEqual({ ...row, missing: undefined });
  });

  test('survive base() and prefix(), and work in ARQ and Stardog databases', async () => {
    const codecs = defaultCodecs({ integer: 'number', decimal: 'number' });
    // The three database types are not one callable union; the checks below are runtime ones.
    const databases: SparqlDatabase<{}, 'g_', any, any>[] = [
      SparqlDatabase.create({ session: session([row]), codecs })
        .base(ex(''))
        .prefix({ ex: ex('') }),
      ArqDatabase.create({ session: session([row]), codecs }).prefix({ ex: ex('') }),
      StardogDatabase.create({ session: session([row]), codecs }).base(ex('')),
    ];
    for (const db of databases) {
      const [v] = db.createManagers([], {});
      expect(await db.select({ count: v.count, label: v.label })).toEqual([
        { count: 42, label: { value: 'chat', language: 'fr' } },
      ]);
      // Encoders survive too.
      expect(
        db
          .ask()
          .where(triples(v.s, v.p, db.literal({ value: 'chat', language: 'fr' })))
          .toSPARQL()
      ).toContain('"chat"@fr');
    }
  });

  test('encoders extend literal input, after custom formats', () => {
    class Celsius {
      constructor(readonly degrees: number) {}
    }
    const celsius = 'https://example.org/celsius';
    const db = SparqlDatabase.create({
      codecs: {
        [celsius]: {
          decode: term => new Celsius(Number(term.value)),
          encode: {
            test: (value): value is Celsius => value instanceof Celsius,
            format: (value, factory) =>
              factory.literal(String(value.degrees), factory.iri(celsius)),
          },
        },
      },
    });
    const [v] = db.createManagers([], {});
    expect(
      db
        .ask()
        .where(triples(v.s, v.p, db.literal(new Celsius(21))))
        .toSPARQL()
    ).toContain(`"21"^^<${celsius}>`);
    expectTypeOf(db.literal).parameter(0).toExtend<Celsius | string>();
    // @ts-expect-error: codecs only widen the database that declares them.
    const _other = () => SparqlDatabase.create().literal(new Celsius(21));
  });

  test('refineCodecs overrides per hook and removes keys set to undefined', async () => {
    const codecs = refineCodecs(defaultCodecs({ integer: 'number', decimal: 'number' }), {
      [xsd.string]: undefined,
      [xsd.integer]: { decode: term => `#${term.value}` },
    });
    expect(xsd.string in codecs).toBe(false);
    expect(codecs[xsd.langString].encode).toBeDefined();
    const db = SparqlDatabase.create({ session: session([row]), codecs });
    const [v] = db.createManagers([], {});
    expect(await db.select({ count: v.count, name: v.name })).toEqual([
      { count: '#42', name: row.name },
    ]);
  });

  test('a failing decoder rejects with SparkqlQueryError; pseudo-keys cannot encode', async () => {
    const db = SparqlDatabase.create({
      session: session([row]),
      codecs: {
        [xsd.integer]: {
          decode: () => {
            throw new RangeError('bad integer');
          },
        },
      },
    });
    const [v] = db.createManagers([], {});
    await expect(db.select({ count: v.count })).rejects.toBeInstanceOf(SparkqlQueryError);

    const iriEncoder: TermCodecs = {
      iri: { encode: { test: (_): _ is never => false, format: (_, f) => f.literal('') } },
    };
    expect(() => SparqlDatabase.create({ codecs: iriEncoder })).toThrow(/formats\.iri/);
  });

  test('decode dates at their timezone and lexical forms of booleans and doubles', async () => {
    const rows = [
      {
        d: typed('2020-01-02+02:00', xsd.date),
        b: typed('false', xsd.boolean),
        n: typed('-INF', xsd.double),
      },
      { d: typed('2020-01-02', xsd.date), b: typed('0', xsd.boolean), n: typed('NaN', xsd.float) },
    ];
    const db = SparqlDatabase.create({
      session: session(rows),
      codecs: defaultCodecs({ integer: 'number', decimal: 'number' }),
    });
    const [v] = db.createManagers([], {});
    const result = await db.select({ d: v.d, b: v.b, n: v.n });
    expect(result).toEqual([
      { d: new Date('2020-01-01T22:00:00Z'), b: false, n: Number.NEGATIVE_INFINITY },
      { d: new Date('2020-01-02T00:00:00Z'), b: false, n: Number.NaN },
    ]);
    expectTypeOf<LangString>().toEqualTypeOf<{ value: string; language: string }>();
  });

  test('raw sparql expressions decode by codec unless they map their own values', async () => {
    class Celsius {
      constructor(readonly degrees: number) {}
    }
    const celsius = 'https://example.org/celsius';
    const db = SparqlDatabase.create({
      session: session([row]),
      codecs: {
        ...defaultCodecs({ integer: 'number', decimal: 'number' }),
        [celsius]: {
          encode: {
            test: (value): value is Celsius => value instanceof Celsius,
            format: (value, factory) =>
              factory.literal(String(value.degrees), factory.iri(celsius)),
          },
        },
      },
    });
    const [v] = db.createManagers([], {});
    const [result] = await db.select({
      count: as(sparql<number>`STRLEN(${v.name})`, v.count),
      label: as(
        sparql`LANG(${v.name})`.mapWith(term => `#${term.value}`),
        v.label
      ),
    });
    expect(result).toEqual({ count: 42, label: '#chat' });
    expectTypeOf(result.count).toEqualTypeOf<number>();
    // Interpolated values go through the database's formats, codec encoders included.
    const value = new Celsius(21) as unknown as string;
    expect(db.ask().where(sparql.pattern`?s ?p ${value}`).toSPARQL()).toContain(
      `"21"^^<${celsius}>`
    );
  });
});
