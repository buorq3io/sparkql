import {
  Term,
  Triple,
  IriTerm,
  QuadTerm,
  QuadGraph,
  QuadObject,
  QuadSubject,
  QuadPredicate,
  Variable,
  BlankTerm,
  LiteralTerm,
  VariableTerm,
  PropertyPath,
  TermOrPrimitive,
  VariableExpression,
  VariableReturnType,
  ExpressionOrPrimitive,
} from '../generic';
// @ts-ignore
import DataModelFactory from '@rdfjs/data-model';
import { DataFactory, DirectionalLanguage } from '@rdfjs/types';

const factory = DataModelFactory as DataFactory;

export function processPrimitiveExpression(e: ExpressionOrPrimitive) {
  if (typeof e !== 'object') {
    return processPrimitiveTerm(e);
  }
  return e;
}

export function processPrimitiveTerm<T extends TermOrPrimitive>(
  t: T
): T extends Term ? T : LiteralTerm {
  const urls = {
    integer: 'http://www.w3.org/2001/XMLSchema#integer',
    float: 'http://www.w3.org/2001/XMLSchema#decimal',
    bigint: 'http://www.w3.org/2001/XMLSchema#integer',
    boolean: 'http://www.w3.org/2001/XMLSchema#boolean',
  };

  if (typeof t === 'number') {
    if (Number.isInteger(t)) {
      return literal(t.toString(), iri(urls['integer'])) as any;
    } else {
      return literal(t.toString(), iri(urls['float'])) as any;
    }
  } else if (typeof t === 'bigint') {
    return literal(t.toString(), iri(urls['integer'])) as any;
  } else if (typeof t === 'boolean') {
    return literal(t ? 'true' : 'false', iri(urls['boolean'])) as any;
  } else if (typeof t === 'string') {
    return literal(t) as any;
  }

  return t as any;
}

type Subject = IriTerm | BlankTerm | VariableTerm;
type Predicate = IriTerm | VariableTerm | PropertyPath;
type Object = TermOrPrimitive;
type PredicateObjectArray = Array<[Predicate, Object]>;

export function triple(
  subject: Subject,
  predicate: Predicate,
  object: Object
): Triple {
  return {
    subject: subject,
    predicate: predicate,
    object: processPrimitiveTerm(object),
  };
}

export function triples(
  subject: Subject,
  predicate: Predicate,
  objects: Object[]
): Triple[];

export function triples(
  subject: Subject,
  predicateObjectList: PredicateObjectArray
): Triple[];

// TODO: FIX FACTORY BEHAVIOR
export function triples(
  subject: Subject,
  predicate: Predicate,
  predicateObjectList: PredicateObjectArray
): Triple[];

export function triples(
  subject: Subject,
  arg2: Predicate | PredicateObjectArray,
  arg3?: Object[] | PredicateObjectArray
): Triple[] {
  // @overload 1 -> Subject, PredicateObjectArray
  if (Array.isArray(arg2)) {
    const predicateObjectList = arg2 as PredicateObjectArray;
    return predicateObjectList.map(([predicate, obj]) =>
      triple(subject, predicate, obj)
    );
  }

  function isObjectOrPredicateObjectList(
    arr: Object[] | PredicateObjectArray
  ): arr is Object[] {
    return !arr.some(value => Array.isArray(value));
  }

  // @overload 2 -> Subject, Predicate, Object[]
  if (arg3 && Array.isArray(arg3) && isObjectOrPredicateObjectList(arg3)) {
    const predicate = arg2 as Predicate;
    return arg3.map(obj => triple(subject, predicate, obj));
  }

  // @overload 3 -> Subject, Predicate, PredicateObjectArray
  if (arg3) {
    const blank_node = blank();
    const predicate = arg2 as Predicate;
    return [
      triple(subject, predicate, blank_node),
      ...arg3.map(p => triple(blank_node, p[0], p[1])),
    ];
  }

  // Throw an error for invalid arguments to ensure type safety
  throw new Error('Invalid arguments supplied to triples function.');
}

export function quad(
  subject: QuadSubject,
  predicate: QuadPredicate,
  object: QuadObject,
  graph?: QuadGraph
): QuadTerm {
  return factory.quad(subject, predicate, processPrimitiveTerm(object), graph);
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

export function literal(
  value: string,
  lang?: string | IriTerm | DirectionalLanguage
): LiteralTerm {
  return factory.literal(value, lang);
}

export function as<T extends VariableReturnType>(
  expression: ExpressionOrPrimitive<T>,
  value: VariableTerm
): VariableExpression<T> {
  return {
    variable: value,
    expression: processPrimitiveExpression(expression),
  };
}

export function cast<T extends VariableReturnType>(
  variable: Variable
): Variable<T> {
  return variable as Variable<T>;
}
