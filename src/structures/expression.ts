import {
  BaseIriTerm,
  BaseBlankTerm,
  BaseLiteralTerm,
  BaseQueryReturnType,
  Expression,
  Presence,
  QualitativeAnonymousBlankTerm,
  Transform,
  Triple,
  TripleObject,
  TriplePredicate,
  TriplesObject,
  TriplesObjectPairs,
  TriplesPredicatePairs,
  TriplesSubject,
  TripleSubject,
  Variable,
  VariableExpression,
  VariableTerm,
} from '../generic.js';

export function triple(
  subject: TripleSubject,
  predicate: TriplePredicate,
  object: TripleObject,
): Triple {
  return {
    type: 'triple',
    subject: subject,
    predicate: predicate,
    object: object,
  };
}

export function objects(...obj: TriplesObject[]): TriplesObjectPairs {
  return {
    type: 'triplesobjectpairs',
    values: obj,
  };
}

export function predicates(...obj: [TriplePredicate, TriplesObject][]): TriplesPredicatePairs {
  return {
    type: 'triplespredicatepairs',
    values: obj,
  };
}

export function triples(subject: QualitativeAnonymousBlankTerm): Triple[];

export function triples(subject: TriplesSubject, predicate: TriplesPredicatePairs): Triple[];

export function triples(
  subject: TriplesSubject,
  predicate: TriplePredicate,
  object: TriplesObject,
): Triple[];

export function triples(
  subject: TriplesSubject,
  predicate?: TriplePredicate | TriplesPredicatePairs,
  object?: TriplesObject,
) {
  function processTerm(term: TriplesSubject): [TripleSubject, Triple[]];
  function processTerm(term: TriplesObject): [TripleObject, Triple[]];

  function processTerm(term: TriplesObject): [TripleObject, Triple[]] {
    if (isQualitativeAnonymousBlankTerm(term)) {
      // Recursively call the main function to expand this blank node's properties
      const extraTriples = triples(term);
      return [extraTriples[0].subject, extraTriples];
    }
    return [term as any, []];
  }

  // Overload 1: triples2(QualitativeAnonymousBlankTerm)
  if (arguments.length === 1 && isQualitativeAnonymousBlankTerm(subject)) {
    const bnode = Symbol();
    const predicateOrPairs = subject[0];
    if (isTriplesPredicatePairs(predicateOrPairs)) {
      return triples(bnode, predicateOrPairs);
    } else {
      const obj = subject[1] as any;
      return triples(bnode, predicateOrPairs, obj);
    }
  }

  const [processedSubject, subjectTriples] = processTerm(subject);

  // Overload 2: triples2(subject, TriplesPredicatePairs)
  if (arguments.length === 2 && isTriplesPredicatePairs(predicate!)) {
    const predicateObjectTriples = predicate.values.flatMap(([p, o]) =>
      // Recurse for each predicate-object pair
      triples(processedSubject, p, o),
    );
    return [...predicateObjectTriples, ...subjectTriples];
  }

  // Overload 3: triples2(subject, predicate, object)
  if (arguments.length === 3 && predicate && object !== undefined) {
    const objects = isTriplesObjectPairs(object) ? object.values : [object];
    const resultTriples: Triple[] = [];

    for (const obj of objects) {
      const [processedObject, objectTriples] = processTerm(obj);
      resultTriples.push(triple(processedSubject, predicate as TriplePredicate, processedObject));
      resultTriples.push(...objectTriples);
    }
    return [...resultTriples, ...subjectTriples];
  }

  // Should not be reached if called correctly
  throw new Error('Invalid arguments for `triples()` function');
}

function isQualitativeAnonymousBlankTerm(
  term: TriplesObject,
): term is QualitativeAnonymousBlankTerm {
  return Array.isArray(term) && term.length !== 0;
}

function isTriplesPredicatePairs(
  object: TriplesPredicatePairs | TriplePredicate,
): object is TriplesPredicatePairs {
  return (
    typeof object === 'object' &&
    'type' in object &&
    object.type === 'triplespredicatepairs' &&
    'values' in object &&
    Array.isArray(object.values)
  );
}

function isTriplesObjectPairs(object: TriplesObject): object is TriplesObjectPairs {
  return (
    typeof object === 'object' &&
    'type' in object &&
    object.type === 'triplesobjectpairs' &&
    'values' in object &&
    Array.isArray(object.values)
  );
}

export function transformIri(self: BaseQueryReturnType): BaseIriTerm {
  if (self.termType === 'NamedNode') return self;
  return {termType: 'NamedNode', value: self.value, equals: self.equals};
}

export function transformLiteral(self: BaseQueryReturnType): BaseLiteralTerm {
  if (self.termType === 'Literal') return self;

  return {
    ...self,
    language: '',
    termType: 'Literal',
    datatype: {
      termType: 'NamedNode',
      value: 'http://www.w3.org/2001/XMLSchema#string',
      equals: self.equals},
  };
}

export function transformBlank(self: BaseQueryReturnType): BaseBlankTerm {
  if (self.termType === 'BlankNode') return self;
  return { termType: 'BlankNode', value: self.value, equals: self.equals};
}

export const transformString = (self => self.value) satisfies Transform;

export const transformLangstring = (self =>
  'language' in self ? `'${self.value}'@${self.language}` : self.value) satisfies Transform;

export const transformBigint = (self => BigInt(self.value)) satisfies Transform;

export const transformNumber = (self => parseFloat(self.value)) satisfies Transform;

export const transformBoolean = (self => self.value.toLowerCase() === 'true') satisfies Transform;

export const transformArray = ((self, separator: string = '\u001f') =>
  self.value.split(separator)) satisfies Transform;

export const transformDate = (self => new Date(self.value)) satisfies Transform;

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
export const castUndefinedString = createCast((self) => self.value as string | undefined);

export function as<R1>(
  expression: Expression<R1>,
  variableTerm: VariableTerm<any, Presence>
): VariableExpression<R1> {
  const newTerm = { ...variableTerm } as VariableTerm<R1>;
  if (typeof expression === 'object' && 'type' in expression) {
    newTerm.transform = expression.transform;
  }
  return {
    variable: newTerm,
    expression: expression,
  };
}

export function applyTransform<R1, R2, P extends Presence>(
  variable: Variable<R1, P>,
  transform: Transform<R2>
): Variable<R2, P> {
  const newTerm = { ...variable } as Variable<R2, P>;
  if ('expression' in newTerm) {
    if (typeof newTerm.expression === 'object' && 'type' in newTerm.expression) {
      newTerm.expression.transform = transform;
      newTerm.variable.transform = transform;
    }
  } else {
    newTerm.transform = transform;
  }
  return newTerm;
}

export function createCast<R1, O extends any[] = []>(transform: Transform<R1, O>) {
  return <R2, P extends Presence>(variable: Variable<R2, P>, ...other: O) =>
    applyTransform(variable, self => transform(self, ...other));
}

export function always<T>(variable: Variable<T, Presence>): Variable<T> {
  if ('expression' in variable) {
    variable.variable.presence = Presence.required;
  } else {
    variable.presence = Presence.required;
  }
  return variable as Variable<T>;
}

export function maybe<T>(variable: Variable<T, Presence>): Variable<T, Presence.optional> {
  const resultVariable: Variable<T, Presence.optional> = variable as any;
  if ('expression' in resultVariable) {
    resultVariable.variable.presence = Presence.optional;
  } else {
    resultVariable.presence = Presence.optional;
  }
  return resultVariable;
}
