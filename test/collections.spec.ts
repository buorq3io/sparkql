import { Parser } from '@traqula/parser-sparql-1-1';
import { describe, expect, test } from 'vitest';
import { SparqlDatabase, triples } from '#src/index.js';

const prefixes = {
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  schema: { uri: 'https://schema.org/', fields: [] },
} as const;
const db = SparqlDatabase.create({ managerConfig: prefixes });
const [v, n] = db.createManagers([], prefixes);

describe('RDF lists', () => {
  test('separates IRI items with spaces', () => {
    const query = db
      .select({ book: v.book })
      .where(triples(v.book, n.schema.author, [[n.foaf.Ada, n.foaf.Grace]]));
    const text = query.toSPARQL();
    expect(text).toContain('?book schema:author ( foaf:Ada foaf:Grace ) .');
    expect(() => new Parser().parse(text)).not.toThrow();
  });

  test('separates variable, literal and nested list items with spaces', () => {
    const query = db
      .select({ book: v.book })
      .where(triples(v.book, n.schema.author, [[v.a, v.b, 'x', [[v.c, n.foaf.Ada]]]]));
    const text = query.toSPARQL();
    expect(text).toContain('?book schema:author ( ?a ?b "x" ( ?c foaf:Ada ) ) .');
    expect(() => new Parser().parse(text)).not.toThrow();
  });

  test('separates items of a list in subject position', () => {
    const text = db
      .ask()
      .where(triples([[v.a, v.b]], n.foaf.knows, v.c))
      .toSPARQL();
    expect(text).toContain('( ?a ?b ) foaf:knows ?c .');
    expect(() => new Parser().parse(text)).not.toThrow();
  });
});
