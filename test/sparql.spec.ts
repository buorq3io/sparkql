import { join } from 'path';
import { diff } from 'json-diff-ts';
import { readdirSync, readFileSync } from 'fs';
import { beforeEach, describe, expect, test } from 'vitest';

import { canonicalizeQuery } from '#test/helpers.js';
import { blankNodePrefix, db, parser, factory } from '#test/index.js';
import { SparqlQueryInput } from '#src/helpers/types.js';
import { SparqlQueryBuilderBase } from '#src/database/sparql-query.js';

const TEST_PATH = 'test/query/';
const SPARQL_PATH = 'test/sparql/';

function getFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return getFiles(fullPath);
    }

    return [fullPath];
  });
}

function collectPrefixes(queryPath: string): string {
  const parts = queryPath.split('/');
  const prefixes: string[] = [];

  // Check root prefix file
  try {
    prefixes.push(readFileSync(SPARQL_PATH + 'prefix.sparql', 'utf8'));
  } catch {}

  // Check each subdirectory level
  for (let i = 0; i < parts.length - 1; i++) {
    const dirPath = SPARQL_PATH + parts.slice(0, i + 1).join('/') + '/';
    try {
      prefixes.push(readFileSync(dirPath + 'prefix.sparql', 'utf8'));
    } catch {}
  }

  return prefixes.join('\n');
}

async function loadTestData(query: string) {
  let queryFile = readFileSync(SPARQL_PATH + query + '.sparql', 'utf8');

  const prefixContent = collectPrefixes(query);
  if (prefixContent) {
    queryFile = prefixContent + '\n' + queryFile;
  }

  const testFile = (await import(TEST_PATH + query + '.ts')) as {
    default: () => SparqlQueryBuilderBase<any, any>;
  };

  return {
    queryName: query,
    queryContent: queryFile,
    testContent: testFile,
  };
}

const queryPaths = getFiles(SPARQL_PATH)
  .map(q => q.replace(/\.sparql$/, ''))
  .map(q => q.replace(`${SPARQL_PATH}`, ''))
  .sort();

describe('SPARQL builder output is semantically equivalent to reference queries', () => {
  beforeEach(() => {
    factory.resetBlankNodeCounter();
    db.resetBlankCounter();
  });

  for (const queryName of queryPaths) {
    test(`should correctly generate query "${queryName}"`, async () => {
      if (queryName.endsWith('/prefix') || queryName === 'prefix') {
        return;
      }

      const testData = await loadTestData(queryName);

      const originalParsed = parser.parse(testData.queryContent);
      const builtParsed = parser.parse(testData.testContent.default().toSPARQL());

      const original = canonicalizeQuery(originalParsed, blankNodePrefix) as SparqlQueryInput;
      const built = canonicalizeQuery(builtParsed, blankNodePrefix) as SparqlQueryInput;

      if (built.type === 'query' && original.type === 'query') {
        original.context.forEach(c => {
          expect(built.context).toContainEqual(c);
        });

        built.context = [];
        original.context = [];
      } else if (built.type === 'update' && original.type === 'update') {
        built.updates.forEach((u, i) => {
          original.updates[i].context.forEach(c => {
            expect(u.context).toContainEqual(c);
          });

          u.context = [];
          original.updates[i].context = [];
        });
      }

      expect(diff(original, built)).toStrictEqual([]);
    });
  }
});
