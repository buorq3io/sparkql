import SparqlJs from 'sparqljs';
import RdfJs from 'rdf-data-factory';
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
export const db = SparqlDatabase.create(prefixes, { blankNodePrefix: blankNodePrefix });
export const [v, n, b] = db.create([], prefixes);

const factory: RdfJs.DataFactory = new RdfJs.DataFactory();
const blankNodeOld = factory.blankNode.bind(factory);
factory.blankNode = (value?: string) => {
  if (value && value.startsWith('e_')) {
    value = value.substring(2);
  }
  return blankNodeOld(value);
};

export const parser = new SparqlJs.Parser({ factory: factory });
