import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { SparqlDatabase as ArqDatabase, lateral, letBinding } from '../src/arq/index.js';
import {
  as,
  bind,
  castNumber,
  count,
  type DefaultQueryReturnType,
  filter,
  graph,
  group,
  optional,
  SparkqlError,
  SparqlDatabase,
  type SparqlSession,
  sparql,
  transformNumber,
  triples,
  union,
} from '../src/index.js';
import { SparqlDatabase as StardogDatabase } from '../src/stardog/index.js';

const parser = new Parser();
const ex = (name: string) => new URL(`http://example.org/${name}`);

/** Every literal value in a parsed AST, in document order. */
function literals(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(literals);
  if (typeof node !== 'object' || node === null) return [];
  const record = node as Record<string, unknown>;
  const own = record.type === 'term' && record.subType === 'literal' ? [String(record.value)] : [];
  return [
    ...own,
    ...Object.entries(record)
      .filter(([key]) => key !== 'loc')
      .flatMap(([, value]) => literals(value)),
  ];
}

type Database = ReturnType<typeof SparqlDatabase.create>;
// Each entry point generates with its own dialect; the shared API is the same.
const databases: [string, Database][] = [
  ['standard', SparqlDatabase.create()],
  ['ARQ', ArqDatabase.create() as unknown as Database],
  ['Stardog', StardogDatabase.create() as unknown as Database],
];

describe('raw sparql template tag', () => {
  describe.each(databases)('%s database', (_name, db) => {
    const doc = db.variable('doc');
    const score = db.variable('score');
    const o = db.variable('o');
    const fn = sparql<number>`<http://example.org/fn#score>(${doc}, ${'query text'})`;

    test('raw expressions work in projection, FILTER, BIND, ORDER BY and GROUP BY', () => {
      const text = db
        .select({ score: as(fn, score), doc })
        .where(
          triples(doc, ex('p'), o),
          filter(sparql`STRLEN(${o}) > ${3}`),
          bind(sparql`LCASE(${o})`, db.variable('lower'))
        )
        .orderBy(sparql`${o} + 1`)
        .toSPARQL();
      const grouped = db
        .select({ n: as(count(doc), db.variable('n')) })
        .where(triples(doc, ex('p'), o))
        .groupBy(sparql`STR(${doc})`)
        .toSPARQL();

      expect(text).toContain('<http://example.org/fn#score>(?doc, "query text")');
      expect(text).toMatch(/FILTER \( \( STRLEN\(\?o\) > "3"\^\^/);
      expect(text).toContain('BIND( ( LCASE(?o) ) AS ?lower )');
      expect(text).toContain('ORDER BY ASC ( ( ?o + 1 ) )');
      expect(grouped).toContain('GROUP BY ( STR(?doc) )');
      expect(() => parser.parse(text)).not.toThrow();
      expect(() => parser.parse(grouped)).not.toThrow();
    });

    test('raw patterns work at top level and inside OPTIONAL, UNION and GRAPH', () => {
      const text = db
        .select()
        .where(
          sparql.pattern`?doc <http://example.org/p> ${o}`,
          triples(doc, ex('q'), o),
          optional(sparql.pattern`${doc} <http://example.org/r> ?r .`),
          union(
            group(sparql.pattern`?doc a <http://example.org/A>`),
            group(triples(doc, ex('b'), o))
          ),
          graph(
            ex('g'),
            sparql.pattern`FILTER NOT EXISTS { ${doc} <http://example.org/hidden> true }`
          )
        )
        .toSPARQL();

      // A dot separates the open raw triple from the builder triple that follows.
      expect(text).toContain('?doc <http://example.org/p> ?o .');
      expect(text).toContain('?doc <http://example.org/q> ?o .');
      expect(text).toContain('OPTIONAL {\n    ?doc <http://example.org/r> ?r .\n  }');
      expect(text).toContain('?doc a <http://example.org/A> .');
      expect(text).toContain('FILTER NOT EXISTS { ?doc <http://example.org/hidden> true }');
      expect(text).not.toContain('true } .');
      expect(() => parser.parse(text)).not.toThrow();
    });
  });

  test('ARQ dialect patterns compose with raw patterns and expressions in both directions', () => {
    const db = ArqDatabase.create();
    const value = db.variable('value');
    const text = db
      .select({ value })
      .where(
        lateral(sparql.pattern`?s ?p ?value`),
        sparql.pattern`OPTIONAL { ${letBinding(sparql`${value} * 2`, db.variable('twice'))} }`
      )
      .toSPARQL();
    expect(text).toContain('  LATERAL {\n    ?s ?p ?value .\n  }');
    expect(text).toContain('OPTIONAL { LET (?twice := ( ?value * 2 ) ) }');
  });

  test.each([
    ['quotes', 'say "hi" and \'bye\''],
    ['newlines', 'line one\nline two\r\n'],
    ['braces', '} } INSERT DATA { <http://x> <http://y> <http://z> } #'],
    ['backslashes', 'C:\\path\\"'],
  ])('interpolated strings with %s are escaped literals, never SPARQL text', (_name, value) => {
    const db = SparqlDatabase.create();
    const o = db.variable('o');
    const text = db
      .select()
      .where(
        sparql.pattern`?s ?p ${value}`,
        filter(sparql`CONTAINS(${o}, ${value})`),
        filter(sparql`${sparql`${o} = ${value}`} || ?flag`)
      )
      .toSPARQL();
    expect(literals(parser.parse(text))).toEqual([value, value, value]);
  });

  test('interpolated IRIs, prefixed names, language tags and blank labels cannot inject SPARQL', () => {
    const db = SparqlDatabase.create().prefix({ ex: 'http://example.org/' });
    const s = db.variable('s');
    const attack = '> . } INSERT DATA { <http://evil.org/s> <http://evil.org/p> 1 } #';
    const iriText = db
      .select()
      .where(sparql.pattern`${s} ${s} ${db.iri(`http://example.org/a${attack}`)} .`)
      .toSPARQL();
    expect(iriText).not.toContain('INSERT DATA {');
    expect(parser.parse(iriText)).toMatchObject({ type: 'query' });

    const prefixedText = db
      .select()
      .where(sparql.pattern`${s} ${s} ${db.iri(`a${attack}`, 'ex')} .`)
      .toSPARQL();
    expect(prefixedText).not.toContain('INSERT DATA {');
    expect(parser.parse(prefixedText)).toMatchObject({ type: 'query' });

    expect(() =>
      db
        .select()
        .where(sparql.pattern`${s} ${s} ${db.literal('x', `en ${attack}`)} .`)
        .toSPARQL()
    ).toThrow('language tag');
    expect(() =>
      db
        .select()
        .where(sparql.pattern`${s} ${s} ${db.blank(`b ${attack}`)} .`)
        .toSPARQL()
    ).toThrow('blank node');
  });

  test('only sparql.raw() and template text are emitted verbatim', () => {
    const db = SparqlDatabase.create();
    const text = db
      .select({ x: as(sparql.raw('<http://example.org/fn#now>()'), db.variable('x')) })
      .where()
      .toSPARQL();
    expect(text).toContain('( <http://example.org/fn#now>() ) AS ?x');
    // A plain call cannot splice a string: the tag requires a template.
    expect(() => (sparql as unknown as (text: string) => unknown)('?x')).toThrow(SparkqlError);
    expect(() => sparql.raw(42 as unknown as string)).toThrow(SparkqlError);
  });

  test('values normalize through builder paths and the database term formats', () => {
    class Tag {
      constructor(readonly name: string) {}
    }
    const db = SparqlDatabase.create({
      formats: {
        iri: [
          {
            test: (value): value is Tag => value instanceof Tag,
            format: (value, factory) => factory.iri(`http://example.org/tag/${value.name}`),
          },
        ],
      },
    }).prefix({ ex: 'http://example.org/' });
    const s = db.variable('s');
    const text = db
      .select()
      .where(
        sparql.pattern`${s} ex:tag ${new Tag('rdf') as never} ; ex:on ${new Date('2024-01-02T00:00:00Z')} ; ex:n ${count(s)} .`,
        sparql.pattern`${s} ex:blank ${db.blank('b1')} ; ex:url ${ex('u')} ; ex:lang ${db.literal('chat', 'fr')} .`
      )
      .toSPARQL();
    expect(text).toContain('<http://example.org/tag/rdf>');
    expect(text).toContain(
      '"2024-01-02T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>'
    );
    expect(text).toContain('COUNT( ?s )');
    expect(text).toContain('_:b1');
    expect(text).toContain('<http://example.org/u>');
    expect(text).toContain('"chat"@fr');
  });

  test('nested templates inline, join builds lists, and builder patterns interpolate', () => {
    const db = SparqlDatabase.create();
    const s = db.variable('s');
    const list = sparql.join([1, 'a', ex('z')], sparql`, `);
    const text = db
      .ask()
      .where(
        sparql.pattern`${triples(s, ex('p'), db.variable('o'))} FILTER(${s} IN (${list}))`,
        filter(sparql`EXISTS ${group(triples(s, ex('q'), 1))}`)
      )
      .toSPARQL();
    expect(text).toContain('?s <http://example.org/p> ?o .');
    expect(text).toMatch(/FILTER\(\?s IN \( "1"\^\^<[^>]+>, "a", <http:\/\/example.org\/z>\)\)/);
    expect(text).toMatch(/FILTER \( \( EXISTS \{\s+\?s <http:\/\/example.org\/q> "1"/);
    expect(sparql.join([]).strings).toEqual(['']);
    expect(() => parser.parse(text)).not.toThrow();
  });

  test('arrays, nullish and unknown values are rejected instead of guessed', () => {
    const db = SparqlDatabase.create();
    expect(() => sparql`${[1, 2] as never}`).toThrow(/sparql\.join/);
    expect(() => sparql`${undefined as never}`).toThrow(SparkqlError);
    expect(() =>
      db
        .select()
        .where(sparql.pattern`?s ?p ${{ type: 'other' } as never}`)
        .toSPARQL()
    ).toThrow(SparkqlError);
  });

  test('getSPARQL keeps raw nodes with normalized values', () => {
    const db = SparqlDatabase.create();
    const ast = db.select().where(sparql.pattern`?s ?p ${'x'}`).getSPARQL();
    expect(ast.where.patterns[0]).toMatchObject({
      type: 'pattern',
      subType: 'raw',
      strings: ['?s ?p ', ''],
      values: [{ type: 'term', subType: 'literal', value: 'x' }],
    });
  });

  test('placeholders inside raw nodes are bound when a prepared query executes', () => {
    const db = SparqlDatabase.create();
    const query = sparql.placeholder<'query', string>('query');
    const prepared = db
      .select()
      .where(sparql.pattern`?doc <http://example.org/text> ?t FILTER(CONTAINS(?t, ${query}))`)
      .prepare();
    const text = prepared.toSPARQL({ query: '") } DROP ALL #' });
    expect(literals(parser.parse(text))).toEqual(['") } DROP ALL #']);
    expect(() => db.select().where(sparql.pattern`${query}`).toSPARQL()).toThrow(
      /must be prepared/
    );
  });

  test('selected results use the declared type and mapWith transforms', async () => {
    const rdf = new DataFactory();
    const session: SparqlSession = {
      bindings: vi.fn(async () => [
        { a: rdf.literal('4'), b: rdf.literal('5'), c: rdf.literal('6') },
      ]),
      boolean: vi.fn(async () => true),
      quads: vi.fn(async () => []),
      update: vi.fn(async () => {}),
      raw: vi.fn(async () => new Response()),
    };
    const db = SparqlDatabase.create({ session });
    const untyped = sparql`STRLEN(?x)`;
    const declared = sparql<number>`STRLEN(?x)`;
    const mapped = declared.mapWith(term => `#${term.value}`);
    const query = db
      .select({
        a: as(untyped, db.variable('a')),
        b: as(declared.mapWith(transformNumber), db.variable('b')),
        c: as(mapped, db.variable('c')),
      })
      .where();

    expectTypeOf(untyped).toMatchTypeOf<{
      transform?: (term: DefaultQueryReturnType) => DefaultQueryReturnType;
    }>();
    expectTypeOf(as(declared, db.variable('d'))).toMatchTypeOf<ReturnType<typeof as<number>>>();
    expectTypeOf(db.select({ d: as(declared, db.variable('d')) }).where()).resolves.toEqualTypeOf<
      { d: number }[]
    >();
    expectTypeOf(query).resolves.toEqualTypeOf<
      { a: DefaultQueryReturnType; b: number; c: string }[]
    >();
    expectTypeOf(
      db.select({ e: castNumber(as(untyped, db.variable('e'))) }).where()
    ).resolves.toEqualTypeOf<{ e: number }[]>();

    const [row] = await query;
    expect(row.a).toEqual(rdf.literal('4'));
    expect(row.b).toBe(5);
    expect(row.c).toBe('#6');
    // mapWith returns a new expression and leaves the original untouched.
    expect(declared.transform).toBeUndefined();
    expect(Object.keys(mapped)).not.toContain('mapWith');
  });
});
