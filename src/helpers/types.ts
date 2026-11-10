import type * as AST from '@traqula/rules-sparql-1-1';
import type * as RdfJs from 'rdf-data-factory';
import type { ExtensionPattern } from '../database/dialect.js';
import type { Placeholder } from '../database/prepared.js';
import type { RawExpressionInput, RawPatternInput } from '../database/raw.js';

/** A full IRI term, never prefixed, as `PREFIX` and `BASE` declarations require. */
export type TermIriFullInput = AST.TermIriFull;
/** An IRI input: an IRI term such as `n.foaf.name`, or a `URL`. */
export type TermIriInput = AST.TermIri | URL;
/**
 * A literal input: a literal term, or a JavaScript value that converts to one.
 *
 * Strings become plain literals, integral numbers and bigints `xsd:integer`, other numbers
 * `xsd:decimal`, a `Date` an `xsd:dateTime`, booleans `xsd:boolean`, and a `RegExp` a plain
 * literal of its source. A database's `formats` and codec encoders can accept more.
 */
export type TermLiteralInput = AST.TermLiteral | string | RegExp | number | bigint | boolean | Date;
/** A blank node input: a blank node term, or `[]` for a fresh blank node. */
export type TermBlankInput = AST.TermBlank | [];

/**
 * A variable term, such as `v.name`, with the result type it carries into query rows.
 *
 * Casts such as `castNumber` set the transform and `T`; {@link maybe} and {@link always} set
 * the presence and `K`.
 *
 * @typeParam T - The value the variable has in a result row; an RDF/JS term without a cast.
 * @typeParam K - Whether the variable may be unbound, adding `undefined` to its row type.
 */
export type TermVariableInput<
  T extends QueryReturnType = DefaultQueryReturnType,
  K extends Presence = Presence.required,
> = AST.TermVariable & {
  /** Whether the variable may be unbound in results; required when not set. */
  presence?: K;
  /** Converts the bound term to the row value; when not set, codecs or the raw term apply. */
  transform?: TermVariableTransform<T>;
  /** @internal A type-level marker preserving the result type. */
  _invariant?: (arg: T) => T;
};

/**
 * A value that can be selected: a variable, or an `as(expression, variable)` binding.
 *
 * @typeParam T - The value it has in a result row.
 * @typeParam K - Whether it may be unbound.
 */
export type TermVariableAndBinding<
  // `any` by default: an unparameterized binding stands for a binding of some value type.
  T extends QueryReturnType = any,
  K extends Presence = Presence.required,
> = PatternBindInput<T, K> | TermVariableInput<T, K>;

/** Any term input, or a prepared-query placeholder that stands for one. */
export type TermInput =
  | TermIriInput
  | TermLiteralInput
  | TermBlankInput
  | TermVariableInput
  | Placeholder;
/** A subject or object of a triple: a term input, or an RDF list or blank node property list. */
export type GraphNodeInput = TermInput | TripleCollectionInput;

/**
 * Several objects for one subject and predicate, `?s ?p o1, o2` in SPARQL; created by
 * {@link objects}.
 */
export type ObjectColletion = {
  /** The AST node discriminator. */
  type: 'syntacticShortcut';
  /** The syntactic shortcut discriminator. */
  subType: 'objectCollection';
  /** The objects; each one becomes its own triple. */
  values: ObjectInput[];
};

/**
 * Several predicate-object pairs for one subject, `?s p1 o1 ; p2 o2` in SPARQL; created by
 * {@link predicates}.
 */
export type PredicatePairCollection = {
  /** The AST node discriminator. */
  type: 'syntacticShortcut';
  /** The syntactic shortcut discriminator. */
  subType: 'predicatePairCollection';
  /** The `[predicate, object]` pairs; an object may be an {@link objects} collection. */
  values: [PredicateInput, ObjectColletion | ObjectInput][];
};

/** A triple subject: a term input or a triple collection. */
export type SubjectInput = GraphNodeInput;
/** A triple predicate: an IRI, a variable or a property path. */
export type PredicateInput = TermIriInput | TermVariableInput | PathInput;
/** A triple object: a term input or a triple collection. */
export type ObjectInput = GraphNodeInput;

type Override<T, U> = Omit<T, keyof U> & U;

/**
 * One triple, as {@link tripleNesting} creates it. {@link triples} wraps its triples in a basic
 * graph pattern.
 */
export type TripleNestingInput<
  S extends SubjectInput = SubjectInput,
  P extends PredicateInput = PredicateInput,
  O extends ObjectInput = ObjectInput,
> = Override<
  AST.TripleNesting,
  {
    /** The triple subject. */
    subject: S;
    /** The triple predicate. */
    predicate: P;
    /** The triple object. */
    object: O;
  }
>;

/** The `[[a, b, ...]]` tuple syntax of an RDF list, written `( a b ... )` in SPARQL. */
export type TripleCollectionListInputSyntax = [GraphNodeInput[]];

/** An RDF list in AST form: `rdf:first`/`rdf:rest` triples rooted at a blank node. */
export type TripleCollectionListInputBase = Override<
  AST.TripleCollectionList,
  {
    /** The `rdf:first` and `rdf:rest` triples of the list. */
    triples: TripleNestingInput[];
    /** The blank node of the list's first cell, used where the list appears. */
    identifier: TermBlankInput;
  }
>;

/** An RDF list in AST or tuple syntax. */
export type TripleCollectionListInput =
  | TripleCollectionListInputBase
  | TripleCollectionListInputSyntax;

/**
 * The tuple syntax of a blank node property list, `[ p o ]` in SPARQL: `[predicate, object]`,
 * or a one-element array holding a {@link predicates} collection.
 */
export type TripleCollectionBlankNodePropertiesInputSyntax =
  | [PredicatePairCollection]
  | [PredicateInput, ObjectColletion | ObjectInput];

/** A blank node property list in AST form: triples sharing one blank node subject. */
export type TripleCollectionBlankNodePropertiesInputBase = Override<
  AST.TripleCollectionBlankNodeProperties,
  {
    /** The triples, each with `identifier` as subject. */
    triples: TripleNestingInput[];
    /** The blank node the properties describe, used where the list appears. */
    identifier: TermBlankInput;
  }
>;

/** A blank node property list in AST or tuple syntax. */
export type TripleCollectionBlankNodePropertiesInput =
  | TripleCollectionBlankNodePropertiesInputBase
  | TripleCollectionBlankNodePropertiesInputSyntax;

/** An RDF list or blank node property list, in AST or tuple syntax. */
export type TripleCollectionInput =
  | TripleCollectionListInput
  | TripleCollectionBlankNodePropertiesInput;

/** The triples and triple collections of a basic graph pattern. */
export type BasicGraphPatternInput = (TripleCollectionInput | TripleNestingInput)[];

/** A basic graph pattern: triples matched together, as {@link bgp} or {@link triples} create it. */
export type PatternBgpInput = Override<
  AST.PatternBgp,
  {
    /** The triples and triple collections. */
    triples: BasicGraphPatternInput;
  }
>;

/** A group graph pattern, `{ ... }` in SPARQL. */
export type PatternGroupInput<P extends ExtensionPattern = never> = Override<
  AST.PatternGroup,
  {
    /** The patterns inside the braces. */
    patterns: PatternInput<P>[];
  }
>;

/** A `UNION` of graph pattern groups. */
export type PatternUnionInput<P extends ExtensionPattern = never> = Override<
  AST.PatternUnion,
  {
    /** The alternatives, one group per branch. */
    patterns: PatternGroupInput<P>[];
  }
>;

/** An `OPTIONAL` graph pattern. */
export type PatternOptionalInput<P extends ExtensionPattern = never> = Override<
  AST.PatternOptional,
  {
    /** The patterns matched optionally. */
    patterns: PatternInput<P>[];
  }
>;

/** A `MINUS` graph pattern. */
export type PatternMinusInput<P extends ExtensionPattern = never> = Override<
  AST.PatternMinus,
  {
    /** The patterns whose compatible solutions are removed. */
    patterns: PatternInput<P>[];
  }
>;

/** A `GRAPH` pattern and its graph name. */
export type PatternGraphInput<P extends ExtensionPattern = never> = Override<
  AST.PatternGraph,
  {
    /** The graph IRI, or a variable that ranges over named graphs. */
    name: TermIriInput | TermVariableInput;
    /** The patterns matched in that graph. */
    patterns: PatternInput<P>[];
  }
>;

/** A `SERVICE` pattern and its endpoint. */
export type PatternServiceInput<P extends ExtensionPattern = never> = Override<
  AST.PatternService,
  {
    /** The endpoint IRI, or a variable bound to one. */
    name: TermIriInput | TermVariableInput;
    /** The patterns sent to the endpoint. */
    patterns: PatternInput<P>[];
  }
>;

/** A `FILTER` expression in a graph pattern. */
export type PatternFilterInput = Override<
  AST.PatternFilter,
  {
    /** The boolean expression a solution must satisfy. */
    expression: ExpressionInput;
  }
>;

/** A `BIND` expression and its target variable. */
export type PatternBindInput<
  // `any` by default: pattern lists accept a BIND of any value type.
  T extends QueryReturnType = any,
  K extends Presence = Presence.required,
> = Override<
  AST.PatternBind,
  {
    /** The expression whose value is bound. */
    expression: ExpressionInput<T>;
    /** The variable that receives the value. */
    variable: TermVariableInput<T, K>;
  }
>;

/** A `VALUES` pattern and its variable columns. */
export type PatternValuesInput = Override<
  AST.PatternValues,
  {
    /** The variables, in column order. */
    variables: TermVariableInput[];
    /** The value columns, keyed by variable name. */
    values: ValuePatternColumnsInput;
  }
>;

/** Columns of values keyed by variable name; `undefined` represents an unbound value. */
export type ValuePatternColumnsInput = Override<
  AST.ValuePatternRow,
  {
    [x: string]: (TermIriInput | TermLiteralInput | Placeholder | undefined)[];
  }
>;

/** A graph pattern input, including dialect extensions and subqueries. */
export type PatternInput<P extends ExtensionPattern = never> =
  | P
  | PatternBgpInput
  | PatternGroupInput<P>
  | PatternUnionInput<P>
  | PatternOptionalInput<P>
  | PatternMinusInput<P>
  | PatternGraphInput<P>
  | PatternServiceInput<P>
  | PatternFilterInput
  | PatternBindInput
  | PatternValuesInput
  | RawPatternInput
  | QuerySelectInput<P>;

/** The `FROM` and `FROM NAMED` clauses of a query, or `USING` clauses of an update. */
export type DatasetClausesInput = Override<
  AST.DatasetClauses,
  {
    /** The clauses; `clauseType` is `'default'` for `FROM` and `'named'` for `FROM NAMED`. */
    clauses: Override<
      AST.DatasetClauses['clauses'][number],
      {
        /** The graph IRI. */
        value: TermIriInput;
      }
    >[];
  }
>;

/** A `GROUP BY` expression bound to a variable, `( expression AS ?variable )` in SPARQL. */
export type SolutionModifierGroupBindInput = Override<
  AST.SolutionModifierGroupBind,
  {
    /** The variable that receives the grouping value. */
    variable: TermVariableInput;
    /** The grouping expression. */
    value: ExpressionInput;
  }
>;

/** The `GROUP BY` modifier. */
export type SolutionModifierGroupInput = Override<
  AST.SolutionModifierGroup,
  {
    /** The grouping expressions, plain or bound to a variable. */
    groupings: (ExpressionInput | SolutionModifierGroupBindInput)[];
  }
>;

/** The `HAVING` modifier. */
export type SolutionModifierHavingInput = Override<
  AST.SolutionModifierHaving,
  {
    /** The conditions each group must satisfy. */
    having: ExpressionInput[];
  }
>;

/** One `ORDER BY` key: an expression and a direction, as {@link asc} and {@link desc} create. */
export type OrderingInput = Override<
  AST.Ordering,
  {
    /** The expression to sort by. */
    expression: ExpressionInput;
  }
>;

/** The `ORDER BY` modifier. */
export type SolutionModifierOrderInput = Override<
  AST.SolutionModifierOrder,
  {
    /** The sort keys, most significant first. */
    orderDefs: OrderingInput[];
  }
>;

/** The `LIMIT` and `OFFSET` modifiers. */
export type SolutionModifierLimitOffsetInput = Override<
  AST.SolutionModifierLimitOffset,
  { limit?: number | Placeholder<string, number>; offset?: number | Placeholder<string, number> }
>;

/** Solution modifiers applied to a query. */
export type SolutionModifiersInput = Override<
  AST.SolutionModifiers,
  {
    /** The `GROUP BY` modifier. */
    group?: SolutionModifierGroupInput | undefined;
    /** The `HAVING` modifier. */
    having?: SolutionModifierHavingInput | undefined;
    /** The `ORDER BY` modifier. */
    order?: SolutionModifierOrderInput | undefined;
    /** The `LIMIT` and `OFFSET` modifiers. */
    limitOffset?: SolutionModifierLimitOffsetInput | undefined;
  }
>;

/** A prefix declaration with a full IRI. */
export type ContextDefinitionPrefixInput = Override<
  AST.ContextDefinitionPrefix,
  {
    /** The namespace IRI the prefix stands for. */
    value: TermIriFullInput;
  }
>;

/** A base IRI declaration. */
export type ContextDefinitionBaseInput = Override<
  AST.ContextDefinitionBase,
  {
    /** The base IRI that relative IRIs resolve against. */
    value: TermIriFullInput;
  }
>;

/** A prefix or base IRI declaration. */
export type ContextDefinitionInput = ContextDefinitionPrefixInput | ContextDefinitionBaseInput;

type QuerySubtypeInput<TQuery extends AST.Query, TOverrides extends object = {}> = Override<
  TQuery,
  Override<Omit<QueryBaseInput, 'subType'>, TOverrides>
>;

/** A `SELECT` query input. */
export type QuerySelectInput<P extends ExtensionPattern = never> = QuerySubtypeInput<
  AST.QuerySelect,
  {
    /** The projection: variables and bindings, or `[wildcard]` for `SELECT *`. */
    variables: (TermVariableInput | PatternBindInput)[] | [WildcardInput];
    /** The `WHERE` group pattern. */
    where: PatternGroupInput<P>;
  }
>;

/** An `ASK` query input. */
export type QueryAskInput = QuerySubtypeInput<
  AST.QueryAsk,
  {
    /** The `WHERE` group pattern. */
    where: PatternGroupInput;
  }
>;

/** A `DESCRIBE` query input. */
export type QueryDescribeInput = QuerySubtypeInput<
  AST.QueryDescribe,
  {
    /** The resources to describe, or `[wildcard]` for `DESCRIBE *`. */
    variables: (TermVariableInput | TermIriInput)[] | [WildcardInput];
  }
>;
/** A `CONSTRUCT` query input. */
export type QueryConstructInput = QuerySubtypeInput<
  AST.QueryConstruct,
  {
    /** The triples to produce for each solution. */
    template: PatternBgpInput;
    /** The `WHERE` group pattern. */
    where: PatternGroupInput;
  }
>;

/** Fields shared by query inputs. */
export type QueryBaseInput = Override<
  AST.QueryBase,
  {
    /** The prefix and base declarations. */
    context: ContextDefinitionInput[];
    /** The `VALUES` block after the query. */
    values?: PatternValuesInput;
    /** The `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT` and `OFFSET` modifiers. */
    solutionModifiers: SolutionModifiersInput;
    /** The `FROM` and `FROM NAMED` clauses. */
    datasets: DatasetClausesInput;
    /** The `WHERE` group pattern. */
    where?: PatternGroupInput;
  }
>;

/** A `SELECT`, `ASK`, `DESCRIBE`, or `CONSTRUCT` query input. */
export type QueryInput =
  | QuerySelectInput
  | QueryAskInput
  | QueryDescribeInput
  | QueryConstructInput;

/**
 * Anything accepted where SPARQL expects an expression: a term input, a placeholder, or an
 * operation, function call, aggregate or raw `sparql` expression.
 *
 * @typeParam _T - The JavaScript type the expression yields in a result row when selected.
 */
export type ExpressionInput<_T = any> =
  | Placeholder
  | TermIriInput
  | TermLiteralInput
  | TermVariableInput<_T>
  | ExpressionOperationInput<_T>
  | ExpressionPatternOperationInput<_T>
  | ExpressionFunctionCallInput<_T>
  | ExpressionAggregateInput<_T>
  | RawExpressionInput<_T>;

/** An RDF/JS named node returned by a query. */
export type TermIriOutput = RdfJs.NamedNode;
/** An RDF/JS blank node returned by a query. */
export type TermBlankOutput = RdfJs.BlankNode;
/** An RDF/JS literal returned by a query. */
export type TermLiteralOutput = RdfJs.Literal;

/** The RDF/JS term returned for a bound variable that no cast or codec decodes. */
export type DefaultQueryReturnType = TermIriOutput | TermBlankOutput | TermLiteralOutput;
/**
 * A value a query variable can have in a result row: an RDF/JS term, or whatever a cast or
 * codec decodes it to.
 */
export type QueryReturnType = unknown;

/**
 * A function that converts the bound RDF/JS term of a variable into its row value.
 *
 * @typeParam T - The row value.
 * @typeParam K - Extra arguments after the term.
 */
export type TermVariableTransform<
  T extends QueryReturnType = QueryReturnType,
  K extends any[] = [],
> = (self: DefaultQueryReturnType, ...other: K) => T;

/** A transform that also receives `undefined` for an unbound variable and may return it. */
export type TermVariableOptionalTransform<
  T extends QueryReturnType = QueryReturnType,
  K extends any[] = [],
> = (self: DefaultQueryReturnType | undefined, ...other: K) => T | undefined;

/** @internal The optional result transform an expression carries into a binding. */
export type TransformExpression<T> = {
  /** Converts the bound term of the expression's result to the row value. */
  transform?: TermVariableTransform<T>;
};

/** An operator or built-in function applied to expressions, such as `gt` or `strlen`. */
export type ExpressionOperationInput<_T> = Override<
  AST.ExpressionOperation & TransformExpression<_T>,
  {
    /** The arguments to the expression. */
    args: ExpressionInput<any>[];
  }
>;

/** `EXISTS` or `NOT EXISTS` over a group graph pattern. */
export type ExpressionPatternOperationInput<_T> = Override<
  AST.ExpressionPatternOperation & TransformExpression<_T>,
  {
    /** The group pattern tested for a match. */
    args: PatternGroupInput;
  }
>;

/** A call of a function identified by IRI, such as an extension or XSD cast function. */
export type ExpressionFunctionCallInput<_T> = Override<
  AST.ExpressionFunctionCall & TransformExpression<_T>,
  {
    /** The function IRI. */
    function: TermIriInput;
    /** The arguments to the expression. */
    args: ExpressionInput<any>[];
  }
>;

/** An aggregate expression, such as `count`, `sum` or `groupConcat`. */
export type ExpressionAggregateInput<_T> =
  | ExpressionAggregateDefaultInput<_T>
  | ExpressionAggregateOnWildcardInput<_T>
  | ExpressionAggregateSeparatorInput<_T>;

/** An aggregate over an expression, such as `SUM( ?price )`. */
export type ExpressionAggregateDefaultInput<_T> = Override<
  AST.ExpressionAggregateDefault & TransformExpression<_T>,
  {
    /** The aggregated expression, as a one-element tuple. */
    expression: [ExpressionInput<any>];
  }
>;

/** An aggregate over all solutions, `COUNT( * )`. */
export type ExpressionAggregateOnWildcardInput<_T> = Override<
  AST.ExpressionAggregateOnWildcard & TransformExpression<_T>,
  {
    /** The wildcard, as a one-element tuple. */
    expression: [WildcardInput];
  }
>;

/** A `GROUP_CONCAT` aggregate with a `SEPARATOR`. */
export type ExpressionAggregateSeparatorInput<_T> = Override<
  AST.ExpressionAggregateSeparator & TransformExpression<_T>,
  {
    /** The concatenated expression, as a one-element tuple. */
    expression: [ExpressionInput<any>];
  }
>;

/** The `*` of `SELECT *`, `DESCRIBE *` or `COUNT( * )`. */
export type WildcardInput = AST.Wildcard;

/** A query or update in AST form. */
export type SparqlQueryInput = QueryInput | UpdateInput;

/** A SPARQL update request: operations separated by `;`, each with its own prologue. */
export type UpdateInput = Override<
  AST.Update,
  {
    /** The operations, in execution order. */
    updates: Override<
      AST.Update['updates'][number],
      {
        /** The operation; absent for a prologue with no operation after it. */
        operation?: UpdateOperationInput;
        /** The prefix and base declarations. */
        context: ContextDefinitionInput[];
      }
    >[];
  }
>;

/** One SPARQL update operation, such as `INSERT DATA` or `DROP`. */
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

/** A `LOAD` operation. */
export type UpdateOperationLoadInput = Override<
  AST.UpdateOperationLoad,
  {
    /** The IRI of the RDF document to load. */
    source: TermIriInput;
    /** The graph to load into; the default graph when omitted. */
    destination?: GraphRefSpecificInput;
  }
>;

/** `ALL`: every graph. */
export type GraphRefAllInput = AST.GraphRefAll;
/** `NAMED`: every named graph. */
export type GraphRefNamedInput = AST.GraphRefNamed;
/** `DEFAULT`: the default graph. */
export type GraphRefDefaultInput = AST.GraphRefDefault;

/** `GRAPH <iri>`: one graph by IRI. */
export type GraphRefSpecificInput = Override<
  AST.GraphRefSpecific,
  {
    /** The graph IRI. */
    graph: TermIriInput;
  }
>;

/** The graphs a graph management operation, such as `CLEAR` or `DROP`, applies to. */
export type GraphRefInput =
  | GraphRefDefaultInput
  | GraphRefNamedInput
  | GraphRefAllInput
  | GraphRefSpecificInput;

/** A `CLEAR` operation. */
export type UpdateOperationClearInput = Override<
  AST.UpdateOperationClear,
  {
    /** The graphs to clear. */
    destination: GraphRefInput;
  }
>;

/** A `DROP` operation. */
export type UpdateOperationDropInput = Override<
  AST.UpdateOperationDrop,
  {
    /** The graphs to drop. */
    destination: GraphRefInput;
  }
>;

/** A `CREATE` operation. */
export type UpdateOperationCreateInput = Override<
  AST.UpdateOperationCreate,
  {
    /** The graph to create. */
    destination: GraphRefSpecificInput;
  }
>;

/** An `ADD` operation. */
export type UpdateOperationAddInput = Override<
  AST.UpdateOperationAdd,
  {
    /** The graph to read from. */
    source: GraphRefDefaultInput | GraphRefSpecificInput;
    /** The graph to write to. */
    destination: GraphRefDefaultInput | GraphRefSpecificInput;
  }
>;

/** A `MOVE` operation. */
export type UpdateOperationMoveInput = Override<
  AST.UpdateOperationMove,
  {
    /** The graph to read from. */
    source: GraphRefDefaultInput | GraphRefSpecificInput;
    /** The graph to write to. */
    destination: GraphRefDefaultInput | GraphRefSpecificInput;
  }
>;

/** A `COPY` operation. */
export type UpdateOperationCopyInput = Override<
  AST.UpdateOperationCopy,
  {
    /** The graph to read from. */
    source: GraphRefDefaultInput | GraphRefSpecificInput;
    /** The graph to write to. */
    destination: GraphRefDefaultInput | GraphRefSpecificInput;
  }
>;

/** An `INSERT DATA` operation. */
export type UpdateOperationInsertDataInput = Override<
  AST.UpdateOperationInsertData,
  {
    /** The ground triples to insert, optionally inside `GRAPH` blocks. */
    data: QuadsInput[];
  }
>;

/** A `DELETE DATA` operation. */
export type UpdateOperationDeleteDataInput = Override<
  AST.UpdateOperationDeleteData,
  {
    /** The ground triples to delete, optionally inside `GRAPH` blocks. */
    data: QuadsInput[];
  }
>;

/** A `DELETE WHERE` operation. */
export type UpdateOperationDeleteWhereInput = Override<
  AST.UpdateOperationDeleteWhere,
  {
    /** The triple patterns to match and delete, optionally inside `GRAPH` blocks. */
    data: QuadsInput[];
  }
>;

/** A `DELETE`/`INSERT ... WHERE` operation. */
export type UpdateOperationModifyInput = Override<
  AST.UpdateOperationModify,
  {
    /** The `WITH` graph, or `undefined` for none. */
    graph: TermIriInput | undefined;
    /** The `INSERT` template, instantiated for each solution. */
    insert: QuadsInput[];
    /** The `DELETE` template, instantiated for each solution. */
    delete: QuadsInput[];
    /** The `USING` and `USING NAMED` clauses. */
    from: DatasetClausesInput;
    /** The `WHERE` group pattern. */
    where: PatternGroupInput;
  }
>;

/** Triples of an update, in the default graph or inside a `GRAPH` block. */
export type QuadsInput = PatternBgpInput | GraphQuadsInput;

/** A `GRAPH` block of triples in an update. */
export type GraphQuadsInput = Override<
  AST.GraphQuads,
  {
    /** The graph IRI, or a variable in an update template. */
    graph: TermIriInput | TermVariableInput;
    /** The triples inside the block. */
    triples: PatternBgpInput;
  }
>;

/** A sequence (`/`) or alternative (`|`) of property paths; `subType` says which. */
export type PropertyPathChainInput = Override<
  AST.PropertyPathChain,
  {
    /** The paths, in order. */
    items: PathInput[];
  }
>;

/** A property path with a `?`, `*` or `+` modifier, or inverted with `^`. */
export type PathModifiedInput = Override<
  AST.PathModified,
  {
    /** The modified path, as a one-element tuple. */
    items: [PathInput];
  }
>;

/** An inverse IRI, `^iri`, inside a negated property set. */
export type PathNegatedEltInput = Override<
  AST.PathNegatedElt,
  {
    /** The inverted IRI, as a one-element tuple. */
    items: [TermIriInput];
  }
>;

/** The `|` alternatives inside a negated property set, `!( a | ^b )`. */
export type PathAlternativeLimitedInput = Override<
  AST.PathAlternativeLimited,
  {
    /** The IRIs and inverse IRIs. */
    items: (TermIriInput | PathNegatedEltInput)[];
  }
>;

/** A negated property set, `!iri` or `!( ... )`. */
export type PathNegatedInput = Override<
  AST.PathNegated,
  {
    /** The excluded IRI or set, as a one-element tuple. */
    items: [TermIriInput | PathNegatedEltInput | PathAlternativeLimitedInput];
  }
>;

/** A predicate IRI or a property path built from IRIs. */
export type PathInput =
  | TermIriInput
  | PropertyPathChainInput
  | PathModifiedInput
  | PathNegatedInput;

/**
 * The term factories a database passes to a {@link Formatter}'s `format`. They build plain
 * terms and do not apply the database's formatters again.
 */
export type FactoryFunctions = {
  /** Creates a variable term from a name without the `?`. */
  variable: (value: string) => AST.TermVariable;
  /** Creates a full IRI term, or a prefixed one, `prefix:value`, when `prefix` is given. */
  iri: (value: string, prefix?: string) => AST.TermIri;
  /** Creates a blank node with the given label, or a fresh one without a label. */
  blank: (value?: string) => AST.TermBlank;
  /** Creates a literal, with an optional language tag (a string) or datatype IRI. */
  literal: (value: string, lang?: string | TermIriInput) => AST.TermLiteral;
};

/**
 * Whether a selected variable is always bound in results.
 *
 * Set it with {@link maybe} and {@link always}. An optional variable's row type includes
 * `undefined`; patterns such as {@link optional} do not set it for you.
 */
export enum Presence {
  /** Always bound; the row type has no `undefined`. This is the default. */
  required = 'required',
  /** May be unbound; the row type includes `undefined`. */
  optional = 'optional',
}

/**
 * How the managers of {@link SparqlDatabase.createManagers} treat names that were not
 * configured.
 */
export enum Strictness {
  /** Only configured variable names and prefix fields exist; others are `undefined`. */
  strict = 'strict',
  /** Any variable name or prefix field can be used. This is the default. */
  loose = 'loose',
}

/** @internal An AST node with a string `type` discriminator and a source location. */
export type Node = Override<
  AST.Wildcard,
  {
    /** The AST node discriminator. */
    type: string;
  }
>;
