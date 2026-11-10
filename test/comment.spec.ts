import { Parser } from '@traqula/parser-sparql-1-1';
import { expect, test, vi } from 'vitest';
import { SparqlDatabase, type SparqlSession, sparql, triples } from '../src/index.js';
import { pragma, SparqlDatabase as StardogDatabase, stardogDialect } from '../src/stardog/index.js';

const parser = new Parser();

test('comments accumulate on SELECT, ASK, CONSTRUCT, DESCRIBE, COUNT and UPDATE', () => {
  const db = SparqlDatabase.create();
  const pattern = triples(db.variable('s'), db.iri('https://example.org/p'), db.variable('o'));
  for (const query of [
    db.select({ s: db.variable('s') }).where(pattern),
    db.ask().where(pattern),
    db.construct(pattern).where(pattern),
    db.describe(db.variable('s')).where(pattern),
    db.$count(pattern),
    db.insertData(triples(db.iri('https://example.org/s'), db.iri('https://example.org/p'), 'o')),
  ]) {
    const original = query.toSPARQL();
    expect(
      query.comment('request=123').comment({ route: '/users', app: "O'Reilly" }).toSPARQL()
    ).toBe(`#request=123\n#app='O%27Reilly',route='%2Fusers'\n${original}`);
    expect(parser.parse(query.toSPARQL())).toEqual(parser.parse(original));
  }
});

test('line breaks cannot escape a string or record comment and inject SPARQL', () => {
  const db = SparqlDatabase.create();
  const original = db.ask().toSPARQL();
  for (const lineBreak of ['\n', '\r', '\r\n', '\v', '\f', '\u0085', '\u2028', '\u2029']) {
    const attack = `tag${lineBreak}INSERT DATA { <x> <y> <z> } #`;
    for (const comment of [attack, { [attack]: attack }]) {
      const text = db.ask().comment(comment).toSPARQL();
      expect(text.split('\n')[0]).toMatch(/^#/);
      expect(text.slice(text.indexOf('\n') + 1)).toBe(original);
      expect(parser.parse(text)).toEqual(parser.parse(original));
    }
  }
});

test('empty comments are omitted and record entries are sorted', () => {
  const db = SparqlDatabase.create();
  const query = db.ask();
  expect(query.comment('').comment({}).comment({ empty: '' }).toSPARQL()).toBe(db.ask().toSPARQL());
  expect(query.comment({ z: 'last', a: 'first' }).toSPARQL()).toMatch(/^#a='first',z='last'\n/);
});

test('prepared comments are fixed at preparation, executed and cannot consume placeholder markers', async () => {
  const boolean = vi.fn(async () => true);
  const session: SparqlSession = {
    bindings: async () => [],
    boolean,
    quads: async () => [],
    update: async () => {},
    raw: async () => new Response(),
  };
  const db = SparqlDatabase.create({ session });
  const query = db
    .ask()
    .where(triples(db.variable('s'), db.iri('https://example.org/p'), sparql.placeholder('name')))
    .comment('prepared');
  const prepared = query.prepare();
  query.comment('later');
  const text = prepared.toSPARQL({ name: 'Ada' });
  expect(text).toMatch(/^#prepared\nASK/);
  expect(text).not.toContain('later');
  expect(() => parser.parse(text)).not.toThrow();
  expect(await prepared.execute({ name: 'Ada' })).toBe(true);
  expect(boolean).toHaveBeenCalledWith(text);
});

test('WITH operations and their parent share comments across generation and execution', async () => {
  const update = vi.fn(async () => {});
  const session: SparqlSession = {
    bindings: async () => [],
    boolean: async () => true,
    quads: async () => [],
    update,
    raw: async () => new Response(),
  };
  const db = SparqlDatabase.create({ session });
  const operation = db.with(db.iri('https://example.org/g')).comment('operation');
  const text = operation.toSPARQL();
  expect(text).toMatch(/^#operation\n/);
  await operation;
  expect(update).toHaveBeenCalledWith(text);
  expect(operation.prepare().toSPARQL({})).toBe(text);
  expect(operation.$end().toSPARQL()).toBe(text);
});

test('Stardog contributes typed preamble pragmas through its dialect', () => {
  const db = StardogDatabase.create();
  const text = db
    .ask()
    .comment(pragma('plan.cache', 'off'))
    .comment(stardogDialect.hints.pragma('paths.evaluation', 'lazy'))
    .toSPARQL();
  expect(text).toMatch(/^#pragma plan.cache off\n#pragma paths.evaluation lazy\nASK/);
  expect(() => parser.parse(text)).not.toThrow();
  expect(() => {
    // @ts-expect-error: each hint restricts its values.
    pragma('plan.cache', 'lazy');
  }).toThrow('Unsupported Stardog');
  expect(() => {
    // @ts-expect-error: scope hints are not preamble hints.
    pragma('group.joins', 'on');
  }).toThrow('Unsupported Stardog');
});

test('dialect query modules retain comments in generated requests', () => {
  const db = StardogDatabase.create();
  const query = db
    .paths()
    .start(db.variable('s'))
    .end(db.variable('e'))
    .via(db.iri('https://example.org/p'));
  const original = query.toSPARQL();
  expect(query.comment(pragma('paths.evaluation', 'lazy')).toSPARQL()).toBe(
    `#pragma paths.evaluation lazy\n${original}`
  );
});
