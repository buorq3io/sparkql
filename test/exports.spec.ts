import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from '@typescript/typescript6';
import { describe, expect, test } from 'vitest';

/**
 * Local exports that intentionally replace a name from an `export *` in the
 * same file, as `file: [names]`. The vendor entry points re-export the core
 * package and then declare a dialect-bound `SparqlDatabase`.
 */
const intendedOverrides: Record<string, readonly string[]> = {
  'src/arq/index.ts': ['SparqlDatabase', 'SparqlDatabaseOptions'],
  'src/stardog/index.ts': ['SparqlDatabase', 'SparqlDatabaseOptions'],
};

interface Conflict {
  name: string;
  sources: [string, string];
}

const root = resolve(import.meta.dirname, '..');
const files = readdirSync(join(root, 'src'), { recursive: true, encoding: 'utf8' })
  .filter(file => file.endsWith('.ts'))
  .map(file => join(root, 'src', file));

function createChecker(rootNames: string[]) {
  const config = ts.getParsedCommandLineOfConfigFile(
    join(root, 'tsconfig.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} }
  );
  const program = ts.createProgram({ rootNames, options: config?.options ?? {} });
  return { program, checker: program.getTypeChecker() };
}

function resolveAlias(checker: ts.TypeChecker, symbol: ts.Symbol) {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/**
 * Finds names that a barrel exports from more than one place: two `export *`
 * sources that export different symbols under one name, or a local export that
 * shadows an `export *` name. TypeScript silently drops the first kind from the
 * barrel and silently prefers the local in the second.
 */
function findConflicts(program: ts.Program, checker: ts.TypeChecker, file: string): Conflict[] {
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`Not in program: ${file}`);
  const starExports = new Map<string, { from: string; symbol: ts.Symbol }>();
  const conflicts: Conflict[] = [];
  const localNames: string[] = [];

  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      !statement.exportClause &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text;
      const module = checker.getSymbolAtLocation(statement.moduleSpecifier);
      if (!module) throw new Error(`Cannot resolve ${specifier} from ${file}`);
      for (const exported of checker.getExportsOfModule(module)) {
        const name = exported.getName();
        if (name === 'default') continue;
        const symbol = resolveAlias(checker, exported);
        const previous = starExports.get(name);
        if (!previous) starExports.set(name, { from: specifier, symbol });
        else if (previous.symbol !== symbol)
          conflicts.push({ name, sources: [previous.from, specifier] });
      }
    } else if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause))
        localNames.push(...statement.exportClause.elements.map(e => e.name.text));
      else localNames.push(statement.exportClause.name.text);
    } else if (
      ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations)
          if (ts.isIdentifier(declaration.name)) localNames.push(declaration.name.text);
      } else {
        const name = (statement as ts.DeclarationStatement).name;
        if (name && ts.isIdentifier(name)) localNames.push(name.text);
      }
    }
  }

  const allowed = intendedOverrides[relative(root, file)] ?? [];
  for (const name of new Set(localNames)) {
    const star = starExports.get(name);
    if (star && !allowed.includes(name)) conflicts.push({ name, sources: [star.from, 'local'] });
  }
  return conflicts;
}

function format(conflicts: Conflict[]) {
  return conflicts.map(({ name, sources }) => `${name} is exported from ${sources.join(' and ')}`);
}

describe('export conflicts', () => {
  const { program, checker } = createChecker(files);
  const barrels = files.filter(file =>
    program
      .getSourceFile(file)
      ?.statements.some(s => ts.isExportDeclaration(s) && !s.exportClause && s.moduleSpecifier)
  );

  test('finds the barrels', () => {
    expect(barrels.map(file => relative(root, file))).toContain('src/index.ts');
  });

  for (const file of barrels) {
    test(relative(root, file), () => {
      expect(format(findConflicts(program, checker, file))).toEqual([]);
    });
  }

  test('allow-listed overrides still shadow a star export', () => {
    for (const [file, names] of Object.entries(intendedOverrides)) {
      const path = join(root, file);
      const stars = program
        .getSourceFile(path)
        ?.statements.filter(ts.isExportDeclaration)
        .filter(s => !s.exportClause && s.moduleSpecifier)
        .flatMap(s => {
          const module = s.moduleSpecifier && checker.getSymbolAtLocation(s.moduleSpecifier);
          return module ? checker.getExportsOfModule(module).map(e => e.getName()) : [];
        });
      for (const name of names) expect(stars, `${file}: ${name}`).toContain(name);
    }
  });
});

describe('export conflict detection', () => {
  const fixture = (name: string, text: string) => [join(root, `src/__exports_${name}.ts`), text];

  function check(sources: string[][]) {
    const host = ts.createCompilerHost({});
    const original = host.getSourceFile;
    const virtual = new Map(sources.map(([path, text]) => [path, text]));
    host.getSourceFile = (path, version) => {
      const text = virtual.get(path);
      return text === undefined
        ? original(path, version)
        : ts.createSourceFile(path, text, version);
    };
    host.fileExists = path => virtual.has(path) || ts.sys.fileExists(path);
    host.readFile = path => virtual.get(path) ?? ts.sys.readFile(path);
    const program = ts.createProgram({
      rootNames: [...virtual.keys()],
      options: {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      },
      host,
    });
    return format(findConflicts(program, program.getTypeChecker(), sources[0][0]));
  }

  test('reports two star exports of different symbols under one name', () => {
    const conflicts = check([
      fixture('barrel', "export * from './__exports_a.js';\nexport * from './__exports_b.js';"),
      fixture('a', 'export const value = 1;'),
      fixture('b', 'export const value = 2;'),
    ]);
    expect(conflicts).toEqual(['value is exported from ./__exports_a.js and ./__exports_b.js']);
  });

  test('reports a local export that shadows a star export', () => {
    const conflicts = check([
      fixture('barrel', "export * from './__exports_a.js';\nexport type value = string;"),
      fixture('a', 'export const value = 1;'),
    ]);
    expect(conflicts).toEqual(['value is exported from ./__exports_a.js and local']);
  });

  test('accepts one symbol reached through two star exports', () => {
    const conflicts = check([
      fixture('barrel', "export * from './__exports_a.js';\nexport * from './__exports_b.js';"),
      fixture('a', 'export const value = 1;'),
      fixture('b', "export { value } from './__exports_a.js';"),
    ]);
    expect(conflicts).toEqual([]);
  });
});
