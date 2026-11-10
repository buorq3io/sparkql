import { describe, expect, test } from 'vitest';
import { SparkqlError, SparqlDatabase, triples, values } from '../src/index.js';

const compact = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('VALUES columns', () => {
  const db = SparqlDatabase.create();
  const [v] = db.createManagers([], {});

  test('columns of unequal length throw a SparkqlError', () => {
    expect(() => values({ name: ['Ada'], age: [36, 42] })).toThrow(SparkqlError);
    expect(() => values({ name: ['Ada', 'Grace'], age: [36] })).toThrow(/same length/);
    expect(() =>
      db
        .select({ name: v.name })
        .where(triples(v.person, v.p, v.name))
        .values({ name: ['Ada', 'Grace'], age: [36] })
    ).toThrow(SparkqlError);
  });

  test('undefined entries become UNDEF', () => {
    const text = compact(
      db
        .select({ name: v.name, age: v.age })
        .where(values({ name: ['Ada', undefined], age: [undefined, 36] }))
        .toSPARQL()
    );
    expect(text).toContain('VALUES( ?name ?age ){ ( "Ada" UNDEF ) ( UNDEF "36"');
  });

  test('equal columns and no columns are accepted', () => {
    expect(() => values({})).not.toThrow();
    expect(() => values({ name: [], age: [] })).not.toThrow();
    expect(() => values({ name: ['Ada'], age: [36] })).not.toThrow();
  });
});
