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
} as const;

export const db = new SparqlDatabase(prefixes);
export const [v, n, b] = db.create([], prefixes, 'allow');

const factory: RdfJs.DataFactory = new RdfJs.DataFactory();
const blankNodeOld = factory.blankNode.bind(factory);
factory.blankNode = (value?: string) => {
  if (value && value.startsWith('e_')) {
    value = value.substring(2);
  }
  return blankNodeOld(value);
};

export const parser = new SparqlJs.Parser({ factory: factory as any });
