import * as AST from '@traqula/rules-sparql-1-1';
import * as PARSE from '@traqula/parser-sparql-1-1';
import { SparqlDatabase } from '../src/index.js';

const prefixes = {
  rdf: {
    uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    fields: [],
  },
  rdfs: {
    uri: 'http://www.w3.org/2000/01/rdf-schema#',
    fields: [],
  },
  xsd: {
    uri: 'http://www.w3.org/2001/XMLSchema#',
    fields: [],
  },
  foaf: {
    uri: 'http://xmlns.com/foaf/0.1/',
    fields: [],
  },
  dc: {
    uri: 'http://purl.org/dc/elements/1.1/',
    fields: [],
  },
  ex: {
    uri: 'http://example.org/ontology#',
    fields: [],
  },
  schema: {
    uri: 'http://schema.org/',
    fields: [],
  },
} as const;

export const blankNodePrefix = 'g_';
export const db = SparqlDatabase.create({
  prefixes: prefixes,
  blankNodePrefix: blankNodePrefix,
  endpointUrl: process.env.DATABASE_URL,
});
export const [v, n, b] = db.create([], prefixes);

export const factory = new AST.AstFactory();
const termBlankOriginal = factory.termBlank.bind(factory);
factory.termBlank = (label: string | undefined, loc: unknown) => {
  const result = termBlankOriginal(label, loc as any);
  // todo: raise error if the testing queries include blank term with reserved prefixes
  if (label && (label.startsWith('g_') || label.startsWith('e_'))) {
    result.label = result.label.substring(2)
  }
  return result
};

export const parser = new PARSE.Parser({
  defaultContext: {
    astFactory: factory,
  },
});
