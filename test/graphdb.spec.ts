import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test } from 'vitest';
import {
  as,
  decodeExplainPlan,
  graphdbDialect,
  historyAt,
  ofn,
  ontoGraphs,
  SparkqlError,
  SparkqlQueryError,
  type SparqlBindings,
  SparqlDatabase,
  type SparqlSession,
  triples,
} from '../src/graphdb/index.js';
import { SparqlDatabase as BaseDatabase } from '../src/index.js';

const onto = 'http://www.ontotext.com/';
const fn = `${onto}sparql/functions/`;
const rdf = new DataFactory();
const db = SparqlDatabase.create();
const s = db.variable('s');
const p = db.variable('p');
const o = db.variable('o');
const g = db.iri('https://example.org/g');
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();
const parser = new Parser();

function session(rows: SparqlBindings[]) {
  const sent: string[] = [];
  const value: SparqlSession = {
    async bindings(sparql) {
      sent.push(sparql);
      return rows;
    },
    boolean: async () => true,
    quads: async () => [],
    update: async () => {},
    raw: async () => new Response('{}'),
  };
  return { session: value, sent };
}

describe('GraphDB pseudo-graphs', () => {
  test('print as FROM and FROM NAMED clauses on every query form', () => {
    const select = db
      .select()
      .from(ontoGraphs.explicit)
      .from(ontoGraphs.disableSameAs)
      .fromNamed(ontoGraphs.implicit)
      .where(triples(s, p, o))
      .toSPARQL();
    expect(compact(select)).toBe(
      `SELECT * FROM <${onto}explicit> FROM <${onto}disable-sameAs> FROM NAMED <${onto}implicit> WHERE { ?s ?p ?o . }`
    );
    expect(() => parser.parse(select)).not.toThrow();
    expect(db.ask().from(ontoGraphs.skipRedundantImplicit).where().toSPARQL()).toContain(
      `FROM <${onto}skip-redundant-implicit>`
    );
    expect(BaseDatabase.create().ask().from(ontoGraphs.explicit).where().toSPARQL()).toContain(
      `FROM <${onto}explicit>`
    );
  });

  test('cannot be changed by callers', () => {
    expect(Object.isFrozen(ontoGraphs)).toBe(true);
    expect(Object.isFrozen(ontoGraphs.explicit)).toBe(true);
  });

  test('historyAt accepts a year up to a second and nothing else', () => {
    for (const timestamp of ['2022', '202207', '20220712', '2022071216', '20220712161717']) {
      expect(db.ask().from(historyAt(timestamp)).where().toSPARQL()).toContain(
        `FROM <${onto}at/${timestamp}>`
      );
    }
    for (const timestamp of ['22', '20227', '2022-07-12', '202207121617171', '']) {
      expect(() => historyAt(timestamp)).toThrow(SparkqlError);
    }
    expect(() => historyAt(20220712 as unknown as string)).toThrow(SparkqlError);
  });
});

describe('GraphDB explain and measure', () => {
  const names = db
    .select({ name: o })
    .from(g)
    .where(triples(s, p, o))
    .orderBy(o)
    .limit(10);

  test('prepends the pseudo-graph to the wrapped query without changing it', () => {
    const before = names.toSPARQL();
    const explain = compact(db.explain(names).toSPARQL());
    expect(explain).toBe(
      `SELECT ?o FROM <${onto}explain> FROM <https://example.org/g> WHERE { ?s ?p ?o . } ORDER BY ASC ( ?o ) LIMIT 10`
    );
    expect(compact(db.measure(names).toSPARQL())).toContain(`SELECT ?o FROM <${onto}measure> FROM`);
    expect(names.toSPARQL()).toBe(before);
    expect(db.explain(names).getSPARQL().datasets.clauses).toHaveLength(2);
    expect(db.explain(names).comment('plan').toSPARQL()).toMatch(/^#plan\nSELECT/);
  });

  test('resolves to the plan text that GraphDB returns as bindings', async () => {
    const { session: fake, sent } = session([
      { plan: rdf.literal('----- Begin optimization group 1 -----') },
      { plan: rdf.literal('----- End optimization group 1 -----') },
    ]);
    const executed = SparqlDatabase.create({ session: fake });
    const query = executed.select({ name: o }).where(triples(s, p, o));
    const plan = await executed.explain(query);
    expectTypeOf(plan).toEqualTypeOf<string>();
    expect(plan).toBe(
      '----- Begin optimization group 1 -----\n----- End optimization group 1 -----'
    );
    expect(sent).toEqual([executed.explain(query).toSPARQL()]);
  });

  test('rejects responses without a plan', async () => {
    expect(() => decodeExplainPlan([])).toThrow('GraphDB returned no query plan.');
    expect(() => decodeExplainPlan([{ s: rdf.namedNode('https://example.org/s') }])).toThrow();
    const { session: fake } = session([]);
    const executed = SparqlDatabase.create({ session: fake });
    await expect(executed.measure(executed.select().where())).rejects.toThrow(SparkqlQueryError);
  });

  test('is registered through the dialect', () => {
    const explicit = BaseDatabase.create({ dialect: graphdbDialect });
    expect(explicit.explain(explicit.select().where()).toSPARQL()).toContain(`<${onto}explain>`);
    // @ts-expect-error Standard databases have no explain method.
    expect(BaseDatabase.create().explain).toBeUndefined();
    // @ts-expect-error Only SELECT queries can be explained.
    db.explain(db.ask().where());
  });
});

describe('GraphDB ofn: functions', () => {
  test('print full function IRIs and select as numbers', () => {
    const start = db.variable('start');
    const end = db.variable('end');
    const query = db
      .select({
        days: as(ofn.daysBetween(start, end), db.variable('days')),
        years: as(ofn.yearsFromDuration(db.variable('length')), db.variable('years')),
        root: as(ofn.sqrt(ofn.pow(o, 2)), db.variable('root')),
        pi: as(ofn.pi(), db.variable('pi')),
      })
      .where(triples(s, p, o));
    const text = compact(query.toSPARQL());
    expect(text).toContain(`<${fn}daysBetween> ( ?start , ?end )`);
    expect(text).toContain(`<${fn}years-from-duration> ( ?length )`);
    expect(text).toContain(`<${fn}sqrt> ( <${fn}pow> ( ?o ,`);
    expect(text).toContain(`<${fn}pi> ( )`);
    expect(() => parser.parse(query.toSPARQL())).not.toThrow();
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<
      { days: number; years: number; root: number; pi: number }[]
    >();
    expect(ofn.asMillis(o).transform?.(rdf.literal('1500'))).toBe(1500);
  });

  test('cover every documented function with its GraphDB name', () => {
    const names = Object.entries(ofn).map(([key, create]) => {
      const call = (create as (...args: unknown[]) => { function: URL })(o, o);
      return [key, String(call.function).slice(fn.length)];
    });
    expect(names).toHaveLength(56);
    const renamed = names.filter(([key, name]) => key !== name);
    expect(Object.fromEntries(renamed)).toEqual({
      yearsFromDuration: 'years-from-duration',
      monthsFromDuration: 'months-from-duration',
      daysFromDuration: 'days-from-duration',
      hoursFromDuration: 'hours-from-duration',
      minutesFromDuration: 'minutes-from-duration',
      secondsFromDuration: 'seconds-from-duration',
      millisFromDuration: 'millis-from-duration',
    });
    expect(Object.isFrozen(ofn)).toBe(true);
  });
});
