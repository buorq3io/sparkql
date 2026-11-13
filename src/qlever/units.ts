import type * as AST from '@traqula/rules-sparql-1-1';
import { SparkqlError } from '../database/errors.js';

/** The QUDT unit namespace QLever reads units from, written `unit:`. */
export const UNIT_NAMESPACE = 'http://qudt.org/vocab/unit/';

/**
 * A length unit, by its QUDT name: metres (`M`), kilometres (`KiloM`), miles (`MI`), feet
 * (`FT`) or yards (`YD`).
 */
export type LengthUnit = 'M' | 'KiloM' | 'MI' | 'FT' | 'YD';

/**
 * An area unit, by its QUDT name: square metres (`M2`), square kilometres (`KiloM2`), square
 * miles (`MI2`), square feet (`FT2`), square yards (`YD2`), acres (`AC`), ares (`ARE`) or
 * hectares (`HA`).
 */
export type AreaUnit = 'M2' | 'KiloM2' | 'MI2' | 'FT2' | 'YD2' | 'AC' | 'ARE' | 'HA';

const units = {
  length: ['M', 'KiloM', 'MI', 'FT', 'YD'],
  area: ['M2', 'KiloM2', 'MI2', 'FT2', 'YD2', 'AC', 'ARE', 'HA'],
} as const;

const loc = { sourceLocationType: 'autoGenerate' } as const;

/** @internal The QUDT IRI of a unit name, checked against the units QLever accepts. */
export function unitIri(name: LengthUnit | AreaUnit, kind: keyof typeof units): AST.TermIri {
  if (!(units[kind] as readonly string[]).includes(name)) {
    throw new SparkqlError({
      message: `QLever: unknown ${kind} unit "${String(name)}"; use ${units[kind].join(', ')}.`,
    });
  }
  return {
    type: 'term',
    subType: 'namedNode',
    loc,
    value: `${UNIT_NAMESPACE}${name}`,
  } as AST.TermIri;
}
