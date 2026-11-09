import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('typechecks every TypeScript example in README.md and docs/*.md against source', () => {
  const root = resolve(import.meta.dirname, '..');
  const documents = [
    'README.md',
    ...readdirSync(resolve(root, 'docs'))
      .filter(name => name.endsWith('.md'))
      .map(name => `docs/${name}`),
  ];
  const examples = new Map<string, string>();
  for (const document of documents) {
    const markdown = readFileSync(resolve(root, document), 'utf8');
    for (const match of markdown.matchAll(/^```(?:ts|typescript)\s*\n([\s\S]*?)^```/gm)) {
      const line = markdown.slice(0, match.index).split('\n').length + 1;
      // Each fence is an independent module; its virtual filename identifies the source line.
      examples.set(resolve(root, `${document.replace(/\.md$/, '')}.line-${line}.ts`), match[1]);
    }
  }
  expect(examples.size).toBeGreaterThan(0);

  const configFile = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
  const options: ts.CompilerOptions = {
    ...config.options,
    noEmit: true,
    // Examples intentionally leave intermediate results available for exploration.
    noUnusedLocals: false,
    noUnusedParameters: false,
    paths: {
      sparkql: ['./src/index.ts'],
      'sparkql/arq': ['./src/arq/index.ts'],
      'sparkql/stardog': ['./src/stardog/index.ts'],
    },
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = path => examples.get(path) ?? readFile(path);
  host.fileExists = path => examples.has(path) || fileExists(path);
  const program = ts.createProgram([...examples.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  expect(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: path => path,
      getCurrentDirectory: () => root,
      getNewLine: () => '\n',
    })
  ).toBe('');
});
