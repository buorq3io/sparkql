export interface Wildcard {
  readonly termType: 'Wildcard';
  readonly value: '*';

  equals(other: Term | DefaultGraph | null | undefined): boolean;
}

export interface SparqlGenerator {
  stringify(query: SparqlQuery): string;

  createGenerator(): any;
}

export type Term = IriTerm | BlankTerm | LiteralTerm | VariableTerm | QuadTerm;

export type TermOrPrimitive = Term | Primitive;

export type SparqlQuery = Query;
export type Query = SelectQuery;

export interface BaseQuery {
  type: 'query';
  base?: string | undefined;
  prefixes: { [prefix: string]: string };
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
  variables: Variable[] | [Wildcard];
  distinct?: boolean | undefined;
  reduced?: boolean | undefined;
  group?: Grouping[] | undefined;
  having?: Expression[] | undefined;
  order?: Ordering[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface Grouping {
  expression: Expression;
  variable?: VariableTerm;
}

export interface Ordering {
  expression: Expression;
  descending?: boolean | undefined;
}

export type VariableReturnType = LiteralTerm | Primitive | IriTerm;
export type ExpressionReturnType = LiteralTerm | Primitive | IriTerm;

export type Variable<T extends VariableReturnType = VariableReturnType> =
  | VariableExpression<T>
  | VariableTerm<T>;

export interface VariableExpression<
  T extends VariableReturnType = VariableReturnType
> {
  expression: Expression<T>;
  variable: VariableTerm;
}

export interface IriTerm<Iri extends string = string> {
  termType: 'NamedNode';
  value: Iri;

  equals(other: Term | null | undefined): boolean;
}

export interface BlankTerm {
  termType: 'BlankNode';
  value: string;

  equals(other: Term | null | undefined): boolean;
}

export interface LiteralTerm {
  termType: 'Literal';
  value: string;
  language: string;
  direction?: 'ltr' | 'rtl' | '' | null;
  datatype: IriTerm;

  equals(other: Term | null | undefined): boolean;
}

export type Primitive = number | bigint | string | boolean;

export interface VariableTerm<
  T extends LiteralTerm | Primitive | IriTerm =
    | LiteralTerm
    | Primitive
    | IriTerm
> {
  termType: 'Variable';
  value: string;

  equals(other: Term | null | undefined): boolean;
}

export interface DefaultGraph {
  termType: 'DefaultGraph';
  value: '';

  equals(other: Term | null | undefined): boolean;
}

export type QuadSubject = IriTerm | BlankTerm | QuadTerm | VariableTerm;
export type QuadPredicate = IriTerm | VariableTerm;
export type QuadObject =
  | IriTerm
  | LiteralTerm
  | BlankTerm
  | QuadTerm
  | VariableTerm;
export type QuadGraph = DefaultGraph | IriTerm | BlankTerm | VariableTerm;

export interface BaseQuadTerm {
  termType: 'Quad';
  value: '';
  subject: Term;
  predicate: Term;
  object: Term;
  graph: Term | DefaultGraph;

  equals(other: Term | null | undefined): boolean;
}

export interface QuadTerm extends BaseQuadTerm {
  subject: QuadSubject;
  predicate: QuadPredicate;
  object: QuadObject;
  graph: QuadGraph;

  equals(other: Term | null | undefined): boolean;
}

export interface Triple {
  subject: IriTerm | BlankTerm | VariableTerm;
  predicate: IriTerm | VariableTerm | PropertyPath;
  object: Term;
}

export type PropertyPath =
  | NegatedPropertySet
  | {
      type: 'path';
      pathType: '|' | '/' | '^' | '+' | '*' | '?';
      items: Array<IriTerm | PropertyPath>;
    };

export interface NegatedPropertySet {
  type: 'path';
  pathType: '!';
  items: Array<
    | IriTerm
    | {
        type: 'path';
        pathType: '^';
        items: [IriTerm];
      }
  >;
}

export type PropertySet = Exclude<PropertyPath, NegatedPropertySet>;

export type Pattern =
  | BgpPattern
  | BlockPattern
  | FilterPattern
  | BindPattern
  | ValuesPattern
  | SelectQuery;

export type PatternOrTriple = Pattern | Triple;

export interface BgpPattern {
  type: 'bgp';
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

export type Expression<T extends ExpressionReturnType = ExpressionReturnType> =
  | OperationExpression<T>
  | FunctionCallExpression<T>
  | AggregateExpression<T>
  | Tuple
  | IriTerm
  | VariableTerm<T>
  | LiteralTerm;

export type ExpressionOrPrimitive<
  T extends ExpressionReturnType = ExpressionReturnType
> = Expression<T> | Primitive;

export interface Tuple extends Array<Expression> {}

export interface BaseExpression {
  type: string;
  distinct?: boolean | undefined;
}

export interface OperationExpression<
  T extends ExpressionReturnType = ExpressionReturnType
> extends BaseExpression {
  type: 'operation';
  operator: string;
  args: Array<Expression | Pattern>;
}

export interface FunctionCallExpression<
  T extends ExpressionReturnType = ExpressionReturnType
> extends BaseExpression {
  type: 'functionCall';
  function: string | IriTerm;
  args: Expression[];
}

export interface AggregateExpression<
  T extends ExpressionReturnType = ExpressionReturnType
> extends BaseExpression {
  type: 'aggregate';
  expression: Expression | Wildcard;
  aggregation: string;
  separator?: string | undefined;
}
