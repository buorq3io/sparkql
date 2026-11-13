import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { SparqlDatabase as ArqDatabase, letBinding } from '../src/arq/index.js';
import { SparqlDatabase as BaseDatabase } from '../src/index.js';
import {
  adjust,
  as,
  group,
  lateral,
  optional,
  oxigraphDialect,
  SparkqlError,
  SparqlDatabase,
  type TermLiteralOutput,
  triples,
  union,
} from '../src/oxigraph/index.js';
import { SparqlDatabase as VirtuosoDatabase } from '../src/virtuoso/index.js';

const rdf = new DataFactory();
const db = SparqlDatabase.create();
const s = db.variable('s');
const p = db.variable('p');
const o = db.variable('o');
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();
const parser = new Parser();
const dayTimeDuration = '<http://www.w3.org/2001/XMLSchema#dayTimeDuration>';

describe('Oxigraph LATERAL', () => {
  const subquery = db
    .select({ s, o })
    .where(triples(s, p, o))
    .limit(1)
    .as();

  test('prints a LATERAL group around its patterns', () => {
    const query = db.select().where(triples(s, p, db.variable('x')), lateral(subquery));
    expect(compact(query.toSPARQL())).toBe(
      'SELECT * WHERE { ?s ?p ?x . LATERAL { { SELECT ?s ?o WHERE { ?s ?p ?o . } LIMIT 1 } } }'
    );
  });

  test('prints at any depth and in every query form', () => {
    const nested = db
      .select()
      .where(
        optional(union(group(lateral(triples(s, p, o))), group(lateral(lateral(triples(o, p, s))))))
      );
    expect(compact(nested.toSPARQL())).toBe(
      'SELECT * WHERE { OPTIONAL { { LATERAL { ?s ?p ?o . } } UNION { LATERAL { LATERAL { ?o ?p ?s . } } } } }'
    );
    expect(
      compact(
        db
          .ask()
          .where(lateral(triples(s, p, o)))
          .toSPARQL()
      )
    ).toBe('ASK WHERE { LATERAL { ?s ?p ?o . } }');
    expect(
      db
        .construct(triples(s, p, o))
        .where(lateral(subquery))
        .toSPARQL()
    ).toContain('LATERAL {');
    expect(
      compact(
        db
          .insert(triples(s, p, o))
          .where(lateral(triples(s, p, o)))
          .toSPARQL()
      )
    ).toBe('INSERT { ?s ?p ?o . } WHERE { LATERAL { ?s ?p ?o . } }');
  });

  test('rejects LET, which Oxigraph does not parse', () => {
    const let_ = letBinding(1, o) as never;
    expect(() => db.select().where(let_).toSPARQL()).toThrow();
    expect(() => db.select().where(lateral(let_)).toSPARQL()).toThrow();
  });

  test('is rejected by databases without LATERAL', () => {
    const pattern = lateral(triples(s, p, o)) as never;
    expect(() => BaseDatabase.create().select().where(pattern).toSPARQL()).toThrow();
    expect(() => VirtuosoDatabase.create().select().where(pattern).toSPARQL()).toThrow();
    // ARQ has LATERAL too, with the same node shape.
    expect(ArqDatabase.create().select().where(pattern).toSPARQL()).toContain('LATERAL {');
  });

  test('works through the standard factory', () => {
    const custom = BaseDatabase.create({ dialect: oxigraphDialect });
    expect(
      custom
        .select()
        .where(lateral(triples(s, p, o)))
        .toSPARQL()
    ).toContain('LATERAL {');
  });
});

describe('Oxigraph ADJUST', () => {
  test('sends a string timezone as an xsd:dayTimeDuration', () => {
    const query = db.select({ local: as(adjust(o, 'PT2H'), db.variable('local')) }).where();
    const text = compact(query.toSPARQL());
    expect(text).toBe(
      `SELECT ( ADJUST( ?o , STRDT( "PT2H" , ${dayTimeDuration} ) ) AS ?local ) WHERE { }`
    );
    // ADJUST is not SPARQL 1.1, so the rest of the query is checked with a standard call.
    expect(() => parser.parse(text.replace('ADJUST(', 'CONCAT('))).not.toThrow();
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<{ local: TermLiteralOutput }[]>();
  });

  test('passes other timezones through', () => {
    const typed = db.literal('-PT5H', new URL(dayTimeDuration.slice(1, -1)));
    expect(
      compact(
        db
          .select({ a: as(adjust(o, typed), db.variable('a')) })
          .where()
          .toSPARQL()
      )
    ).toBe(`SELECT ( ADJUST( ?o , "-PT5H"^^${dayTimeDuration} ) AS ?a ) WHERE { }`);
    expect(
      compact(
        db
          .select({ a: as(adjust(o, db.variable('tz')), db.variable('a')) })
          .where()
          .toSPARQL()
      )
    ).toBe('SELECT ( ADJUST( ?o , ?tz ) AS ?a ) WHERE { }');
  });

  test.each(['PT2H', '-PT5H30M', 'PT0H', 'PT45M', '-PT14H'])('accepts %s', timezone => {
    expect(() => adjust(o, timezone)).not.toThrow();
  });

  test.each(['', '2', '+02:00', 'P1D', 'PT', 'PT1.5H', 'PT1S', 'pt2h', '-PT', 'PT2H ', '--PT2H'])(
    'rejects %j',
    timezone => {
      expect(() => adjust(o, timezone)).toThrow(SparkqlError);
    }
  );

  test('returns the adjusted literal unchanged', () => {
    const literal = rdf.literal(
      '11:00:00+01:00',
      rdf.namedNode('http://www.w3.org/2001/XMLSchema#time')
    );
    expect(adjust(o, 'PT1H').transform?.(literal)).toBe(literal);
  });
});
