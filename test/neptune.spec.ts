import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, expect, test } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../src/arq/index.js';
import { SparqlDatabase as BaseDatabase } from '../src/index.js';
import {
  group,
  neptuneDialect,
  optional,
  queryHint,
  SparkqlError,
  SparqlDatabase,
  triples,
} from '../src/neptune/index.js';

const hint = 'http://aws.amazon.com/neptune/vocab/v01/QueryHints#';
const xsd = 'http://www.w3.org/2001/XMLSchema#';
const db = SparqlDatabase.create();
const s = db.variable('s');
const p = db.variable('p');
const o = db.variable('o');
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();
const parser = new Parser();

describe('Neptune query hints', () => {
  test('prints each hint as a triple pattern with full IRIs', () => {
    const query = db
      .select()
      .where(
        queryHint('Query', 'joinOrder', 'Ordered'),
        queryHint('Query', 'queryTimeout', 100),
        queryHint('Query', 'useDFE', true),
        queryHint('Query', 'queryId', '4d5c4fae-aa30-41cf-9e1f-91e6b7dd6f47'),
        triples(s, p, o),
        queryHint('Prior', 'rangeSafe', true)
      );
    const text = compact(query.toSPARQL());
    expect(text).toBe(
      compact(`SELECT * WHERE {
        <${hint}Query> <${hint}joinOrder> "Ordered" .
        <${hint}Query> <${hint}queryTimeout> "100"^^<${xsd}integer> .
        <${hint}Query> <${hint}useDFE> "true"^^<${xsd}boolean> .
        <${hint}Query> <${hint}queryId> "4d5c4fae-aa30-41cf-9e1f-91e6b7dd6f47" .
        ?s ?p ?o .
        <${hint}Prior> <${hint}rangeSafe> "true"^^<${xsd}boolean> .
      }`)
    );
    expect(() => parser.parse(query.toSPARQL())).not.toThrow();
  });

  test('keeps hints where they are placed: groups, subqueries, updates and DESCRIBE', () => {
    const subquery = db
      .select({ s })
      .where(queryHint('SubQuery', 'evaluationStrategy', 'BottomUp'), triples(s, p, o))
      .as();
    const select = compact(
      db
        .select()
        .where(
          optional(group(queryHint('Group', 'joinOrder', 'Ordered'), triples(s, p, o))),
          subquery
        )
        .toSPARQL()
    );
    expect(select).toMatch(
      new RegExp(`OPTIONAL \\{ \\{ <${hint}Group> <${hint}joinOrder> "Ordered" \\.`)
    );
    expect(select).toMatch(
      new RegExp(`SELECT \\?s WHERE \\{ <${hint}SubQuery> <${hint}evaluationStrategy> "BottomUp"`)
    );

    const iri = db.iri('https://example.org/g');
    const update = db
      .with(iri)
      .insert(triples(s, p, o))
      .where(queryHint('Query', 'queryTimeout', 100), triples(s, p, o))
      .$end()
      .toSPARQL();
    expect(compact(update)).toContain(`WHERE { <${hint}Query> <${hint}queryTimeout>`);

    const describeQuery = db
      .describe(s)
      .where(queryHint('Query', 'describeMode', 'CBD'), triples(s, p, o))
      .toSPARQL();
    expect(compact(describeQuery)).toContain(`<${hint}describeMode> "CBD"`);
  });

  test('is available through the dialect and with an explicitly configured database', () => {
    expect(neptuneDialect.hints.queryHint).toBe(queryHint);
    const explicit = BaseDatabase.create({ dialect: neptuneDialect });
    expect(
      explicit
        .ask()
        .where(queryHint('Query', 'useDFE', false))
        .toSPARQL()
    ).toContain(`<${hint}useDFE> "false"^^<${xsd}boolean>`);
  });

  test('rejects unsupported hints, scopes and values for untyped callers', () => {
    const untyped = queryHint as (scope: unknown, name: unknown, value: unknown) => unknown;
    expect(() => untyped('Query', 'groupByFlattening', true)).toThrow(SparkqlError);
    expect(() => untyped('Query', 'toString', true)).toThrow('Unsupported Neptune query hint');
    expect(() => untyped('Group', 'useDFE', true)).toThrow('does not support the Group scope');
    expect(() => untyped('Query', 'joinOrder', 'Unordered')).toThrow('Unsupported value');
    expect(() => untyped('Query', 'useDFE', 'true')).toThrow('Unsupported value');
    expect(() => untyped('Query', 'queryId', '')).toThrow('Unsupported value');
    expect(() => queryHint('Query', 'queryTimeout', 1.5)).toThrow('Unsupported value');
    expect(() => queryHint('Query', 'queryTimeout', -1)).toThrow('Unsupported value');
    expect(() => queryHint('Query', 'describeStatementLimit', Number.NaN)).toThrow(
      'Unsupported value'
    );
    expect(queryHint('Query', 'describeIterationLimit', 0).value).toBe(0);
  });

  test('other databases reject hints at runtime', () => {
    const pattern = queryHint('Query', 'useDFE', true);
    // @ts-expect-error Standard databases do not accept Neptune hints.
    expect(() => BaseDatabase.create().select().where(pattern).toSPARQL()).toThrow(
      'Unsupported pattern provided (type "pattern", subType "neptuneHint").'
    );
    // @ts-expect-error ARQ databases do not accept Neptune hints.
    expect(() => ArqDatabase.create().select().where(pattern).toSPARQL()).toThrow(
      'Unsupported pattern provided'
    );
  });
});
