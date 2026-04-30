import * as AST from '@traqula/rules-sparql-1-1';
import { tripleNesting } from '../index.mjs';
import { Formatter } from './generators.js';
import {
    FactoryFunctions,
  GraphNodeInput,
  TripleCollectionBlankNodePropertiesInputBase,
  TripleCollectionBlankNodePropertiesInputSyntax,
  TripleCollectionListInputBase,
  TripleCollectionListInputSyntax,
  TripleNestingInput,
} from './types.js';
import { isObjectLike, term, termGraph } from './utilities.js';

export function isGraphNodeInput(value: unknown): value is GraphNodeInput {
  return (
    (isObjectLike(value) && value.type === 'tripleCollection') ||
    isTripleCollectionListInputSyntax(value) ||
    isTripleCollectionBlankNodePropertiesInputSyntax(value) ||
    term.accepts(value)
  );
}

export function isTripleCollectionListInputSyntax(
  value: unknown
): value is TripleCollectionListInputSyntax {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    Array.isArray(value[0]) &&
    value[0].every((v: any) => isGraphNodeInput(v))
  );
}

export function formatTripleCollectionListInputSyntax(
  value: TripleCollectionListInputSyntax,
  factory: FactoryFunctions
): TripleCollectionListInputBase {
  const nodes = value[0];
  const tripleNestings: TripleNestingInput[] = [];

  const id = factory.blank();
  let prev: AST.TermBlank | AST.TermIriFull = id;
  for (let [index, node] of nodes.entries()) {
    tripleNestings.push(
      tripleNesting(prev, factory.iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'), node)
    );
    const next =
      index === nodes.length - 1
        ? factory.iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')
        : factory.blank();
    tripleNestings.push(
      tripleNesting(prev, new URL('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'), next)
    );
    prev = next;
  }

  return {
    type: 'tripleCollection',
    subType: 'list',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    identifier: id,
    triples: tripleNestings,
  };
}

export function isTripleCollectionBlankNodePropertiesInputSyntax(
  value: unknown
): value is TripleCollectionBlankNodePropertiesInputSyntax {
  return (
    Array.isArray(value) &&
    ((value.length === 1 &&
      isObjectLike(value[0]) &&
      value[0].subType === 'predicatePairCollection') ||
      (value.length === 2 &&
        (termGraph.accepts(value[0]) || value[0].type === 'path') &&
        ((isObjectLike(value[1]) && value[1].subType === 'objectCollection') ||
          isGraphNodeInput(value[1]))))
  );
}

export function formatTripleCollectionBlankNodePropertiesInputSyntax(
  value: TripleCollectionBlankNodePropertiesInputSyntax,
  factory: FactoryFunctions
): TripleCollectionBlankNodePropertiesInputBase {
  const source = factory.blank();

  if (isObjectLike(value[0]) && value[0].subType == 'predicatePairCollection') {
    const items = value[0].values.flatMap(v => {
      if (isObjectLike(v[1]) && v[1].subType === 'objectCollection') {
        return v[1].values.map(o => {
          return tripleNesting(source, v[0], o);
        });
      }
      return tripleNesting(source, v[0], v[1]);
    });

    return {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      identifier: source,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      triples: items,
    };
  }

  if (isObjectLike(value[1]) && value[1].subType === 'objectCollection') {
    const items = value[1].values.map(o => {
      return tripleNesting(source, value[0] as any, o); // fix
    });

    return {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      identifier: source,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      triples: items,
    };
  }

  return {
    type: 'tripleCollection',
    subType: 'blankNodeProperties',
    identifier: source,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    triples: [tripleNesting(source, value[0], value[1] as any)],
  };
}

export function createTripleCollectionListInputSyntaxFormatter(): Formatter<
  TripleCollectionListInputSyntax,
  TripleCollectionListInputBase
> {
  return {
    format: formatTripleCollectionListInputSyntax,
    test: isTripleCollectionListInputSyntax,
  };
}

export function createTripleCollectionBlankNodePropertiesInputSyntaxFormatter(): Formatter<
  TripleCollectionBlankNodePropertiesInputSyntax,
  TripleCollectionBlankNodePropertiesInputBase
> {
  return {
    format: formatTripleCollectionBlankNodePropertiesInputSyntax,
    test: isTripleCollectionBlankNodePropertiesInputSyntax,
  };
}
