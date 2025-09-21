import { diff } from 'json-diff-ts';
import { readdirSync, readFileSync } from 'fs';
import { beforeEach, describe, expect, test } from 'vitest';

import { canonicalizeQuery } from './helpers.js';
import { blankNodePrefix, db, parser } from './index.js';
import { SparqlQueryBuilderBase } from '../src/database/sparql-query.js';

const TEST_PATH = 'test/query/';
const SPARQL_PATH = 'test/sparql/';

async function prepareParallel(queries: string[]) {
  const promises = queries.map(async query => {
    const query_file = readFileSync(SPARQL_PATH + query + '.sparql', 'utf8');

    const test_file = (await import(TEST_PATH + query + '.ts')) as {
      default: () => SparqlQueryBuilderBase<any, any>;
    };

    return {
      queryName: query,
      queryContent: query_file,
      testContent: test_file,
    };
  });

  return await Promise.all(promises);
}

describe('SPARQL Queries', async () => {
  const query_paths = readdirSync(SPARQL_PATH).map(q => {
    return q.replace(/\.sparql$/, '');
  });
  query_paths.sort();
  const preparedTests = await prepareParallel(query_paths);

  beforeEach(() => {
    parser._resetBlanks();
    db.resetBlankCounter();
  });

  preparedTests.forEach(testData => {
    test(`should correctly generate query "${testData.queryName}"`, () => {
      const originalParsed = parser.parse(testData.queryContent);
      const test_file_module = testData.testContent;
      const buildedParsed = parser.parse(test_file_module.default().toSPARQL());

      originalParsed.prefixes = {};
      buildedParsed.prefixes = {};

      const original = canonicalizeQuery(originalParsed, blankNodePrefix);
      const builded = canonicalizeQuery(buildedParsed, blankNodePrefix);

      expect(diff(original, builded)).toStrictEqual([]);
    });
  });
});
