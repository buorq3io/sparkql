import { describe, expect, test } from 'vitest';
import { op, func, agg, distinct } from '../../src/functions/utils.js';

describe('expression builders', () => {
  test('op creates an operation expression', () => {
    const e = op('+', [{ type: 'term', termType: 'Literal', value: '1' } as any]);
    expect(e).toMatchObject({ type: 'operation', operator: '+' });
    expect(Array.isArray(e.args)).toBe(true);
  });

  test('func creates a functionCall expression', () => {
    const e = func('STRLEN', [{ type: 'term', termType: 'Variable', value: 'v' } as any]);
    expect(e).toMatchObject({ type: 'functionCall', function: 'STRLEN' });
  });

  test('agg creates an aggregate expression', () => {
    const e = agg({ type: 'term', termType: 'Variable', value: 'v' } as any, 'COUNT');
    expect(e).toMatchObject({ type: 'aggregate', aggregation: 'COUNT' });
    expect('distinct' in e).toBe(false);
  });

  test('distinct marks expressions as distinct', () => {
    const e = distinct(agg({ type: 'term', termType: 'Variable', value: 'v' } as any, 'COUNT'));
    expect((e as any).distinct).toBe(true);
  });
});
