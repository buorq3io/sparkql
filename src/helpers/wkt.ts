import type * as AST from '@traqula/rules-sparql-1-1';
import type { ExpressionInput } from './types.js';

const WKT_LITERAL = 'http://www.opengis.net/ont/geosparql#wktLiteral';
const loc = { sourceLocationType: 'autoGenerate' } as const;

/**
 * @internal Sends a string geometry as a `geo:wktLiteral`; stores ignore plain strings in
 * GeoSPARQL functions. Other expressions pass through.
 */
export function wktGeometry(value: ExpressionInput): ExpressionInput {
  if (typeof value !== 'string') return value;
  return {
    type: 'term',
    subType: 'literal',
    loc,
    value,
    langOrIri: { type: 'term', subType: 'namedNode', loc, value: WKT_LITERAL },
  } as AST.TermLiteral;
}
