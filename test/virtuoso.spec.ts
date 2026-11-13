import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../src/arq/index.js';
import { SparqlDatabase as BaseDatabase } from '../src/index.js';
import {
  as,
  bif,
  bifCall,
  define,
  desc,
  eq,
  filter,
  optional,
  SparkqlError,
  SparqlDatabase,
  sqlCall,
  textContains,
  transformNumber,
  transformString,
  transitive,
  triples,
  virtuosoDialect,
} from '../src/virtuoso/index.js';

const rdf = new DataFactory();
const db = SparqlDatabase.create();
const s = db.variable('s');
const p = db.variable('p');
const o = db.variable('o');
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();
const parser = new Parser();
const knows = db.iri('http://xmlns.com/foaf/0.1/knows');

describe('Virtuoso DEFINE pragmas', () => {
  test('print before the prologue, in order', () => {
    const custom = SparqlDatabase.create({
      managerConfig: { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } },
    });
    const query = custom
      .select({ s })
      .where(
        define('input:inference', 'people-rules'),
        triples(s, p, o),
        define('input:same-as', 'yes'),
        define('input:default-graph-uri', new URL('https://example.org/g')),
        define('sql:log-enable', 2)
      )
      .comment('people');
    const text = query.toSPARQL();
    expect(text).toMatch(
      /^#people\nDEFINE input:inference "people-rules"\nDEFINE input:same-as "yes"\nDEFINE input:default-graph-uri <https:\/\/example\.org\/g>\nDEFINE sql:log-enable 2\nPREFIX foaf:/
    );
    expect(compact(text)).toContain('WHERE { ?s ?p ?o . }');
  });

  test('escape string values', () => {
    const text = db.ask().where(define('sql:table-option', 'a"b\\c\nd')).toSPARQL();
    expect(text.split('\n')[0]).toBe('DEFINE sql:table-option "a\\"b\\\\c\\nd"');
  });

  test('work in ASK, CONSTRUCT, DESCRIBE and update WHERE clauses', () => {
    const pragma = define('input:inference', 'rules');
    expect(db.ask().where(pragma).toSPARQL()).toMatch(/^DEFINE input:inference "rules"\nASK/);
    expect(
      db
        .construct(triples(s, p, o))
        .where(pragma, triples(s, p, o))
        .toSPARQL()
    ).toMatch(/^DEFINE .*\nCONSTRUCT/);
    expect(
      db
        .describe(s)
        .where(pragma, triples(s, p, o))
        .toSPARQL()
    ).toMatch(/^DEFINE .*\nDESCRIBE/);
    const update = db
      .with(db.iri('https://example.org/g'))
      .insert(triples(s, p, o))
      .where(define('sql:log-enable', 3), triples(s, p, o))
      .$end()
      .toSPARQL();
    expect(update).toMatch(/^DEFINE sql:log-enable 3\nWITH/);
    expect(update).not.toContain('virtuoso');
  });

  test('are refused anywhere but the outermost WHERE clause', () => {
    const pragma = define('input:inference', 'rules');
    expect(() => db.select().where(optional(pragma)).toSPARQL()).toThrow('outermost WHERE');
    const sub = db
      .select({ s })
      .where(pragma, triples(s, p, o))
      .as();
    expect(() => db.select().where(sub).toSPARQL()).toThrow(SparkqlError);
  });

  test('reject unknown pragmas and invalid values for untyped callers', () => {
    const untyped = define as (name: unknown, value: unknown) => unknown;
    expect(() => untyped('output:format', 'TURTLE')).toThrow('Unsupported Virtuoso pragma');
    expect(() => untyped('toString', 'x')).toThrow('Unsupported Virtuoso pragma');
    expect(() => untyped('get:soft', 'hard')).toThrow('Unsupported value');
    expect(() => untyped('input:inference', 1)).toThrow('Unsupported value');
    expect(() => define('output:maxrows', 1.5)).toThrow('Unsupported value');
    expect(() => define('output:maxrows', -1)).toThrow('Unsupported value');
    // @ts-expect-error Output formats are not supported.
    expect(() => define('output:format', 'JSON')).toThrow();
  });
});

describe('Virtuoso full-text matches', () => {
  test('print bif:contains with an optional score', () => {
    const score = db.variable('rank');
    const query = db
      .select({ s })
      .where(triples(s, p, o), textContains(o, '"New York" AND city', { score }), triples(s, p, o))
      .orderBy(desc(score));
    expect(compact(query.toSPARQL())).toBe(
      'SELECT ?s WHERE { ?s ?p ?o . ?o bif:contains "\\"New York\\" AND city" OPTION (score ?rank) . ?s ?p ?o . } ORDER BY DESC ( ?rank )'
    );
    expect(compact(db.ask().where(textContains(o, 'rich*')).toSPARQL())).toBe(
      'ASK WHERE { ?o bif:contains "rich*" . }'
    );
  });

  test('reject variable names Virtuoso reserves', () => {
    expect(() => textContains(db.variable('Score'), 'ada')).toThrow('rename the text variable');
    expect(() => textContains(o, 'ada', { score: db.variable('offband') })).toThrow(
      'rename the score variable'
    );
    expect(() => textContains(o, 'ada', { score: db.variable('scores') })).not.toThrow();
  });

  test('reject empty queries', () => {
    expect(() => textContains(o, ' ')).toThrow(SparkqlError);
    expect(() => textContains(o, 1 as unknown as string)).toThrow(SparkqlError);
  });
});

describe('Virtuoso transitive subqueries', () => {
  const step = db
    .select({ s, o })
    .where(triples(s, knows, o))
    .as();

  test('print the subquery followed by its options', () => {
    const distance = db.variable('distance');
    const path = db.variable('path');
    const link = db.variable('link');
    const query = db.select({ o, distance }).where(
      transitive(step, {
        in: [s],
        out: [o],
        distinct: true,
        exists: true,
        noCycles: true,
        shortestOnly: true,
        min: 0,
        max: 4,
        direction: 'both',
        stepNumber: distance,
        pathId: path,
        stepValues: [[s, link]],
      }),
      filter(eq(s, db.iri('https://example.org/ada')))
    );
    expect(compact(query.toSPARQL())).toBe(
      compact(`SELECT ?o ?distance WHERE {
        { SELECT ?s ?o WHERE { ?s <http://xmlns.com/foaf/0.1/knows> ?o . } }
        OPTION (TRANSITIVE, t_in (?s), t_out (?o), t_distinct, t_exists, t_no_cycles,
          t_shortest_only, t_min (0), t_max (4), t_direction 3, t_step ('step_no') AS ?distance,
          t_step ('path_id') AS ?path, t_step (?s) AS ?link)
        FILTER ( ( ?s = <https://example.org/ada> ) )
      }`)
    );
    expect(
      compact(
        db
          .select()
          .where(transitive(step, { in: [s], out: [o], cyclesOnly: true }))
          .toSPARQL()
      )
    ).toContain('OPTION (TRANSITIVE, t_in (?s), t_out (?o), t_cycles_only)');
  });

  test('allow Virtuoso patterns inside the subquery', () => {
    const inner = db
      .select({ s, o })
      .where(triples(s, knows, o), textContains(o, 'ada'))
      .as();
    expect(
      compact(
        db
          .select()
          .where(transitive(inner, { in: [s], out: [o] }))
          .toSPARQL()
      )
    ).toContain('?o bif:contains "ada" . } } OPTION');
  });

  test('reject invalid options', () => {
    const t = (options: object) => () =>
      transitive(step, { in: [s], out: [o], ...options } as Parameters<typeof transitive>[1]);
    expect(t({ out: [] })).toThrow('as many variables as `in`');
    expect(t({ in: [], out: [] })).toThrow('at least one variable');
    expect(t({ noCycles: true, cyclesOnly: true })).toThrow('exclude each other');
    expect(t({ min: -1 })).toThrow('non-negative integer');
    expect(t({ max: 1.5 })).toThrow('non-negative integer');
    expect(t({ min: 3, max: 2 })).toThrow('must not exceed');
    expect(t({ direction: 'up' })).toThrow('direction');
    expect(t({ stepValues: [[o, p]] })).toThrow('is not an input');
    expect(t({ stepNumber: 'x' })).toThrow('must be a variable');
  });

  test('reject subqueries that do not project the variables', () => {
    const narrow = db
      .select({ s })
      .where(triples(s, knows, o))
      .as();
    expect(() =>
      db
        .select()
        .where(transitive(narrow, { in: [s], out: [o] }))
        .toSPARQL()
    ).toThrow('does not project ?o');
    const wide = db.select().where(triples(s, knows, o));
    expect(() =>
      db
        .select()
        .where(
          transitive(
            db
              .select()
              .where(triples(s, knows, o))
              .as(),
            { in: [s], out: [o] }
          )
        )
        .toSPARQL()
    ).not.toThrow();
    expect(wide).toBeDefined();
  });
});

describe('Virtuoso dialect registration', () => {
  test('is available with an explicitly configured database', () => {
    const explicit = BaseDatabase.create({ dialect: virtuosoDialect });
    expect(explicit.ask().where(textContains(o, 'ada')).toSPARQL()).toContain('bif:contains');
  });

  test('other databases reject the patterns', () => {
    // @ts-expect-error Standard databases do not accept Virtuoso patterns.
    expect(() => BaseDatabase.create().ask().where(textContains(o, 'ada')).toSPARQL()).toThrow(
      'Unsupported pattern provided'
    );
    const pragma = define('input:same-as', 'yes');
    // @ts-expect-error ARQ databases do not accept Virtuoso patterns.
    expect(() => ArqDatabase.create().ask().where(pragma).toSPARQL()).toThrow(
      'Unsupported pattern provided'
    );
  });
});

describe('Virtuoso bif: and sql: functions', () => {
  test('print reserved prefixed names without declarations', () => {
    const centre = bif.st_point(0, 52);
    const query = db
      .select({
        km: as(bif.st_distance(o, centre), db.variable('km')),
        wkt: as(bif.st_astext(o), db.variable('wkt')),
        inside: as(bif.st_within(o, centre, 10), db.variable('inside')),
        haversine: as(
          bifCall('haversine_deg_km', [1, 2, 3, 4], transformNumber),
          db.variable('haversine')
        ),
        label: as(sqlCall('FormatName', [o], transformString), db.variable('label')),
      })
      .where(
        triples(s, p, o),
        filter(bif.st_intersects(o, centre, 100)),
        filter(bif.contains(o, '"ada"'))
      );
    const text = compact(query.toSPARQL());
    expect(text).not.toContain('PREFIX');
    expect(text).toContain('bif:st_distance ( ?o , bif:st_point (');
    expect(text).toContain('bif:st_within ( ?o , bif:st_point (');
    expect(text).toContain('sql:FormatName ( ?o )');
    expect(text).toContain('FILTER ( bif:contains ( ?o , "\\"ada\\"" ) )');
    expect(() =>
      parser.parse(`PREFIX bif: <urn:bif:>\nPREFIX sql: <urn:sql:>\n${query.toSPARQL()}`)
    ).not.toThrow();
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<
      { km: number; wkt: string; inside: boolean; haversine: number; label: string }[]
    >();
    expect(bif.st_intersects(o, o).args).toHaveLength(2);
    expect(bif.isgeometry(o).transform?.(rdf.literal('1'))).toBe(true);
    expect(bif.isgeometry(o).transform?.(rdf.literal('0'))).toBe(false);
  });

  test('reject function names that are not identifiers', () => {
    expect(() => bifCall('st point', [])).toThrow(SparkqlError);
    expect(() => sqlCall('x(1);', [])).toThrow(SparkqlError);
    expect(Object.isFrozen(bif)).toBe(true);
  });
});
