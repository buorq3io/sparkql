import {
  IriTerm,
  PropertySet,
  PropertyPath,
  NegatedPropertySet,
} from '../struct';

export function path(
  pathType: '!',
  items: (IriTerm | InvPropertyPath<IriTerm>)[]
): NegatedPropertySet;

export function path(
  pathType: '|' | '/' | '^' | '+' | '*' | '?',
  items: (IriTerm | PropertyPath)[]
): PropertySet;

export function path(
  pathType: '|' | '/' | '^' | '+' | '*' | '?' | '!',
  items: (IriTerm | PropertyPath)[] | (IriTerm | InvPropertyPath<IriTerm>)[]
): PropertyPath {
  return {
    type: 'path',
    pathType: pathType,
    items: items,
  } as PropertyPath;
}

export function seq(...items: (IriTerm | PropertyPath)[]) {
  return path('/', items);
}

export function alt(...items: (IriTerm | PropertyPath)[]) {
  return path('|', items);
}

type InvPropertyPath<T extends IriTerm | PropertyPath> = {
  type: 'path';
  pathType: '^';
  items: [T];
};

export function inv<T extends IriTerm>(item: T): InvPropertyPath<T>;
export function inv<T extends PropertyPath>(item: T): InvPropertyPath<T>;
export function inv(item: IriTerm | PropertySet) {
  return path('^', [item]);
}

export function zeroOrMore(item: IriTerm | PropertyPath): PropertySet {
  return path('*', [item]);
}

export function oneOrMore(item: IriTerm | PropertyPath): PropertySet {
  return path('+', [item]);
}

export function zeroOrOne(item: IriTerm | PropertyPath): PropertySet {
  return path('?', [item]);
}

export function neg(
  ...items: (IriTerm | InvPropertyPath<IriTerm>)[]
): NegatedPropertySet {
  return path('!', items);
}
