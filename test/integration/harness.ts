import { describe, inject } from 'vitest';
import type { DefaultQueryReturnType, SparqlQuad } from '#src/index.js';
import { type DialectName, type Engine, engines, supports } from './engines.js';

/** Prefixes of data/sample.ttl, as sparkql manager configuration. */
export const prefixes = {
  ex: { uri: 'https://example.org/sparkql/', fields: [] },
  foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
  rdf: { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', fields: [] },
  rdfs: { uri: 'http://www.w3.org/2000/01/rdf-schema#', fields: [] },
  xsd: { uri: 'http://www.w3.org/2001/XMLSchema#', fields: [] },
} as const;

/**
 * Runs `body` once per running engine that evaluates `dialect`, inside a
 * `describe` named after the engine. Engines come from the global setup.
 */
export function describeEngines(
  title: string,
  dialect: DialectName,
  body: (engine: Engine) => void
): void {
  const ready = new Set(inject('engines'));
  const targets = engines.filter(engine => ready.has(engine.name) && supports(engine, dialect));
  describe(title, () => {
    if (!targets.length) {
      describe.skip(`no running engine evaluates ${dialect}`, () => {});
      return;
    }
    describe.each(targets)('$name', body);
  });
}

/**
 * The expected result on `engine`: `standard`, unless `deviations` records how
 * that engine knowingly departs from the SPARQL 1.1 result. Note the reason
 * next to each deviation, so the list doubles as documentation of engine quirks.
 */
export function expectedOn<T>(
  engine: Engine,
  standard: T,
  deviations: Readonly<Record<string, T>> = {}
): T {
  return engine.name in deviations ? deviations[engine.name] : standard;
}

const numeric = new Set(
  [
    'integer',
    'decimal',
    'double',
    'float',
    'int',
    'long',
    'short',
    'byte',
    'nonNegativeInteger',
    'positiveInteger',
    'nonPositiveInteger',
    'negativeInteger',
    'unsignedInt',
    'unsignedLong',
    'unsignedShort',
    'unsignedByte',
  ].map(name => `${prefixes.xsd.uri}${name}`)
);

function compactIri(iri: string): string {
  for (const [name, { uri }] of Object.entries(prefixes))
    if (iri.startsWith(uri)) return `${name}:${iri.slice(uri.length)}`;
  return `<${iri}>`;
}

const isTerm = (value: unknown): value is DefaultQueryReturnType =>
  typeof value === 'object' && value !== null && 'termType' in value;

/**
 * A comparable form of a result value, so expectations stay short and engines
 * that spell the same value differently compare equal:
 *
 * - IRIs: `ex:alice`, or `<iri>` outside the known prefixes
 * - numeric literals: a JS number, whatever the XSD numeric type (QLever
 *   reports `COUNT` as `xsd:int`, others as `xsd:integer`) or lexical form
 *   (`1.60` vs `1.6`)
 * - `xsd:boolean`: a JS boolean
 * - `xsd:string`: `"text"`; language strings: `"text"@en`
 * - other literals: `"lexical"^^xsd:date`
 * - blank nodes: `_:` (labels are engine-specific)
 * - values sparkql already decoded (numbers, strings, dates): unchanged
 */
export function simplify(value: unknown): unknown {
  if (!isTerm(value)) return value;
  switch (value.termType) {
    case 'NamedNode':
      return compactIri(value.value);
    case 'BlankNode':
      return '_:';
    case 'Literal': {
      const datatype = value.datatype.value;
      if (value.language) return `${JSON.stringify(value.value)}@${value.language.toLowerCase()}`;
      if (numeric.has(datatype)) return Number(value.value);
      if (datatype === `${prefixes.xsd.uri}boolean`)
        return value.value === 'true' || value.value === '1';
      if (datatype === `${prefixes.xsd.uri}string`) return JSON.stringify(value.value);
      return `${JSON.stringify(value.value)}^^${compactIri(datatype)}`;
    }
  }
}

/** {@link simplify} applied to every value of every row; unbound variables are dropped. */
export function rows(results: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return results.map(row =>
    Object.fromEntries(
      Object.entries(row)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, simplify(value)])
    )
  );
}

const stable = (value: unknown) => JSON.stringify(value);

/** {@link rows} in a canonical order, for queries without ORDER BY. */
export function unorderedRows(results: readonly Record<string, unknown>[]): unknown[] {
  return rows(results)
    .map(row => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))
    .sort((a, b) => stable(a).localeCompare(stable(b)));
}

/** Quads as sorted `[subject, predicate, object]` triples of simplified terms. */
export function triplesOf(quads: readonly SparqlQuad[]): unknown[][] {
  return quads
    .map(quad => [quad.subject, quad.predicate, quad.object].map(simplify))
    .sort((a, b) => stable(a).localeCompare(stable(b)));
}
