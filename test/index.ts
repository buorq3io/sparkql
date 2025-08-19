import { Parser } from 'sparqljs';
import { SparqlDatabase } from '../src';
import { DataFactory } from 'rdf-data-factory';

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

const factory: DataFactory = new DataFactory();
const blankNodeOld = factory.blankNode.bind(factory);
factory.blankNode = (value?: string) => {
  if (value && value.startsWith('e_')) {
    value = value.substring(2);
  }
  return blankNodeOld(value);
};

export const parser = new Parser({ factory: factory as any });
