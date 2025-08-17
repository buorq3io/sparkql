import {
  Term,
  Triple,
  IriTerm,
  QuadTerm,
  QuadGraph,
  QuadObject,
  QuadSubject,
  QuadPredicate,
  TripleSubject,
  TriplePredicate,
  TripleObject,
  Variable,
  BlankTerm,
  LiteralTerm,
  VariableTerm,
  PropertyPath,
  QueryReturnType,
  VariableExpression,
  Expression,
  BaseQueryReturnType,
} from '../generic';
// @ts-ignore
import DataModelFactory from '@rdfjs/data-model';
import { DataFactory, DirectionalLanguage } from '@rdfjs/types';

const factory = DataModelFactory as DataFactory;

type PredicateObjectArray = Array<[TriplePredicate, TripleObject]>;

export function triple(subject: TripleSubject, predicate: TriplePredicate, object: TripleObject): Triple {
  return {
    type: "triple",
    subject: subject,
    predicate: predicate,
    object: object,
  };
}

export function triples(
  subject: TripleSubject,
  predicate: TriplePredicate,
  objects: TripleObject[]
): Triple[];

export function triples(
  subject: TripleSubject,
  predicateObjectList: PredicateObjectArray
): Triple[];

export function triples(
  subject: TripleSubject,
  predicate: TriplePredicate,
  predicateObjectList: PredicateObjectArray
): Triple[];

export function triples(
  subject: TripleSubject,
  arg2: TriplePredicate | PredicateObjectArray,
  arg3?: TripleObject[] | PredicateObjectArray
): Triple[] {
  // @overload 1 -> TripleSubject, PredicateObjectArray
  if (Array.isArray(arg2)) {
    const predicateObjectList = arg2 as PredicateObjectArray;
    return predicateObjectList.map(([predicate, obj]) => triple(subject, predicate, obj));
  }

  function isObjectOrPredicateObjectList(arr: TripleObject[] | PredicateObjectArray): arr is TripleObject[] {
    return !arr.some(value => Array.isArray(value));
  }

  // @overload 2 -> TripleSubject, TriplePredicate, TripleObject[]
  if (arg3 && Array.isArray(arg3) && isObjectOrPredicateObjectList(arg3)) {
    const predicate = arg2 as TriplePredicate;
    return arg3.map(obj => triple(subject, predicate, obj));
  }

  // @overload 3 -> TripleSubject, TriplePredicate, PredicateObjectArray
  if (arg3) {
    const blank_node = blank();
    const predicate = arg2 as TriplePredicate;
    return [
      triple(subject, predicate, blank_node),
      ...arg3.map(p => triple(blank_node, p[0], p[1])),
    ];
  }

  throw new Error('Invalid arguments supplied to triples function.');
}

export function variable(value: string): VariableTerm {
  return factory.variable!(value);
}

export function iri<T extends string>(value: T): IriTerm {
  return factory.namedNode(value);
}

export function blank<T extends string>(value?: T): BlankTerm {
  return factory.blankNode(value);
}

export function literal(value: string, lang?: string | IriTerm | DirectionalLanguage): LiteralTerm {
  return factory.literal(value, lang);
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
  return apply_transform(variable as unknown as Variable<string[]>, transform_array);
}
