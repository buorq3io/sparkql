import type { MergePlaceholders, PlaceholderCarrier } from '../database/prepared.js';
import type { TermCodec } from '../helpers/codecs.js';
import {
  type DefaultQueryReturnType,
  type ExpressionInput,
  type GraphQuadsInput,
  type ObjectColletion,
  type ObjectInput,
  type PatternBgpInput,
  type PatternBindInput,
  type PredicateInput,
  type PredicatePairCollection,
  Presence,
  type QueryReturnType,
  type SubjectInput,
  type TermBlankOutput,
  type TermIriInput,
  type TermIriOutput,
  type TermLiteralOutput,
  type TermVariableAndBinding,
  type TermVariableInput,
  type TermVariableTransform,
  type TripleCollectionBlankNodePropertiesInput,
  type TripleCollectionListInput,
  type TripleNestingInput,
} from '../helpers/types.js';
import { isObjectLike, tripleCollectionInput } from '../helpers/utilities.js';
import { bgp, bind } from './pattern.js';

const autoLoc = { sourceLocationType: 'autoGenerate' as const };

export function tripleNesting<
  S extends SubjectInput,
  P extends PredicateInput,
  O extends ObjectInput,
>(
  subject: S,
  predicate: P,
  object: O
): TripleNestingInput<S, P, O> & PlaceholderCarrier<MergePlaceholders<S | P | O>> {
  return {
    type: 'triple',
    loc: autoLoc,
    subject: subject,
    predicate: predicate,
    object: object,
  } as TripleNestingInput<S, P, O> & PlaceholderCarrier<MergePlaceholders<S | P | O>>;
}

export function objects<const O extends ObjectInput[]>(
  ...obj: O
): ObjectColletion & PlaceholderCarrier<MergePlaceholders<O[number]>> {
  return {
    type: 'syntacticShortcut',
    subType: 'objectCollection',
    values: obj,
  } as ObjectColletion & PlaceholderCarrier<MergePlaceholders<O[number]>>;
}

export function predicates<const P extends [PredicateInput, ObjectInput | ObjectColletion][]>(
  ...obj: P
): PredicatePairCollection & PlaceholderCarrier<MergePlaceholders<P[number][number]>> {
  return {
    type: 'syntacticShortcut',
    subType: 'predicatePairCollection',
    values: obj,
  } as PredicatePairCollection & PlaceholderCarrier<MergePlaceholders<P[number][number]>>;
}

export function triples<
  const Args extends
    | [TripleCollectionListInput]
    | [TripleCollectionBlankNodePropertiesInput]
    | [SubjectInput, PredicatePairCollection]
    | [SubjectInput, PredicateInput, ObjectColletion | ObjectInput],
>(...args: Args): PatternBgpInput & PlaceholderCarrier<MergePlaceholders<Args[number]>>;

export function triples(
  subject: SubjectInput,
  predicate?: PredicatePairCollection | PredicateInput,
  object?: ObjectColletion | ObjectInput
): PatternBgpInput {
  if (tripleCollectionInput.accepts(subject) && predicate === undefined && object === undefined) {
    return bgp(subject);
  }

  if (
    isObjectLike(predicate) &&
    predicate.subType === 'predicatePairCollection' &&
    object === undefined
  ) {
    const items = predicate.values.flatMap(v => {
      if (isObjectLike(v[1]) && v[1].subType === 'objectCollection') {
        return v[1].values.map(o => {
          return tripleNesting(subject, v[0], o);
        });
      }
      return tripleNesting(subject, v[0], v[1]);
    });
    return bgp(...items);
  }

  if (isObjectLike(object) && object.subType === 'objectCollection') {
    const items = object.values.map(o => {
      return tripleNesting(subject, predicate as any, o); // fix
    });
    return bgp(...items);
  }

  return bgp(tripleNesting(subject, predicate as any, object as any)); // fix
}

export function quads(
  graph: TermIriInput | TermVariableInput,
  ...patterns: PatternBgpInput[]
): GraphQuadsInput {
  return {
    type: 'graph',
    graph: graph,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    triples: bgp(...patterns.flatMap(p => p.triples)),
  };
}

export function transformIri(self: DefaultQueryReturnType): TermIriOutput {
  if (self.termType === 'NamedNode') return self;
  return { termType: 'NamedNode', value: self.value, equals: self.equals };
}

export function transformLiteral(self: DefaultQueryReturnType): TermLiteralOutput {
  if (self.termType === 'Literal') return self;

  return {
    ...self,
    direction: '',
    language: '',
    termType: 'Literal',
    equals: self.equals,
    datatype: {
      termType: 'NamedNode',
      value: 'http://www.w3.org/2001/XMLSchema#string',
      equals: self.equals,
    },
  };
}

export function transformBlank(self: DefaultQueryReturnType): TermBlankOutput {
  if (self.termType === 'BlankNode') return self;
  return { termType: 'BlankNode', value: self.value, equals: self.equals };
}

export const transformString = (self => self.value) satisfies TermVariableTransform;

export const transformLangstring = (self =>
  'language' in self
    ? `'${self.value}'@${self.language}`
    : self.value) satisfies TermVariableTransform;

export const transformBigint = (self => BigInt(self.value)) satisfies TermVariableTransform;

export const transformNumber = (self => parseFloat(self.value)) satisfies TermVariableTransform;

export const transformBoolean = (self =>
  self.value.toLowerCase() === 'true') satisfies TermVariableTransform;

export const transformArray = ((self, separator: string = '\u001f') =>
  self.value.split(separator)) satisfies TermVariableTransform;

export const transformDate = (self => new Date(self.value)) satisfies TermVariableTransform;

export const castIri = createCast(transformIri);
export const castLiteral = createCast(transformLiteral);
export const castBlank = createCast(transformBlank);
export const castString = createCast(transformString);
export const castLangstring = createCast(transformLangstring);
export const castBoolean = createCast(transformBoolean);
export const castNumber = createCast(transformNumber);
export const castBigint = createCast(transformBigint);
export const castArray = createCast(transformArray);
export const castDate = createCast(transformDate);

export function as<R1 extends QueryReturnType>(
  expression: ExpressionInput<R1>,
  variableTerm: TermVariableInput<any, Presence>
): PatternBindInput<R1> {
  const newTerm = { ...variableTerm } as TermVariableInput<R1>;
  if (typeof expression === 'object' && 'transform' in expression) {
    newTerm.transform = expression.transform;
  }
  return bind(expression, newTerm);
}

export function applyTransform<R1, R2 extends QueryReturnType, P extends Presence>(
  variable: TermVariableAndBinding<R1, P>,
  transform: TermVariableTransform<R2>
): TermVariableAndBinding<R2, P> {
  const newTerm = { ...variable } as TermVariableAndBinding<R2, P>;
  if (newTerm.type === 'pattern') {
    if (typeof newTerm.expression === 'object' && 'transform' in newTerm.expression) {
      newTerm.expression.transform = transform;
      newTerm.variable.transform = transform;
    }
  } else {
    newTerm.transform = transform;
  }
  return newTerm;
}

export function createCast<R1 extends QueryReturnType, O extends any[] = []>(
  transform: TermVariableTransform<R1, O>
) {
  return <R2, P extends Presence>(variable: TermVariableAndBinding<R2, P>, ...other: O) =>
    applyTransform(variable, self => transform(self, ...other));
}

/**
 * Casts a variable with a codec's decoder, e.g. `castWith(codecs[xsd.dateTime], v.born)`,
 * so one codec definition gives both the runtime value and the static type.
 * Like every `castX`, it wins over the database's codec table.
 */
export function castWith<O, R2, P extends Presence>(
  codec: TermCodec<O, any>,
  variable: TermVariableAndBinding<R2, P>
): TermVariableAndBinding<O, P> {
  const decode = codec.decode;
  if (!decode) throw new Error('castWith needs a codec with a decoder.');
  return applyTransform(variable, self => decode(self));
}

export function always<T>(
  variable: TermVariableAndBinding<T, Presence>
): TermVariableAndBinding<T> {
  if (variable.type === 'pattern') {
    variable.variable.presence = Presence.required;
  } else {
    variable.presence = Presence.required;
  }
  return variable as TermVariableAndBinding<T>;
}

export function maybe<T>(
  variable: TermVariableAndBinding<T, Presence>
): TermVariableAndBinding<T, Presence.optional> {
  const resultVariable: TermVariableAndBinding<T, Presence.optional> = variable as any;
  if (resultVariable.type === 'pattern') {
    resultVariable.variable.presence = Presence.optional;
  } else {
    resultVariable.presence = Presence.optional;
  }
  return resultVariable;
}
