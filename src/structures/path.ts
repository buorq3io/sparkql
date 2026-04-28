import {
  PathAlternativeLimitedInput,
  PathInput,
  PathModifiedInput,
  PathNegatedEltInput,
  PathNegatedInput,
  PropertyPathChainInput,
  TermIriInput,
} from '../helpers/types.js';

function path(subtype: '/' | '|', items: PathInput[]): PropertyPathChainInput;
function path(subtype: '?' | '*' | '+' | '^', items: [PathInput]): PathModifiedInput;
function path(
  subtype: '!',
  items: [TermIriInput | PathNegatedEltInput | PathAlternativeLimitedInput]
): PathNegatedInput;
function path(subtype: '/' | '|' | '?' | '*' | '+' | '^' | '!', items: PathInput[]): PathInput {
  return {
    type: 'path',
    subType: subtype,
    items: items,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  } as PathInput;
}

export function seq(...items: PathInput[]) {
  return path('/', items);
}

export function alt(...items: (TermIriInput | PathNegatedEltInput)[]): PathAlternativeLimitedInput;
export function alt(...items: PathInput[]): PropertyPathChainInput;
export function alt(...items: PathInput[]) {
  return path('|', items);
}

export function zeroOrOne(items: PathInput) {
  return path('?', [items]);
}

export function zeroOrMore(items: PathInput) {
  return path('*', [items]);
}

export function oneOrMore(items: PathInput) {
  return path('+', [items]);
}

export function inv(items: TermIriInput): PathNegatedEltInput;
export function inv(items: PathInput): PathModifiedInput;
export function inv(items: PathInput) {
  return path('^', [items]);
}

export function neg(
  items: TermIriInput | PathNegatedEltInput | PathAlternativeLimitedInput
): PathNegatedInput {
  return path('!', [items]);
}
