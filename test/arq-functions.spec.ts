import { describe, expect, expectTypeOf, test } from 'vitest';
import { Parser } from '@traqula/parser-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import {
  SparqlDatabase,
  mod,
  idiv,
  collation,
  as,
  add,
  eq,
  filter,
  desc,
  letBinding,
  lateral,
  values,
  type ExpressionOperationInput,
  type ExpressionFunctionCallInput,
  type TermLiteralOutput,
} from '../src/arq/index.js';

const db = SparqlDatabase.create();
const value = db.variable('value');
const label = db.variable('label');
const rdf = new DataFactory();
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('ARQ expression helpers', () => {
  test('generates nested MOD and IDIV calls in projections, filters, and LET', () => {
    const query = db
      .select({
        remainder: as(mod(value, 3), db.variable('remainder')),
        quotient: as(idiv(add(value, 1), 2), db.variable('quotient')),
      })
      .where(
        lateral(letBinding(idiv(mod(-17.5, 5), 2), value)),
        filter(eq(mod(idiv(value, 2), 3), 1))
      );
    const text = compact(query.toSPARQL());
    expect(text).toContain('MOD( ?value ,');
    expect(text).toContain('IDIV( ( ?value +');
    expect(text).toContain('LET (?value := IDIV( MOD(');
    expect(text).toContain('"-17.5"^^<http://www.w3.org/2001/XMLSchema#decimal>');
    expect(text).toContain('FILTER ( ( MOD( IDIV(');
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<
      { remainder: number; quotient: number }[]
    >();
    expect(mod(value, 3).transform?.(rdf.literal('-2'))).toBe(-2);
    expect(idiv(value, 3).transform?.(rdf.literal('-5'))).toBe(-5);
  });

  test('supports arithmetic calls in GROUP BY, HAVING, and ORDER BY', () => {
    const query = db
      .select()
      .where(values({ value: [1, 2, 3] }))
      .groupBy(mod(value, 2))
      .having(eq(idiv(value, 2), 1))
      .orderBy(desc(idiv(value, 2)));
    const text = compact(query.toSPARQL());
    expect(text).toContain('GROUP BY MOD(');
    expect(text).toContain('HAVING ( IDIV(');
    expect(text).toContain('ORDER BY DESC ( IDIV(');
  });

  test('generates collation with the full ARQ IRI and normalizes locale literals', () => {
    const query = db
      .select({ label })
      .where(values({ label: ['töyhtöhyyppä', 'tsahurin kieli'] }))
      .orderBy(desc(collation('fi', label)));
    const text = compact(query.toSPARQL());
    expect(text).toContain(
      'ORDER BY DESC ( <http://jena.apache.org/ARQ/function#collation> ( "fi" , ?label ) )'
    );
    // Collation uses ordinary SPARQL function-call syntax; no prefix is required.
    expect(() => new Parser().parse(query.toSPARQL())).not.toThrow();
    const expression = query.getSPARQL().solutionModifiers.order!.orderDefs[0].expression;
    if (expression.type !== 'expression' || expression.subType !== 'functionCall') {
      throw new Error('Expected a collation function call');
    }
    expect(expression.args[0]).toMatchObject({ type: 'term', subType: 'literal', value: 'fi' });
  });

  test('allows expression-valued locales and safely escapes literal locales', () => {
    const text = db
      .select()
      .where()
      .orderBy(collation(db.variable('locale'), label))
      .toSPARQL();
    expect(compact(text)).toContain('( ?locale , ?label )');
    const escaped = db.select().where().orderBy(collation('fi"\\locale', label)).toSPARQL();
    expect(() => new Parser().parse(escaped)).not.toThrow();
    expect(escaped).toContain('fi\\"\\\\locale');
  });
});

function typeChecks() {
  expectTypeOf(mod(5, 2)).toEqualTypeOf<ExpressionOperationInput<number>>();
  expectTypeOf(idiv(5, 2)).toEqualTypeOf<ExpressionOperationInput<number>>();
  expectTypeOf(collation('fi', label)).toEqualTypeOf<
    ExpressionFunctionCallInput<TermLiteralOutput>
  >();
  // @ts-expect-error MOD requires two arguments.
  mod(1);
  // @ts-expect-error IDIV requires two arguments.
  idiv(1);
  // @ts-expect-error IDIV accepts exactly two arguments.
  idiv(1, 2, 3);
  // @ts-expect-error Unsupported operand types are rejected.
  mod(Symbol('invalid'), 2);
  // @ts-expect-error Collation requires a locale and an expression.
  collation('fi');
  // @ts-expect-error Unsupported locales are rejected.
  collation({}, label);
}
void typeChecks;
