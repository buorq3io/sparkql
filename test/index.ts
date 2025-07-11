import { SparqlDatabase, createObjects } from '../src';

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
export const [v, n] = createObjects([], prefixes);
