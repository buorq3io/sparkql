import SparqlJs from 'sparqljs';
import RdfJs from 'rdf-data-factory';

export type { StreamClient as SparqlClient } from 'sparql-http-client';

export type DataFactory = RdfJs.DataFactory;

export type BlankPrefix<T extends string> = T extends `e_${string}` | `g_${string}` ? never : T;
export type FactoryFunctions = {
  variable: (value: string) => SparqlJs.VariableTerm;
  iri: <T extends string>(value: T) => SparqlJs.IriTerm;
  blank: <T extends string>(value?: BlankPrefix<T>) => SparqlJs.BlankTerm;
  literal: (value: string, lang?: string | IriTerm) => SparqlJs.LiteralTerm;
};

export type Wildcard = SparqlJs.Wildcard;
export type SparqlGenerator = SparqlJs.SparqlGenerator;

export type SparqlQuery = SparqlJs.SparqlQuery;
export type Query = SparqlJs.Query;

export type SelectQuery = SparqlJs.SelectQuery;
export type ConstructQuery = SparqlJs.ConstructQuery;
export type AskQuery = SparqlJs.AskQuery;
export type DescribeQuery = SparqlJs.DescribeQuery;
export type Update = SparqlJs.Update;

export type UpdateOperation = InsertDeleteOperation | ManagementOperation;
export type InsertDeleteOperation = SparqlJs.InsertDeleteOperation;
export type ManagementOperation = SparqlJs.ManagementOperation;
export type CopyMoveAddOperation = SparqlJs.CopyMoveAddOperation;
export type LoadOperation = SparqlJs.LoadOperation;
export type CreateOperation = SparqlJs.CreateOperation;
export type ClearDropOperation = SparqlJs.ClearDropOperation;

export type Quads = Triple | BgpPattern | GraphQuads;

export interface GraphOrDefault {
  type: 'graph';
  name?: IriTerm | undefined;
  default?: boolean | undefined;
}

export interface GraphReference extends GraphOrDefault {
  named?: boolean | undefined;
  all?: boolean | undefined;
}

export interface Grouping {
  expression: Expression;
  variable?: VariableTerm;
}

export interface Ordering {
  expression: Expression;
  descending?: boolean | undefined;
}

export type IriTerm = SparqlJs.IriTerm;

export type AnonymousBlankTerm = [] | symbol;
export type BlankTerm = SparqlJs.BlankTerm | AnonymousBlankTerm;

export type PrimitiveTerm = number | bigint | string | boolean;
export type LiteralTerm = SparqlJs.LiteralTerm | PrimitiveTerm;

export type Variable<T extends QueryReturnType = QueryReturnType> =
  | VariableExpression<T>
  | VariableTerm<T>;

export interface VariableExpression<T extends QueryReturnType = QueryReturnType> {
  expression: Expression<T>;
  variable: VariableTerm;
}

export interface VariableTerm<T extends QueryReturnType = QueryReturnType>
  extends SparqlJs.VariableTerm {
  transform?: (self: BaseQueryReturnType) => T;
}

export type DefaultGraph = RdfJs.DefaultGraph;
export type QuadTerm = SparqlJs.QuadTerm;

export type QuadGraph = DefaultGraph | IriTerm | BlankTerm | VariableTerm;
export type QuadSubject = IriTerm | BlankTerm | QuadTerm | VariableTerm;
export type QuadPredicate = IriTerm | VariableTerm;
export type QuadObject = Term;

export type Term = VariableTerm | IriTerm | LiteralTerm | BlankTerm | QuadTerm;

export type BaseQueryReturnType =
  | IriTerm
  | Exclude<BlankTerm, AnonymousBlankTerm>
  | Exclude<LiteralTerm, PrimitiveTerm>;
export type QueryReturnType = BaseQueryReturnType | any;

export type PropertyPath = SparqlJs.PropertyPath;
export type NegatedPropertySet = SparqlJs.NegatedPropertySet;
export type PropertySet = Exclude<PropertyPath, NegatedPropertySet>;

export type TripleSubject = IriTerm | BlankTerm | VariableTerm;
export type TriplePredicate = IriTerm | VariableTerm | PropertyPath;
export type TripleObject = Term;

export type QualitativeAnonymousBlankTerm =
  | [TriplePredicate, TriplesObject]
  | [TriplesPredicatePairs];

export type ExtendedBlankTerm = BlankTerm | QualitativeAnonymousBlankTerm;
export type ExtendedTerm = VariableTerm | IriTerm | LiteralTerm | ExtendedBlankTerm | QuadTerm;

export type TriplesSubject = IriTerm | ExtendedBlankTerm | VariableTerm;
export type TriplesObject = ExtendedTerm | TriplesObjectPairs;

export type TriplesPredicatePairs = {
  type: 'triplespredicatepairs';
  values: [TriplePredicate, TriplesObject][];
};

export type TriplesObjectPairs = {
  type: 'triplesobjectpairs';
  values: TriplesObject[];
};

export interface Triple extends Record<keyof SparqlJs.Triple, unknown> {
  type: 'triple';
  subject: TripleSubject;
  predicate: TriplePredicate;
  object: TripleObject;
}

export type Pattern =
  | Triple
  | BgpPattern
  | BlockPattern
  | FilterPattern
  | BindPattern
  | ValuesPattern
  | SelectQuery;

export interface BgpPattern {
  type: 'bgp';
  triples: Triple[];
}

export interface GraphQuads {
  type: 'graph';
  name: IriTerm | VariableTerm;
  triples: Triple[];
}

export type BlockPattern =
  | OptionalPattern
  | UnionPattern
  | GroupPattern
  | GraphPattern
  | MinusPattern
  | ServicePattern;

export interface OptionalPattern {
  type: 'optional';
  patterns: Pattern[];
}

export interface UnionPattern {
  type: 'union';
  patterns: Pattern[];
}

export interface GroupPattern {
  type: 'group';
  patterns: Pattern[];
}

export interface GraphPattern {
  type: 'graph';
  name: IriTerm | VariableTerm;
  patterns: Pattern[];
}

export interface MinusPattern {
  type: 'minus';
  patterns: Pattern[];
}

export interface ServicePattern {
  type: 'service';
  name: IriTerm | VariableTerm;
  silent: boolean;
  patterns: Pattern[];
}

export interface FilterPattern {
  type: 'filter';
  expression: Expression;
}

export interface BindPattern {
  type: 'bind';
  expression: Expression;
  variable: VariableTerm;
}

export interface ValuesPattern {
  type: 'values';
  values: ValuePatternRow[];
}

export interface ValuePatternRow {
  [variable: string]: IriTerm | BlankTerm | LiteralTerm | undefined;
}

export type Expression<T extends QueryReturnType = QueryReturnType> =
  | OperationExpression<T>
  | FunctionCallExpression<T>
  | AggregateExpression<T>
  | Tuple
  | IriTerm
  | VariableTerm<T>
  | LiteralTerm;

export interface Tuple extends Array<Expression> {}

export interface BaseExpression<T extends QueryReturnType = QueryReturnType>
  extends SparqlJs.BaseExpression {
  transform?: (self: BaseQueryReturnType, ...other: any[]) => T;
}

export interface OperationExpression<T extends QueryReturnType = QueryReturnType>
  extends BaseExpression<T> {
  type: 'operation';
  operator: string;
  args: Array<Expression | Pattern>;
}

export interface FunctionCallExpression<T extends QueryReturnType = QueryReturnType>
  extends BaseExpression<T> {
  type: 'functionCall';
  function: string | IriTerm;
  args: Expression[];
}

export interface AggregateExpression<T extends QueryReturnType = QueryReturnType>
  extends BaseExpression<T> {
  type: 'aggregate';
  expression: Expression | Wildcard;
  aggregation: string;
  separator?: string | undefined;
}
