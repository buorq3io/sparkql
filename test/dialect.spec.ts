import { Generator } from '@traqula/generator-sparql-1-1';
import type * as AST from '@traqula/rules-sparql-1-1';
import { describe, expect, expectTypeOf, test } from 'vitest';
import {
  type ArqAST,
  SparqlDatabase as ArqDatabase,
  type ArqInput,
  arqDialect,
  lateral as lateralPattern,
  letBinding,
} from '../src/arq/index.js';
import {
  bgp,
  defineDialect,
  graph,
  group,
  minus,
  optional,
  type QuerySelectInput,
  SparqlDatabase,
  service,
  serviceSilent,
  union,
} from '../src/index.js';

const loc = { sourceLocationType: 'autoGenerate' } as const;
const db = ArqDatabase.create();
const standard = SparqlDatabase.create();
const variable = db.variable('value');
const letValue = letBinding(42, variable);
const lateral = lateralPattern(letValue);

describe('database dialects', () => {
  test('ARQ databases infer options and can also use an explicitly configured dialect', () => {
    class Label {
      constructor(readonly value: string) {}
    }
    const configured = ArqDatabase.create({
      managerConfig: { ex: { uri: 'https://example.org/', fields: ['value'] } },
      formats: {
        literal: [
          {
            test: (value): value is Label => value instanceof Label,
            format: (value, factory) => factory.literal(value.value),
          },
        ],
      },
    })
      .base('https://example.org/')
      .prefix({ ex: 'https://example.org/' });
    const pattern = letBinding(configured.literal(new Label('hello')), variable);
    expect(configured.select().where(pattern).toSPARQL()).toContain('hello');
    const explicit = SparqlDatabase.create({ dialect: arqDialect });
    expect(explicit.select().where(letValue).toSPARQL()).toContain('LET');
  });

  test('normalizes and generates LET and nested LATERAL using patched Traqula rules', () => {
    const query = db.select({ value: variable }).where(optional(lateral));
    const text = query.toSPARQL();
    expect(text).toContain('SELECT ?value');
    expect(text).toContain('OPTIONAL');
    expect(text).toContain('LATERAL');
    expect(text).toContain('LET');
    expect(text).toContain('?value :=');
    expect(text).toContain('42');
    const normalized = query.getSPARQL().where.patterns[0];
    if (normalized.type === 'pattern' && normalized.subType === 'optional') {
      const child = normalized.patterns[0];
      if (child.type === 'pattern' && child.subType === 'lateral') {
        const binding = child.patterns[0];
        if (binding.type === 'pattern' && binding.subType === 'let') {
          expectTypeOf(binding.expression).toEqualTypeOf<AST.Expression>();
          expect(binding.expression.type).toBe('term');
          return;
        }
      }
    }
    throw new Error('Extension nodes were lost during normalization');
  });

  test('preserves dialect across context changes, query kinds, and update chains', () => {
    const scoped = db.base('https://example.org/').prefix({ ex: 'https://example.org/' });
    const builders = [
      scoped.selectDistinct().where(letValue),
      scoped.selectReduced().where(letValue),
      scoped.ask().where(letValue),
      scoped.describe(variable).where(letValue),
      scoped.construct().where(letValue),
      scoped.insert().where(lateral).$end(),
      scoped.with(new URL('https://example.org/graph')).insert().where(letValue).$end(),
      scoped.copyDefault().toDefault().insert().where(letValue).$end(),
    ];
    for (const builder of builders) {
      expect(builder.toSPARQL()).toContain('LET');
    }
    expect(standard.select().where(bgp()).toSPARQL()).toContain('SELECT *');
  });

  test('supports extension nodes in all recursive pattern helpers', () => {
    const iri = new URL('https://example.org/graph');
    const patterns = [
      group(letValue),
      optional(letValue),
      minus(letValue),
      graph(iri, letValue),
      service(iri, letValue),
      serviceSilent(iri, letValue),
      union(group(letValue), group(lateral)),
    ];
    for (const pattern of patterns) expect(db.ask().where(pattern).toSPARQL()).toContain('LET');
  });

  test('normalizes extensions inside SELECT subqueries', () => {
    const subquery: QuerySelectInput<ArqInput> = {
      type: 'query',
      subType: 'select',
      loc,
      context: [],
      variables: [variable],
      datasets: { type: 'datasetClauses', loc, clauses: [] },
      solutionModifiers: {},
      where: group(lateral),
    };
    expect(db.ask().where(group(subquery)).toSPARQL()).toContain('LATERAL');
  });

  test('rejects unregistered nodes at runtime for untyped callers', () => {
    // @ts-expect-error Standard databases reject custom nodes.
    expect(() => standard.select().where(lateral).toSPARQL()).toThrow('Unrecognized pattern');
  });
});

// These checks are compiled by tsc but must not execute.
function typeChecks() {
  expectTypeOf(standard.select().getSPARQL()).toEqualTypeOf<AST.QuerySelect>();
  defineDialect<ArqInput, ArqAST>({
    ...arqDialect,
    // @ts-expect-error A standard generator cannot serialize the extended AST.
    generator: new Generator(),
  });
  // @ts-expect-error Standard databases also reject nested custom nodes.
  standard.ask().where(optional(lateral));
  // @ts-expect-error Unknown extension subtypes are rejected by a configured database.
  db.ask().where({ type: 'pattern', subType: 'unknown', loc });
  // @ts-expect-error A LET expression must have a supported expression type.
  db.select().where({ ...letValue, expression: Symbol('invalid') });
  const query = db.select({ value: variable }).where(letValue).limit(1);
  const standardQuery = standard.select({ value: variable }).where(bgp()).limit(1);
  expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<Awaited<typeof standardQuery>>();
  // @ts-expect-error Fluent method restrictions survive dialect configuration.
  query.where(letValue);
  db.select().$dynamic().where(lateral);
}
void typeChecks;
