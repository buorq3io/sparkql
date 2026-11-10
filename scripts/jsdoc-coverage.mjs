// Lists public declarations without a JSDoc comment, or callables whose comment lacks an @example.
// Usage: node scripts/jsdoc-coverage.mjs [files...]   (default: every src/**/*.ts)
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

const files =
  process.argv.length > 2
    ? process.argv.slice(2).map(file => resolve(file))
    : walk(resolve(root, 'src'));

const hasModifier = (node, kind) => (ts.getModifiers?.(node) ?? []).some(m => m.kind === kind);
const isExported = node => hasModifier(node, ts.SyntaxKind.ExportKeyword);
const isHidden = node =>
  // Symbol-keyed members ([entityKind], [Symbol.hasInstance]) are runtime plumbing.
  (node.name && ts.isComputedPropertyName(node.name)) ||
  hasModifier(node, ts.SyntaxKind.PrivateKeyword) ||
  hasModifier(node, ts.SyntaxKind.ProtectedKeyword) ||
  (node.name && ts.isPrivateIdentifier(node.name));

function jsDoc(node) {
  const docs = node.jsDoc ?? [];
  return docs.length ? docs[docs.length - 1].getText() : undefined;
}

let missing = 0;
for (const file of files) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const report = [];

  const check = (node, label, callable) => {
    const doc = jsDoc(node);
    if (doc?.includes('@internal')) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (!doc) report.push(`  ${line}: ${label}  (no comment)`);
    else if (callable && !doc.includes('@example'))
      report.push(`  ${line}: ${label}  (no @example)`);
  };

  // Overloads: only signatures without a body are shown to users when overloads exist.
  const visibleSignatures = (nodes, nameOf) => {
    const groups = new Map();
    for (const node of nodes) {
      const name = nameOf(node);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(node);
    }
    // The first overload carries the example; later ones only need a comment (see the guide).
    return [...groups.values()].flatMap(group =>
      (group.length > 1 ? group.filter(node => !node.body) : group).map((node, index) => ({
        node,
        first: index === 0,
      }))
    );
  };

  const members = (owner, ownerName) => {
    if (jsDoc(owner)?.includes('@internal')) return;
    const callables = owner.members.filter(
      m => (ts.isMethodDeclaration(m) || ts.isMethodSignature(m)) && !isHidden(m)
    );
    for (const { node: m, first } of visibleSignatures(callables, m => m.name.getText())) {
      check(m, `${ownerName}.${m.name.getText()}()`, first);
    }
    for (const m of owner.members) {
      if (isHidden(m)) continue;
      if (ts.isPropertyDeclaration(m) || ts.isPropertySignature(m) || ts.isGetAccessor(m)) {
        if (m.name.getText().startsWith('_')) continue;
        check(m, `${ownerName}.${m.name.getText()}`, false);
      }
    }
  };

  const fns = source.statements.filter(s => ts.isFunctionDeclaration(s) && isExported(s));
  for (const { node: fn, first } of visibleSignatures(fns, fn => fn.name?.getText())) {
    check(fn, `function ${fn.name?.getText()}`, first);
  }
  for (const s of source.statements) {
    if (ts.isClassDeclaration(s) && isExported(s)) {
      check(s, `class ${s.name.getText()}`, false);
      members(s, s.name.getText());
    } else if (ts.isInterfaceDeclaration(s) && isExported(s)) {
      check(s, `interface ${s.name.getText()}`, false);
      members(s, s.name.getText());
    } else if (ts.isTypeAliasDeclaration(s) && isExported(s)) {
      check(s, `type ${s.name.getText()}`, false);
    } else if (ts.isEnumDeclaration(s) && isExported(s)) {
      check(s, `enum ${s.name.getText()}`, false);
    } else if (ts.isVariableStatement(s) && isExported(s)) {
      for (const d of s.declarationList.declarations) {
        check(s, `const ${d.name.getText()}`, false);
      }
    }
  }

  if (report.length) {
    missing += report.length;
    console.log(`${relative(root, file)} (${report.length})`);
    console.log(report.join('\n'));
  }
}
// Example captions (the prose line after `@example`) must say what that example does, so a
// caption used three or more times anywhere in src/ is reported where it occurs in these files.
const captionPattern = /^[ \t]*\*[ \t]*@example[ \t]*\n[ \t]*\*[ \t]*(.+)$/gm;
const captionUses = new Map();
for (const file of walk(resolve(root, 'src'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(captionPattern)) {
    const caption = match[1].trim();
    captionUses.set(caption, (captionUses.get(caption) ?? 0) + 1);
  }
}
let generic = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const report = [];
  for (const match of text.matchAll(captionPattern)) {
    const caption = match[1].trim();
    const uses = captionUses.get(caption) ?? 0;
    if (uses < 3) continue;
    const line = text.slice(0, match.index).split('\n').length + 1;
    report.push(`  ${line}: "${caption}"  (caption used ${uses} times)`);
  }
  if (report.length) {
    generic += report.length;
    console.log(`${relative(root, file)} (${report.length} generic captions)`);
    console.log(report.join('\n'));
  }
}
missing += generic;

console.log(missing ? `\n${missing} missing or generic` : 'All public declarations documented.');
process.exitCode = missing ? 1 : 0;
