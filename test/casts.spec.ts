import { DataFactory } from 'rdf-data-factory';
import { describe, expect, test } from 'vitest';
import {
  castLangstring,
  type SparqlBindings,
  SparqlDatabase,
  type SparqlSession,
  transformLangstring,
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
