import SparqlJs from 'sparqljs';
import RdfJs from 'rdf-data-factory';
import { SelectQueryBuilderBase } from './database/select.js';

export { SparqlJs, RdfJs };

export type { StreamClient as SparqlClient } from 'sparql-http-client';

export type DataFactory = RdfJs.DataFactory;

export type ExcludePrefix<T extends string, K extends string> = T extends `${K}${number}`
  ? never
  : T;

export type FactoryFunctions<K extends string = string> = {
  variable: (value: string) => SparqlJs.VariableTerm;
  iri: <T extends string>(value: T) => SparqlJs.IriTerm;
  blank: <T extends string>(value?: ExcludePrefix<T, K>) => SparqlJs.BlankTerm;
  literal: (value: string, lang?: string | IriTerm) => SparqlJs.LiteralTerm;
};

export type Wildcard = SparqlJs.Wildcard;
export type SparqlGenerator = SparqlJs.SparqlGenerator;

export type SparqlQuery = Query | Update;
export type Query = SelectQuery | ConstructQuery | AskQuery | DescribeQuery;

export interface BaseQuery {
  type: 'query';
  base?: string | undefined;
  prefixes: {
    [p: string]: string;
  };
  from?:
    | {
        default: IriTerm[];
        named: IriTerm[];
      }
    | undefined;
  where?: Pattern[] | undefined;
  values?: ValuePatternRow[] | undefined;
}

export interface SelectQuery extends BaseQuery {
  queryType: 'SELECT';
  variables: Variable[];
  distinct?: boolean | undefined;
  reduced?: boolean | undefined;
  group?: Grouping[] | undefined;
  having?: Expression[] | undefined;
  order?: Ordering[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ConstructQuery extends BaseQuery {
  queryType: 'CONSTRUCT';
  template?: Triple[] | undefined;
}

export interface AskQuery extends BaseQuery {
  queryType: 'ASK';
}

export interface DescribeQuery extends BaseQuery {
  queryType: 'DESCRIBE';
  variables: Array<VariableTerm | IriTerm> | [Wildcard];
}

export interface Update {
  type: 'update';
  base?: string | undefined;
  prefixes: {
    [p: string]: string;
  };
  updates: UpdateOperation[];
}

export type UpdateOperation = InsertDeleteOperation | ManagementOperation;

export type InsertDeleteOperation =
  | {
      updateType: 'insert';
      graph?: GraphOrDefault;
      insert: Quads[];
    }
  | {
      updateType: 'delete';
      graph?: GraphOrDefault;
      delete: Quads[];
    }
  | {
      updateType: 'insertdelete';
      graph?: IriTerm;
      insert: Quads[];
      delete: Quads[];
      using?: {
        default: IriTerm[];
        named: IriTerm[];
      };
      where: Pattern[];
    }
  | {
      updateType: 'deletewhere';
      graph?: GraphOrDefault;
      delete: Quads[];
    };

export type ManagementOperation =
  | CopyMoveAddOperation
  | LoadOperation
  | CreateOperation
  | ClearDropOperation;

export type CopyMoveAddOperation = {
  type: 'copy' | 'move' | 'add';
  silent: boolean;
  source: GraphOrDefault;
  destination: GraphOrDefault;
};

export type LoadOperation = {
  type: 'load';
  silent: boolean;
  source: IriTerm;
  destination: IriTerm | false;
};

export type CreateOperation = {
  type: 'create';
  silent: boolean;
  graph: GraphOrDefault;
};

export type ClearDropOperation = {
  type: 'clear' | 'drop';
  silent: boolean;
  graph: GraphReference;
};

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

export type Grouping = Expression | VariableExpression;
export type Ordering =
  | Expression
  | {
      expression: Expression;
      descending: boolean | undefined;
    };

export type BaseIriTerm = SparqlJs.IriTerm;
export type IriTerm = BaseIriTerm;

export type AnonymousBlankTerm = [] | symbol;
export type BaseBlankTerm = SparqlJs.BlankTerm;
export type BlankTerm = BaseBlankTerm | AnonymousBlankTerm;

export type PrimitiveTerm = number | bigint | string | boolean | Date;
export type BaseLiteralTerm = SparqlJs.LiteralTerm;
export type LiteralTerm = BaseLiteralTerm | PrimitiveTerm;

export type Variable<
  T extends QueryReturnType = BaseQueryReturnType,
  K extends Presence = Presence.required
> = VariableExpression<T, K> | VariableTerm<T, K>;

export interface VariableExpression<
  T extends QueryReturnType = BaseQueryReturnType,
  K extends Presence = Presence.required
> {
  expression: Expression<T>;
  variable: VariableTerm<T, K>;
}

export enum Presence {
  required = 'required',
  optional = 'optional',
}

export enum Strictness {
  strict = 'strict',
  loose = 'loose',
}

export type Transform<T extends QueryReturnType = QueryReturnType, K extends any[] = []> = (
  self: BaseQueryReturnType,
  ...other: K
) => T;

export type OptionalTransform<T extends QueryReturnType = QueryReturnType, K extends any[] = []> = (
  self: BaseQueryReturnType | undefined,
  ...other: K
) => T | undefined;

export interface VariableTerm<
  T extends QueryReturnType = BaseQueryReturnType,
  K extends Presence = Presence.required
> extends SparqlJs.VariableTerm {
  presence?: K;
  transform?: Transform<T>;
  _invariant?: (arg: T) => T;
}

export type DefaultGraph = RdfJs.DefaultGraph;
export type QuadTerm = SparqlJs.QuadTerm;

export type QuadGraph = DefaultGraph | IriTerm | BlankTerm | VariableTerm;
export type QuadSubject = IriTerm | BlankTerm | QuadTerm | VariableTerm;
export type QuadPredicate = IriTerm | VariableTerm;
export type QuadObject = Term;

export type Term = VariableTerm | IriTerm | LiteralTerm | BlankTerm | QuadTerm;

export type BaseQueryReturnType = BaseIriTerm | BaseBlankTerm | BaseLiteralTerm;
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
  | ValuesPattern;

export type PatternWithSelectQuery = Pattern | SelectQueryBuilderBase<any>;

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
  patterns: PatternWithSelectQuery[];
}

export interface UnionPattern {
  type: 'union';
  patterns: PatternWithSelectQuery[];
}

export interface GroupPattern {
  type: 'group';
  patterns: PatternWithSelectQuery[];
}

export interface GraphPattern {
  type: 'graph';
  name: IriTerm | VariableTerm;
  patterns: PatternWithSelectQuery[];
}

export interface MinusPattern {
  type: 'minus';
  patterns: PatternWithSelectQuery[];
}

export interface ServicePattern {
  type: 'service';
  name: IriTerm | VariableTerm;
  silent: boolean;
  patterns: PatternWithSelectQuery[];
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
  | IriTerm
  | VariableTerm<T>
  | LiteralTerm;

export interface ExpressionTuple extends Array<Expression> {}
export type ExpressionWithTuple<T extends QueryReturnType = QueryReturnType> =
  | Expression<T>
  | ExpressionTuple;

export interface BaseExpression<T extends QueryReturnType = QueryReturnType>
  extends SparqlJs.BaseExpression {
  transform?: Transform<T>;
}

export interface OperationExpression<T extends QueryReturnType = QueryReturnType>
  extends BaseExpression<T> {
  type: 'operation';
  operator: string;
  args: Array<ExpressionWithTuple | Pattern>;
}

export interface FunctionCallExpression<T extends QueryReturnType = QueryReturnType>
  extends BaseExpression<T> {
  type: 'functionCall';
  function: string | IriTerm;
  args: ExpressionWithTuple[];
}

export interface AggregateExpression<T extends QueryReturnType = QueryReturnType>
  extends BaseExpression<T> {
  type: 'aggregate';
  expression: ExpressionWithTuple | Wildcard;
  aggregation: string;
  separator?: string | undefined;
}
