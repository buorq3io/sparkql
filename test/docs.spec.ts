import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { expect, it } from 'vitest';

// Each test typechecks a whole program of examples, which takes longer than the default timeout.
const timeout = 120_000;

const root = resolve(import.meta.dirname, '..');

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

const fence = /^```(?:ts|typescript)\s*\n([\s\S]*?)^```/gm;

/** Typechecks each virtual file (path → source) as an independent module and returns diagnostics. */
function typecheck(examples: Map<string, string>): string {
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = path => examples.get(path) ?? readFile(path);
  host.fileExists = path => examples.has(path) || fileExists(path);
  const program = ts.createProgram([...examples.keys()], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/**
 * The implicit preamble of JSDoc examples (docs/contributing/jsdoc-style.md):
 * every export of `sparkql`, plus `prefixes`, `db`, `v` and `n`.
 */
function examplePreamble(): string {
  const index = resolve(root, 'src/index.ts');
  const program = ts.createProgram([index], options);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(index);
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error(`Cannot resolve the exports of ${index}`);
  const names = checker.getExportsOfModule(moduleSymbol).map(symbol => symbol.name);
  return [
    `import { ${names.join(', ')} } from 'sparkql';`,
    'const prefixes = {',
    "  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },",
    "  schema: { uri: 'https://schema.org/', fields: [] },",
    '};',
    'const db = SparqlDatabase.create({ managerConfig: prefixes });',
    'const [v, n] = db.createManagers([], prefixes);',
    '',
  ].join('\n');
}

it(
  'typechecks every TypeScript example in README.md and docs/*.md against source',
  () => {
    const documents = [
      'README.md',
      ...readdirSync(resolve(root, 'docs'))
        .filter(name => name.endsWith('.md'))
        .map(name => `docs/${name}`),
    ];
    const examples = new Map<string, string>();
    for (const document of documents) {
      const markdown = readFileSync(resolve(root, document), 'utf8');
      for (const match of markdown.matchAll(fence)) {
        const line = markdown.slice(0, match.index).split('\n').length + 1;
        // Each fence is an independent module; its virtual filename identifies the source line.
        examples.set(resolve(root, `${document.replace(/\.md$/, '')}.line-${line}.ts`), match[1]);
      }
    }
    expect(examples.size).toBeGreaterThan(0);
    expect(typecheck(examples)).toBe('');
  },
  timeout
);

it(
  'typechecks every @example in src JSDoc comments against source',
  () => {
    const preamble = examplePreamble();
    const examples = new Map<string, string>();
    for (const file of sourceFiles(resolve(root, 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const comment of source.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
        if (!comment[0].includes('@example')) continue;
        const commentLine = source.slice(0, comment.index).split('\n').length;
        const text = comment[0]
          .split('\n')
          .map(line => line.replace(/^\s*\/?\*+\/?\s?/, ''))
          .join('\n');
        for (const match of text.matchAll(fence)) {
          const line = commentLine + text.slice(0, match.index).split('\n').length;
          const code = match[1];
          // Examples that import for themselves (e.g. from `sparkql/arq`) set themselves up.
          const body = /^import\s/m.test(code) ? code : `${preamble}${code}`;
          const name = `${relative(root, file).replace(/\.ts$/, '')}.example-line-${line}.ts`;
          examples.set(resolve(root, name), body);
        }
      }
    }
    expect(typecheck(examples)).toBe('');
  },
  timeout
);
