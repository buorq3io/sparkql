import { DataFactory } from 'rdf-data-factory';
import { describe, expect, test } from 'vitest';
import {
  applyTransform,
  as,
  castLangstring,
  castNumber,
  type SparqlBindings,
  SparqlDatabase,
  type SparqlSession,
  sparql,
  strlen,
  transformLangstring,
  transformNumber,
  transformString,
} from '../src/index.js';

const rdf = new DataFactory();

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

describe('castLangstring', () => {
  test('appends only a non-empty language tag', () => {
    expect(transformLangstring(rdf.literal('chat', 'fr'))).toBe(`'chat'@fr`);
    expect(transformLangstring(rdf.literal('Ada'))).toBe('Ada');
    expect(
      transformLangstring(
        rdf.literal('36', rdf.namedNode('http://www.w3.org/2001/XMLSchema#integer'))
      )
    ).toBe('36');
    expect(transformLangstring(rdf.namedNode('https://example.org/ada'))).toBe(
      'https://example.org/ada'
    );
  });

  test('decodes selected tagged and untagged literals', async () => {
    const db = SparqlDatabase.create({
      session: session([{ name: rdf.literal('Ada') }, { name: rdf.literal('chat', 'fr') }]),
    });
    const [v] = db.createManagers([], {});
    expect(await db.select({ name: castLangstring(v.name) })).toEqual([
      { name: 'Ada' },
      { name: `'chat'@fr` },
    ]);
  });
});

describe('applyTransform', () => {
  test('returns a new binding and leaves the original untouched', () => {
    const db = SparqlDatabase.create();
    const [v] = db.createManagers([], {});
    const expression = strlen(v.name);
    const binding = as(expression, v.length);
    const expressionTransform = expression.transform;
    const cast = applyTransform(binding, transformString);

    expect(cast).not.toBe(binding);
    expect(cast.type === 'pattern' && cast.variable.transform).toBe(transformString);
    expect(cast.type === 'pattern' && cast.expression).toMatchObject({
      transform: transformString,
    });
    expect(binding.variable.transform).toBe(expressionTransform);
    expect(binding.expression).toBe(expression);
    expect(expression.transform).toBe(expressionTransform);
  });

  test('applies the transform whatever the binding expression is', async () => {
    const db = SparqlDatabase.create({
      session: session([{ a: rdf.literal('1'), b: rdf.literal('2'), c: rdf.literal('3') }]),
    });
    const [v] = db.createManagers([], {});
    const [row] = await db.select({
      a: castNumber(as(v.age, v.a)),
      b: castNumber(as(36, v.b)),
      c: castNumber(as(sparql`STRLEN(${v.name})`, v.c)),
    });
    expect(row).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('copies a variable without changing it', () => {
    const db = SparqlDatabase.create();
    const [v] = db.createManagers([], {});
    const age = v.age;
    const cast = applyTransform(age, transformNumber);
    expect(cast).not.toBe(age);
    expect(cast.type === 'term' && cast.transform).toBe(transformNumber);
    expect(age.transform).toBeUndefined();
  });
});
