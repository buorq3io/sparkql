import { Parser } from 'sparqljs';
import { diff } from 'json-diff-ts';
import { readdirSync, readFileSync } from 'fs';
import { describe, test, expect } from 'vitest';

import { SparqlQueryBuilderBase } from '../src/database/sparql-query';

let parser = new Parser();
const test_path = 'test/query/';
const sparql_path = 'test/sparql/';

const preparedTests: Array<{
  queryName: string;
  queryContent: string;
  testFilePromise: Promise<{ default: SparqlQueryBuilderBase<any, any> }>;
}> = [];

let queries = readdirSync(sparql_path);
queries = queries.map(q => {
  return q.replace(/\.sparql$/, '');
});
queries.sort();

queries.forEach(query => {
  const query_file = readFileSync(sparql_path + query + '.sparql', 'utf8');
  const test_file_promise = import(test_path + query + '.ts') as Promise<{
    default: SparqlQueryBuilderBase<any, any>;
  }>;

  preparedTests.push({
    queryName: query,
    queryContent: query_file,
    testFilePromise: test_file_promise,
  });
});

describe('SPARQL Queries', () => {
  preparedTests.forEach(testData => {
    test(`should correctly generate query "${testData.queryName}"`, async () => {
      const original = parser.parse(testData.queryContent);
      const test_file_module = await testData.testFilePromise;
      const builded = parser.parse(test_file_module.default.toSPARQL());

      builded.prefixes = {};
      original.prefixes = {};

      expect(diff(original, builded)).toStrictEqual([]);
    });
  });
});
