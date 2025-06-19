import { PropertyPath, PropertySet, NegatedPropertySet } from '../struct';

export function path(
  pathType: NegatedPropertySet['pathType'],
  items: NegatedPropertySet['items']
): NegatedPropertySet;

export function path(
  pathType: PropertySet['pathType'],
  items: PropertySet['items']
): PropertySet;

export function path(
  pathType: PropertyPath['pathType'],
  items: PropertyPath['items']
): PropertyPath {
  return {
    type: 'path',
    pathType: pathType,
    items: items,
  } as PropertyPath;
}

export function sequence(...items: PropertyPath['items']): PropertyPath {
  return path('/', items);
}
