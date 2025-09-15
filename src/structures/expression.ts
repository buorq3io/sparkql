import {
  BaseQueryReturnType,
  BlankTerm,
  Expression,
  IriTerm,
  LiteralTerm,
  Presence,
  QualitativeAnonymousBlankTerm,
  QueryReturnType,
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

export function as<T extends QueryReturnType>(
  expression: Expression<T>,
  variableTerm: VariableTerm,
): VariableExpression<T> {
  if (typeof expression === 'object' && 'type' in expression) {
    variableTerm.transform = expression.transform;
  }
  return {
    variable: variableTerm,
    expression: expression,
  };
}

export function apply_transform<T>(
  variable: Variable,
  transform: (self: BaseQueryReturnType, ...other: any[]) => T,
): Variable<T> {
  if ('expression' in variable) {
    if (typeof variable.expression === 'object' && 'type' in variable.expression) {
      variable.expression.transform = transform;
      variable.variable.transform = transform;
    }
  } else {
    variable.transform = transform;
  }
  return variable;
}

export function transformIri(self: BaseQueryReturnType) {
  if ('language' in self) {
    console.warn('W: Wrongful static cast of LiteralTerm to IriTerm');
  }
  return self as IriTerm;
}

export function transformLiteral(self: BaseQueryReturnType) {
  if (!('language' in self)) {
    console.error('W: Wrongful static cast of IriTerm to LiteralTerm');
  }
  return self as LiteralTerm;
}

export function transformBlank(self: BaseQueryReturnType) {
  if (!('language' in self)) {
    console.error('W: Wrongful static cast of BlankTerm to LiteralTerm');
  }
  return self as BlankTerm;
}

export const transformString = (self => self.value) satisfies Transform;

export const transformLangstring = (self =>
  'language' in self ? `'${self.value}'@${self.language}` : self.value) satisfies Transform;

export const transformBigint = (self => BigInt(self.value)) satisfies Transform;

export const transformNumber = (self => parseFloat(self.value)) satisfies Transform;

export const transformBoolean = (self => self.value.toLowerCase() === 'true') satisfies Transform;

export const transformArray = ((self, separator: string = '\u001f') =>
  self.value.split(separator)) satisfies Transform;

export const castIri = createCast(transformIri);
export const castLiteral = createCast(transformLiteral);
export const castBlank = createCast(transformBlank);
export const castString = createCast(transformString);
export const castLangstring = createCast(transformLangstring);
export const castBoolean = createCast(transformBoolean);
export const castNumber = createCast(transformNumber);
export const castBigint = createCast(transformBigint);
export const castArray = createCast(transformArray);

export function createCast<T, K extends any[] = []>(transform: Transform<T, K>) {
  return (variable: Variable, ...other: K) =>
    apply_transform(variable, self => transform(self, ...other));
}

export function always<T>(variable: Variable<T, Presence>): Variable<T> {
  if ('expression' in variable) {
    variable.variable.presence = Presence.required;
  } else {
    variable.presence = Presence.required;
  }
  return variable as Variable<T>;
}

export function maybe<T>(variable: Variable<T>): Variable<T, Presence.optional> {
  const resultVariable: Variable<T, Presence.optional> = variable as any;
  if ('expression' in resultVariable) {
    resultVariable.variable.presence = Presence.optional;
  } else {
    resultVariable.presence = Presence.optional;
  }
  return resultVariable;
}
