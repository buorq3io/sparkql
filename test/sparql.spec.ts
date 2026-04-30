import { diff } from 'json-diff-ts';
import { readdirSync, readFileSync } from 'fs';
import { beforeEach, describe, expect, test } from 'vitest';

import { canonicalizeQuery } from './helpers.js';
import { blankNodePrefix, db, parser, factory } from './index.js';
import { SparqlQueryBuilderBase } from '../src/database/sparql-query.js';
import { SparqlQueryInput } from '../src/helpers/types.js';

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
    factory.resetBlankNodeCounter();
    db.resetBlankCounter();
  });

  preparedTests.forEach(testData => {
    test(`should correctly generate query "${testData.queryName}"`, () => {
      const originalParsed = parser.parse(testData.queryContent);
      const test_file_module = testData.testContent;
      const buildedParsed = parser.parse(test_file_module.default().toSPARQL());

      const original = canonicalizeQuery(originalParsed, blankNodePrefix) as SparqlQueryInput;
      const builded = canonicalizeQuery(buildedParsed, blankNodePrefix) as SparqlQueryInput;

      if (builded.type === "query" && original.type === "query") {
        original.context.forEach(c => {
          expect(builded.context).toContainEqual(c)
        })
        builded.context = []
        original.context = []
      } else if (builded.type === "update" && original.type === "update") {
        builded.updates.forEach((u, i) => {
          original.updates[i].context.forEach(c => {
            expect(u.context).toContainEqual(c)
          })
          u.context = []
          original.updates[i].context = []
        })
      }

      expect(diff(original, builded)).toStrictEqual([]);
    });
  });
});
