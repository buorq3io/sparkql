import {
  DefaultQueryReturnType,
  ExpressionInput,
  ObjectInput,
  ObjectColletion,
  PatternBindInput,
  PredicateInput,
  PredicatePairCollection,
  Presence,
  QueryReturnType,
  SubjectInput,
  TermBlankOutput,
  TermIriOutput,
  TermLiteralOutput,
  TermVariableAndBinding,
  TermVariableInput,
  TermVariableTransform,
  TripleCollectionBlankNodePropertiesInput,
  TripleCollectionListInput,
  TripleNestingInput,
  PatternBgpInput,
} from '../helpers/types.js';
import { isObjectLike, tripleCollectionInput } from '../helpers/utilities.js';
import { bgp, bind } from './pattern.js';

const autoLoc = { sourceLocationType: 'autoGenerate' as const };

export function tripleNesting(
  subject: SubjectInput,
  predicate: PredicateInput,
  object: ObjectInput
): TripleNestingInput {
  return {
    type: 'triple',
    loc: autoLoc,
    subject: subject,
    predicate: predicate,
    object: object,
  };
}

export function objects(...obj: ObjectInput[]): ObjectColletion {
  return {
    type: 'syntacticShortcut',
    subType: 'objectCollection',
    values: obj,
  };
}

export function predicates(
  ...obj: [PredicateInput, ObjectInput | ObjectColletion][]
): PredicatePairCollection {
  return {
    type: 'syntacticShortcut',
    subType: 'predicatePairCollection',
    values: obj,
  };
}

export function triples(subject: TripleCollectionListInput): PatternBgpInput;

export function triples(subject: TripleCollectionBlankNodePropertiesInput): PatternBgpInput;

export function triples(
  subject: SubjectInput,
  predicates: PredicatePairCollection
): PatternBgpInput;

export function triples(
  subject: SubjectInput,
  predicate: PredicateInput,
  objects: ObjectColletion
): PatternBgpInput;

export function triples(
  subject: SubjectInput,
  predicate: PredicateInput,
  objects: ObjectInput
): PatternBgpInput;

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
    return bgp(...items)
  }


  if (isObjectLike(object) && object.subType === 'objectCollection') {
    const items = object.values.map(o => {
      return tripleNesting(subject, predicate as any, o); // fix
    });
    return bgp(...items)
  }

  return bgp(tripleNesting(subject, predicate as any, object as any)) // fix
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
