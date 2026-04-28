import type * as AST from '@traqula/rules-sparql-1-1';
import type * as RdfJs from 'rdf-data-factory';

type ValueOf<T> = T[keyof T];

export interface BlankFormatMap {}
export interface LiteralFormatMap {}
export interface NamedNodeFormatMap {}

export type TermIriFullInput = AST.TermIriFull;
export type TermIriInput = AST.TermIri | ValueOf<NamedNodeFormatMap>;
export type TermLiteralInput = AST.TermLiteral | ValueOf<LiteralFormatMap>;
export type TermBlankInput = AST.TermBlank | ValueOf<BlankFormatMap>;

export type TermVariableInput<
  T extends QueryReturnType = DefaultQueryReturnType,
  K extends Presence = Presence.required
> = AST.TermVariable & {
  presence?: K;
  transform?: TermVariableTransform<T>;
  _invariant?: (arg: T) => T;
};

export type TermVariableAndBinding<
  T extends QueryReturnType = QueryReturnType,
  K extends Presence = Presence.required
> = PatternBindInput<T, K> | TermVariableInput<T, K>;

export type TermInput = TermIriInput | TermLiteralInput | TermBlankInput | TermVariableInput;
export type GraphNodeInput = TermInput | TripleCollectionInput;

export type SubjectInput = GraphNodeInput;
export type PredicateInput = TermIriInput | TermVariableInput | PathInput;
export type ObjectInput = GraphNodeInput;

type Override<T, U> = Omit<T, keyof U> & U;

export type TripleNestingInput<
  S extends SubjectInput = SubjectInput,
  P extends PredicateInput = PredicateInput,
  O extends ObjectInput = ObjectInput
> = Override<
  AST.TripleNesting,
  {
    subject: S;
    predicate: P;
    object: O;
  }
>;

export type TripleCollectionListInput = Override<
  AST.TripleCollectionList,
  {
    triples: TripleNestingInput[];
    identifier: TermBlankInput;
  }
>;

export type TripleCollectionBlankNodePropertiesInput = Override<
  AST.TripleCollectionBlankNodeProperties,
  {
    triples: TripleNestingInput[];
    identifier: TermBlankInput;
  }
>;

export type TripleCollectionInput =
  | TripleCollectionListInput
  | TripleCollectionBlankNodePropertiesInput;

export type BasicGraphPatternInput = (TripleCollectionInput | TripleNestingInput)[];

export type PatternBgpInput = Override<
  AST.PatternBgp,
  {
    triples: BasicGraphPatternInput;
  }
>;

export type PatternGroupInput = Override<
  AST.PatternGroup,
  {
    patterns: PatternInput[];
  }
>;

export type PatternUnionInput = Override<
  AST.PatternUnion,
  {
    patterns: PatternGroupInput[];
  }
>;

export type PatternOptionalInput = Override<
  AST.PatternOptional,
  {
    patterns: PatternInput[];
  }
>;

export type PatternMinusInput = Override<
  AST.PatternMinus,
  {
    patterns: PatternInput[];
  }
>;

export type PatternGraphInput = Override<
  AST.PatternGraph,
  {
    name: TermIriInput | TermVariableInput;
    patterns: PatternInput[];
  }
>;

export type PatternServiceInput = Override<
  AST.PatternService,
  {
    name: TermIriInput | TermVariableInput;
    patterns: PatternInput[];
  }
>;

export type PatternFilterInput = Override<
  AST.PatternFilter,
  {
    expression: ExpressionInput;
  }
>;

export type PatternBindInput<
  T extends QueryReturnType = QueryReturnType,
  K extends Presence = Presence.required
> = Override<
  AST.PatternBind,
  {
    expression: ExpressionInput<T>;
    variable: TermVariableInput<T, K>;
  }
>;

export type PatternValuesInput = Override<
  AST.PatternValues,
  {
    variables: TermVariableInput[];
    values: ValuePatternColumnsInput;
  }
>;

export type ValuePatternColumnsInput = Override<
  AST.ValuePatternRow,
  {
    [x: string]: (TermIriInput | TermLiteralInput | undefined)[];
  }
>;

export type PatternInput =
  | PatternBgpInput
  | PatternGroupInput
  | PatternUnionInput
  | PatternOptionalInput
  | PatternMinusInput
  | PatternGraphInput
  | PatternServiceInput
  | PatternFilterInput
  | PatternBindInput
  | PatternValuesInput
  | QuerySelectInput;

export type DatasetClausesInput = Override<
  AST.DatasetClauses,
  {
    clauses: Override<
      AST.DatasetClauses['clauses'][number],
      {
        value: TermIriInput;
      }
    >[];
  }
>;

export type SolutionModifierGroupBindInput = Override<
  AST.SolutionModifierGroupBind,
  {
    variable: TermVariableInput;
    value: ExpressionInput;
  }
>;

export type SolutionModifierGroupInput = Override<
  AST.SolutionModifierGroup,
  {
    groupings: (ExpressionInput | SolutionModifierGroupBindInput)[];
  }
>;

export type SolutionModifierHavingInput = Override<
  AST.SolutionModifierHaving,
  {
    having: ExpressionInput[];
  }
>;

export type OrderingInput = Override<
  AST.Ordering,
  {
    expression: ExpressionInput;
  }
>;

export type SolutionModifierOrderInput = Override<
  AST.SolutionModifierOrder,
  {
    orderDefs: OrderingInput[];
  }
>;

export type SolutionModifierLimitOffsetInput = AST.SolutionModifierLimitOffset;

export type SolutionModifiersInput = Override<
  AST.SolutionModifiers,
  {
    group?: SolutionModifierGroupInput | undefined;
    having?: SolutionModifierHavingInput | undefined;
    order?: SolutionModifierOrderInput | undefined;
    limitOffset?: SolutionModifierLimitOffsetInput | undefined;
  }
>;

export type ContextDefinitionPrefixInput = Override<
  AST.ContextDefinitionPrefix,
  {
    value: TermIriFullInput;
  }
>;

export type ContextDefinitionBaseInput = Override<
  AST.ContextDefinitionBase,
  {
    value: TermIriFullInput;
  }
>;

export type ContextDefinitionInput = ContextDefinitionPrefixInput | ContextDefinitionBaseInput;

type QuerySubtypeInput<TQuery extends AST.Query, TOverrides extends object = {}> = Override<
  TQuery,
  Omit<QueryBaseInput, 'subType'> & TOverrides
>;

export type QuerySelectInput = QuerySubtypeInput<
  AST.QuerySelect,
  {
    variables: (TermVariableInput | PatternBindInput)[] | [WildcardInput];
    where: PatternGroupInput;
  }
>;

export type QueryAskInput = QuerySubtypeInput<
  AST.QueryAsk,
  {
    where: PatternGroupInput;
  }
>;

export type QueryDescribeInput = QuerySubtypeInput<
  AST.QueryDescribe,
  {
    variables: (TermVariableInput | TermIriInput)[] | [WildcardInput];
  }
>;
export type QueryConstructInput = QuerySubtypeInput<
  AST.QueryConstruct,
  {
    template: PatternBgpInput;
    where: PatternGroupInput;
  }
>;

export type QueryBaseInput = Override<
  AST.QueryBase,
  {
    context: ContextDefinitionInput[];
    values?: PatternValuesInput;
    solutionModifiers: SolutionModifiersInput;
    datasets: DatasetClausesInput;
    where?: PatternGroupInput;
  }
>;

export type QueryInput =
  | QuerySelectInput
  | QueryAskInput
  | QueryDescribeInput
  | QueryConstructInput;

export type ExpressionInput<_T extends any = any> =
  | TermIriInput
  | TermLiteralInput
  | TermVariableInput<_T>
  | ExpressionOperationInput<_T>
  | ExpressionPatternOperationInput<_T>
  | ExpressionFunctionCallInput<_T>
  | ExpressionAggregateInput<_T>;


export type TermIriOutput = RdfJs.NamedNode
export type TermBlankOutput = RdfJs.BlankNode
export type TermLiteralOutput = RdfJs.Literal

export type DefaultQueryReturnType = TermIriOutput | TermBlankOutput | TermLiteralOutput;
export type QueryReturnType = DefaultQueryReturnType | any;

export type TermVariableTransform<
  T extends QueryReturnType = QueryReturnType,
  K extends any[] = []
> = (self: DefaultQueryReturnType, ...other: K) => T;

export type TermVariableOptionalTransform<
  T extends QueryReturnType = QueryReturnType,
  K extends any[] = []
> = (self: DefaultQueryReturnType | undefined, ...other: K) => T | undefined;

export type TransformExpression<T> = {
  transform?: TermVariableTransform<T>;
};

export type ExpressionOperationInput<_T> = Override<
  AST.ExpressionOperation & TransformExpression<_T>,
  {
    args: ExpressionInput<any>[];
  }
>;

export type ExpressionPatternOperationInput<_T> = Override<
  AST.ExpressionPatternOperation & TransformExpression<_T>,
  {
    args: PatternGroupInput;
  }
>;

export type ExpressionFunctionCallInput<_T> = Override<
  AST.ExpressionFunctionCall & TransformExpression<_T>,
  {
    function: TermIriInput;
    args: ExpressionInput<any>[];
  }
>;

export type ExpressionAggregateInput<_T> =
  | ExpressionAggregateDefaultInput<_T>
  | ExpressionAggregateOnWildcardInput<_T>
  | ExpressionAggregateSeparatorInput<_T>;

export type ExpressionAggregateDefaultInput<_T> = Override<
  AST.ExpressionAggregateDefault & TransformExpression<_T>,
  {
    expression: [ExpressionInput<any>];
  }
>;

export type ExpressionAggregateOnWildcardInput<_T> = Override<
  AST.ExpressionAggregateOnWildcard & TransformExpression<_T>,
  {
    expression: [WildcardInput];
  }
>;

export type ExpressionAggregateSeparatorInput<_T> = Override<
  AST.ExpressionAggregateSeparator & TransformExpression<_T>,
  {
    expression: [ExpressionInput<any>];
  }
>;

export type WildcardInput = AST.Wildcard;

export type SparqlQueryInput = QueryInput | UpdateInput;

export type UpdateInput = Override<
  AST.Update,
  {
    updates: Override<
      AST.Update['updates'][number],
      {
        operation?: UpdateOperationInput;
        context: ContextDefinitionInput[];
      }
    >[];
  }
>;

export type UpdateOperationInput =
  | UpdateOperationLoadInput
  | UpdateOperationClearInput
  | UpdateOperationDropInput
  | UpdateOperationCreateInput
  | UpdateOperationAddInput
  | UpdateOperationMoveInput
  | UpdateOperationCopyInput
  | UpdateOperationInsertDataInput
  | UpdateOperationDeleteDataInput
  | UpdateOperationDeleteWhereInput
  | UpdateOperationModifyInput;

export type UpdateOperationLoadInput = Override<
  AST.UpdateOperationLoad,
  {
    source: TermIriInput;
    destination?: GraphRefSpecificInput;
  }
>;

export type GraphRefAllInput = AST.GraphRefAll;
export type GraphRefNamedInput = AST.GraphRefNamed;
export type GraphRefDefaultInput = AST.GraphRefDefault;

export type GraphRefSpecificInput = Override<
  AST.GraphRefSpecific,
  {
    graph: TermIriInput;
  }
>;

export type GraphRefInput =
  | GraphRefDefaultInput
  | GraphRefNamedInput
  | GraphRefAllInput
  | GraphRefSpecificInput;

export type UpdateOperationClearInput = Override<
  AST.UpdateOperationClear,
  {
    destination: GraphRefInput;
  }
>;

export type UpdateOperationDropInput = Override<
  AST.UpdateOperationDrop,
  {
    destination: GraphRefInput;
  }
>;

export type UpdateOperationCreateInput = Override<
  AST.UpdateOperationCreate,
  {
    destination: GraphRefSpecificInput;
  }
>;

export type UpdateOperationAddInput = Override<
  AST.UpdateOperationAdd,
  {
    source: GraphRefDefaultInput | GraphRefSpecificInput;
    destination: GraphRefDefaultInput | GraphRefSpecificInput;
  }
>;

export type UpdateOperationMoveInput = Override<
  AST.UpdateOperationMove,
  {
    source: GraphRefDefaultInput | GraphRefSpecificInput;
    destination: GraphRefDefaultInput | GraphRefSpecificInput;
  }
>;

export type UpdateOperationCopyInput = Override<
  AST.UpdateOperationCopy,
  {
    source: GraphRefDefaultInput | GraphRefSpecificInput;
    destination: GraphRefDefaultInput | GraphRefSpecificInput;
  }
>;

export type UpdateOperationInsertDataInput = Override<
  AST.UpdateOperationInsertData,
  {
    data: QuadsInput[];
  }
>;

export type UpdateOperationDeleteDataInput = Override<
  AST.UpdateOperationDeleteData,
  {
    data: QuadsInput[];
  }
>;

export type UpdateOperationDeleteWhereInput = Override<
  AST.UpdateOperationDeleteWhere,
  {
    data: QuadsInput[];
  }
>;

export type UpdateOperationModifyInput = Override<
  AST.UpdateOperationModify,
  {
    graph: TermIriInput | undefined;
    insert: QuadsInput[];
    delete: QuadsInput[];
    from: DatasetClausesInput;
    where: PatternGroupInput;
  }
>;

export type QuadsInput = PatternBgpInput | GraphQuadsInput;

export type GraphQuadsInput = Override<
  AST.GraphQuads,
  {
    graph: TermIriInput | TermVariableInput;
    triples: PatternBgpInput;
  }
>;

export type PropertyPathChainInput = Override<
  AST.PropertyPathChain,
  {
    items: PathInput[];
  }
>;

export type PathModifiedInput = Override<
  AST.PathModified,
  {
    items: [PathInput];
  }
>;

export type PathNegatedEltInput = Override<
  AST.PathNegatedElt,
  {
    items: [TermIriInput];
  }
>;

export type PathAlternativeLimitedInput = Override<
  AST.PathAlternativeLimited,
  {
    items: (TermIriInput | PathNegatedEltInput)[];
  }
>;

export type PathNegatedInput = Override<
  AST.PathNegated,
  {
    items: [TermIriInput | PathNegatedEltInput | PathAlternativeLimitedInput];
  }
>;

export type PathInput =
  | TermIriInput
  | PropertyPathChainInput
  | PathModifiedInput
  | PathNegatedInput;

export type { StreamClient as SparqlClient } from 'sparql-http-client';

export type FactoryFunctions = {
  variable: (value: string) => AST.TermVariable;
  iri: (value: string) => AST.TermIri;
  blank: (value?: string) => AST.TermBlank;
  literal: (value: string, lang?: string | TermIriInput) => AST.TermLiteral;
};

export enum Presence {
  required = 'required',
  optional = 'optional',
}

export enum Strictness {
  strict = 'strict',
  loose = 'loose',
}

export type Node = Override<
  AST.Wildcard,
  {
    type: string;
  }
>;
