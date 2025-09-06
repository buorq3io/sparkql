import {
  IriTerm,
  Variable,
  BlankTerm,
  LiteralTerm,
  VariableTerm,
  Triple,
  TripleObject,
  TripleSubject,
  TriplePredicate,
  Expression,
  VariableExpression,
  QueryReturnType,
  BaseQueryReturnType,
  TriplesObject,
  TriplesSubject,
  TriplesObjectPairs,
  TriplesPredicatePairs,
  QualitativeAnonymousBlankTerm,
} from '../generic.js';

export function triple(
  subject: TripleSubject,
  predicate: TriplePredicate,
  object: TripleObject
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
  object: TriplesObject
): Triple[];

export function triples(
  subject: TriplesSubject,
  predicate?: TriplePredicate | TriplesPredicatePairs,
  object?: TriplesObject
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
      triples(processedSubject, p, o)
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
  term: TriplesObject
): term is QualitativeAnonymousBlankTerm {
  return Array.isArray(term) && term.length !== 0;
}

function isTriplesPredicatePairs(
  object: TriplesPredicatePairs | TriplePredicate
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
  value: VariableTerm
): VariableExpression<T> {
  return {
    variable: value,
    expression: expression,
  };
}

export function apply_transform<T>(
  variable: Variable<T>,
  transform: (self: BaseQueryReturnType, ...other: any[]) => T
) {
  if ('expression' in variable) {
    if (typeof variable.expression === 'object' && 'type' in variable.expression) {
      variable.expression.transform = transform;
    }
  } else {
    variable.transform = transform;
  }
  return variable;
}

export function transform_iri(self: BaseQueryReturnType) {
  if ('language' in self) {
    console.warn('W: Wrongful static cast of LiteralTerm to IriTerm');
  }
  return self as IriTerm;
}

export function transform_literal(self: BaseQueryReturnType) {
  if (!('language' in self)) {
    console.error('W: Wrongful static cast of IriTerm to LiteralTerm');
  }
  return self as LiteralTerm;
}

export function transform_blank(self: BaseQueryReturnType) {
  if (!('language' in self)) {
    console.error('W: Wrongful static cast of BlankTerm to LiteralTerm');
  }
  return self as BlankTerm;
}

export function transform_string(self: BaseQueryReturnType) {
  return self.value;
}

export function transform_langstring(self: BaseQueryReturnType) {
  return 'language' in self ? `'${self.value}'@${self.language}` : self.value;
}

export function transform_boolean(self: BaseQueryReturnType) {
  return self.value.toLowerCase() === 'true';
}

export function transform_number(self: BaseQueryReturnType) {
  return parseFloat(self.value);
}

export function transform_bigint(self: BaseQueryReturnType) {
  return BigInt(self.value);
}

export function transform_array(self: BaseQueryReturnType, separator: string) {
  return self ? self.value.split(separator) : [];
}

export function cast_iri<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<IriTerm>, transform_iri);
}

export function cast_literal<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<LiteralTerm>, transform_literal);
}

export function cast_blank<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<BlankTerm>, transform_blank);
}

export function cast_string<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<string>, transform_string);
}

export function cast_langstring<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<string>, transform_langstring);
}

export function cast_boolean<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<boolean>, transform_boolean);
}

export function cast_number<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<number>, transform_number);
}

export function cast_bigint<T>(variable: Variable<T>) {
  return apply_transform(variable as unknown as Variable<bigint>, transform_bigint);
}

export function cast_array<T>(variable: Variable<T>, separator: string = '\u001f') {
  return apply_transform(variable as unknown as Variable<string[]>, self =>
    transform_array(self, separator)
  );
}
