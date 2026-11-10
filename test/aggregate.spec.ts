import { DataFactory } from 'rdf-data-factory';
import { describe, expect, test } from 'vitest';
import {
  as,
  groupConcat,
  groupConcatDistinct,
  type SparqlBindings,
  SparqlDatabase,
  type SparqlSession,
  triples,
} from '../src/index.js';

const rdf = new DataFactory();
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();

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

describe('GROUP_CONCAT separators', () => {
  const db = SparqlDatabase.create();
  const [v] = db.createManagers([], {});
  const select = (aggregate: ReturnType<typeof groupConcat>) =>
    compact(
      db
        .select({ names: as(aggregate, v.names) })
        .where(triples(v.person, v.p, v.name))
        .toSPARQL()
    );

  test('an empty separator is emitted as SEPARATOR=""', () => {
    expect(select(groupConcat(v.name, ''))).toContain('GROUP_CONCAT( ?name ;SEPARATOR="" )');
    expect(select(groupConcatDistinct(v.name, ''))).toContain(
      'GROUP_CONCAT( DISTINCT ?name ;SEPARATOR="" )'
    );
  });

  test('a non-empty separator and the default are emitted', () => {
    expect(select(groupConcat(v.name, ', '))).toContain(';SEPARATOR=", " )');
    expect(select(groupConcat(v.name))).toContain(';SEPARATOR=');
  });

  test('a result joined with an empty separator decodes to one element', async () => {
    const db = SparqlDatabase.create({ session: session([{ names: rdf.literal('AdaBob') }]) });
    const [v] = db.createManagers([], {});
    expect(await db.select({ names: as(groupConcat(v.name, ''), v.names) })).toEqual([
      { names: ['AdaBob'] },
    ]);
  });

  test('a result joined with a separator decodes to its values', async () => {
    const db = SparqlDatabase.create({ session: session([{ names: rdf.literal('Ada, Bob') }]) });
    const [v] = db.createManagers([], {});
    expect(await db.select({ names: as(groupConcat(v.name, ', '), v.names) })).toEqual([
      { names: ['Ada', 'Bob'] },
    ]);
  });
});
