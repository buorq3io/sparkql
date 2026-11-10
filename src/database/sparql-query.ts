import type * as AST from '@traqula/rules-sparql-1-1';
import type {
  BasicGraphPatternInput,
  ContextDefinitionInput,
  DatasetClausesInput,
  ExpressionInput,
  FactoryFunctions,
  GraphNodeInput,
  GraphRefDefaultInput,
  GraphRefInput,
  GraphRefSpecificInput,
  PathAlternativeLimitedInput,
  PathInput,
  PathNegatedEltInput,
  PatternBgpInput,
  PatternBindInput,
  PatternFilterInput,
  PatternGraphInput,
  PatternGroupInput,
  PatternInput,
  PatternMinusInput,
  PatternOptionalInput,
  PatternServiceInput,
  PatternUnionInput,
  PatternValuesInput,
  QuadsInput,
  QueryAskInput,
  QueryBaseInput,
  QueryConstructInput,
  QueryDescribeInput,
  QueryInput,
  QuerySelectInput,
  SolutionModifiersInput,
  SparqlQueryInput,
  TermInput,
  TermIriInput,
  TripleCollectionBlankNodePropertiesInputBase,
  TripleCollectionListInputBase,
  TripleNestingInput,
  UpdateInput,
  UpdateOperationAddInput,
  UpdateOperationClearInput,
  UpdateOperationCopyInput,
  UpdateOperationCreateInput,
  UpdateOperationDeleteDataInput,
  UpdateOperationDeleteWhereInput,
  UpdateOperationDropInput,
  UpdateOperationInput,
  UpdateOperationInsertDataInput,
  UpdateOperationLoadInput,
  UpdateOperationModifyInput,
  UpdateOperationMoveInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';
import {
  isObjectLike,
  isWildCardInputArray,
  term,
  termBlank,
  termExpression,
  termGraph,
  termIri,
  termValues,
  termVariable,
  tripleCollectionBlankNodePropertiesInputBase,
  tripleCollectionListInputBase,
} from '../helpers/utilities.js';
import type { AnySparqlDialect, DialectAST, SparqlDialect } from './dialect.js';
import { SparkqlError, SparkqlNormalizationError } from './errors.js';
import { ExecutableQuery } from './executable.js';
import {
  containsPlaceholder,
  type PlaceholderCarrier,
  PreparedQuery,
  type placeholderTypes,
  prepareTemplate,
} from './prepared.js';
import type { QueryModuleContext } from './query-module.js';
import type {
  RawASTValue,
  RawExpression,
  RawExpressionInput,
  RawPattern,
  RawPatternInput,
  RawValue,
} from './raw.js';

type ASTConfig<T extends SparqlQueryInput> = T extends UpdateInput
  ? AST.Update
  : T extends QuerySelectInput
    ? AST.QuerySelect
    : T extends QueryConstructInput
      ? AST.QueryConstruct
      : T extends QueryDescribeInput
        ? AST.QueryDescribe
        : T extends QueryAskInput
          ? AST.QueryAsk
          : never;

export abstract class SparqlQueryBuilderBase<
  Config extends SparqlQueryInput,
  Return,
  D extends AnySparqlDialect = SparqlDialect,
> extends ExecutableQuery<Return> {
  protected readonly config: Config;
  protected readonly dialect: AnySparqlDialect;
  protected readonly factoryFunctions: FactoryFunctions;
  /** The database context this builder was created from; nested builders reuse it. */
  protected readonly builderContext: QueryModuleContext<D>;
  protected readonly anonymousBlanks: Map<symbol, AST.TermBlank>;

  protected constructor(initialConfig: Config, context: QueryModuleContext<D>) {
    super(context);
    this.config = initialConfig;
    this.builderContext = context;
    this.anonymousBlanks = new Map<symbol, AST.TermBlank>();
    this.factoryFunctions = context.factory;
    this.dialect = context.dialect;
  }

  declare readonly [placeholderTypes]?: {};

  protected preparationInput(): Config {
    return this.config;
  }

  public prepare<T extends PlaceholderCarrier<object>>(
    this: T
  ): PreparedQuery<Return, NonNullable<T[typeof placeholderTypes]>>;
  public prepare(): PreparedQuery<Return, object> {
    const fill = prepareTemplate(this.preparationInput(), this.builderContext, config =>
      this.dialect.generator.generate(this.normalizeConfig(config))
    );
    return new PreparedQuery(fill, sparql => this.executeSPARQL(sparql));
  }

  public getSPARQL(): DialectAST<D, ASTConfig<Config>> {
    const config = this.preparationInput();
    if (containsPlaceholder(config)) {
      throw new SparkqlError({
        message: 'Queries with placeholders must be prepared before execution.',
      });
    }
    return this.normalizeConfig(config);
  }

  private normalizeConfig(config: Config): DialectAST<D, ASTConfig<Config>> {
    if (config.type === 'query') {
      return this.buildQuery(config) as unknown as DialectAST<D, ASTConfig<Config>>;
    }

    if (config.type === 'update') {
      return this.buildUpdate(config) as unknown as DialectAST<D, ASTConfig<Config>>;
    }

    throw new SparkqlNormalizationError('query', config);
  }

  protected override get operationName(): string {
    return this.config.type === 'update' ? 'update' : this.config.subType;
  }

  public toSPARQL(): string {
    return this.dialect.generator.generate(this.getSPARQL());
  }

  private buildQuery(query: QueryInput): AST.Query {
    switch (query.subType) {
      case 'select':
        return this.buildSelectQuery(query);
      case 'construct':
        return this.buildConstructQuery(query);
      case 'describe':
        return this.buildDescribeQuery(query);
      case 'ask':
        return this.buildAskQuery(query);
      default:
        throw new SparkqlNormalizationError('query', query);
    }
  }

  private buildQueryBase(query: QueryBaseInput): Omit<AST.QueryBase, 'subType' | 'where'> {
    return {
      type: 'query',
      loc: query.loc,
      context: query.context.map(context => this.sanitizeContextDefinition(context)),
      ...(query.values ? { values: this.sanitizePatternValues(query.values) } : {}),
      solutionModifiers: this.sanitizeSolutionModifiers(query.solutionModifiers),
      datasets: this.sanitizeDatasetClauses(query.datasets),
    };
  }

  private buildSelectQuery(query: QuerySelectInput): AST.QuerySelect {
    const base = this.buildQueryBase(query);

    return {
      ...base,
      subType: 'select',
      ...(query.distinct ? { distinct: true as const } : {}),
      ...(query.reduced ? { reduced: true as const } : {}),
      variables: this.sanitizeSelectVariables(query.variables),
      where: this.sanitizePatternBasic(query.where),
    };
  }

  private buildConstructQuery(query: QueryConstructInput): AST.QueryConstruct {
    const base = this.buildQueryBase(query);

    return {
      ...base,
      subType: 'construct',
      template: this.sanitizeBgpPattern(query.template),
      where: this.sanitizePatternBasic(query.where),
    };
  }

  private buildDescribeQuery(query: QueryDescribeInput): AST.QueryDescribe {
    const base = this.buildQueryBase(query);

    return {
      ...base,
      subType: 'describe',
      variables: this.sanitizeDescribeVariables(query.variables),
      ...(query.where ? { where: this.sanitizePatternBasic(query.where) } : {}),
    };
  }

  private buildAskQuery(query: QueryAskInput): AST.QueryAsk {
    const base = this.buildQueryBase(query);

    return {
      ...base,
      subType: 'ask',
      where: this.sanitizePatternBasic(query.where),
    };
  }

  private buildUpdate(update: UpdateInput): AST.Update {
    return {
      type: 'update',
      loc: update.loc,
      updates: update.updates.map(entry => ({
        context: entry.context.map(context => this.sanitizeContextDefinition(context)),
        ...(entry.operation ? { operation: this.sanitizeUpdateOperation(entry.operation) } : {}),
      })),
    };
  }

  private sanitizeUpdateOperation(operation: UpdateOperationInput): AST.UpdateOperation {
    switch (operation.subType) {
      case 'add':
        return this.sanitizeTransferOperation(operation);
      case 'move':
        return this.sanitizeTransferOperation(operation);
      case 'copy':
        return this.sanitizeTransferOperation(operation);
      case 'insertdata':
        return this.sanitizeDataOperation(operation);
      case 'deletedata':
        return this.sanitizeDataOperation(operation);
      case 'deletewhere':
        return this.sanitizeDataOperation(operation);
      case 'clear':
        return this.sanitizeClearDropOperation(operation);
      case 'drop':
        return this.sanitizeClearDropOperation(operation);
      case 'create':
        return this.sanitizeCreateOperation(operation);
      case 'load':
        return this.sanitizeLoadOperation(operation);
      case 'modify':
        return this.sanitizeModifyOperation(operation);
      default:
        throw new SparkqlNormalizationError('update', operation);
    }
  }

  private sanitizeContextDefinition(context: ContextDefinitionInput): AST.ContextDefinition {
    return {
      ...context,
      value: termIri.parseOrThrow(context.value, this.factoryFunctions),
    };
  }

  private sanitizeDatasetClauses(datasets: DatasetClausesInput): AST.DatasetClauses {
    return {
      ...datasets,
      clauses: datasets.clauses.map(clause => ({
        ...clause,
        value: termIri.parseOrThrow(clause.value, this.factoryFunctions),
      })),
    };
  }

  private sanitizeSolutionModifiers(modifiers: SolutionModifiersInput): AST.SolutionModifiers {
    return {
      ...(modifiers.group
        ? {
            group: {
              ...modifiers.group,
              groupings: modifiers.group.groupings.map(grouping => this.sanitizeGrouping(grouping)),
            },
          }
        : {}),
      ...(modifiers.having
        ? {
            having: {
              ...modifiers.having,
              having: modifiers.having.having.map(expression =>
                this.sanitizeExpression(expression)
              ),
            },
          }
        : {}),
      ...(modifiers.order
        ? {
            order: {
              ...modifiers.order,
              orderDefs: modifiers.order.orderDefs.map(ordering => ({
                ...ordering,
                expression: this.sanitizeExpression(ordering.expression),
              })),
            },
          }
        : {}),
      ...(modifiers.limitOffset
        ? { limitOffset: modifiers.limitOffset as AST.SolutionModifierLimitOffset }
        : {}),
    };
  }

  private sanitizeGrouping(
    grouping: NonNullable<SolutionModifiersInput['group']>['groupings'][number]
  ): NonNullable<AST.SolutionModifiers['group']>['groupings'][number] {
    if (isObjectLike(grouping) && 'variable' in grouping) {
      return {
        ...grouping,
        variable: termVariable.parseOrThrow(grouping.variable, this.factoryFunctions),
        value: this.sanitizeExpression(grouping.value),
      };
    }

    return this.sanitizeExpression(grouping);
  }

  private sanitizeSelectVariables(
    variables: QuerySelectInput['variables']
  ): AST.QuerySelect['variables'] {
    if (isWildCardInputArray(variables)) {
      return variables;
    }

    return variables.map(variable => {
      if (variable.type === 'term') {
        return termVariable.parseOrThrow(variable, this.factoryFunctions);
      }

      return this.sanitizePatternBind(variable);
    });
  }

  private sanitizeDescribeVariables(
    variables: QueryDescribeInput['variables']
  ): AST.QueryDescribe['variables'] {
    if (isWildCardInputArray(variables)) {
      return variables;
    }

    return variables.map(variable => termGraph.parseOrThrow(variable, this.factoryFunctions));
  }

  private sanitizeGraphRef(ref: GraphRefSpecificInput): AST.GraphRefSpecific;
  private sanitizeGraphRef(ref: GraphRefSpecificInput | GraphRefDefaultInput): AST.GraphRefDefault;
  private sanitizeGraphRef(ref: GraphRefInput): AST.GraphRef;
  private sanitizeGraphRef(ref: GraphRefInput): AST.GraphRef {
    if (ref.subType === 'specific') {
      return {
        ...ref,
        graph: termIri.parseOrThrow(ref.graph, this.factoryFunctions),
      };
    }
    return ref;
  }

  private sanitizeTransferOperation(operation: UpdateOperationAddInput): AST.UpdateOperationAdd;
  private sanitizeTransferOperation(operation: UpdateOperationMoveInput): AST.UpdateOperationMove;
  private sanitizeTransferOperation(operation: UpdateOperationCopyInput): AST.UpdateOperationCopy;
  private sanitizeTransferOperation(
    operation: UpdateOperationAddInput | UpdateOperationMoveInput | UpdateOperationCopyInput
  ): AST.UpdateOperationAdd | AST.UpdateOperationMove | AST.UpdateOperationCopy {
    return {
      ...operation,
      source: this.sanitizeGraphRef(operation.source),
      destination: this.sanitizeGraphRef(operation.destination),
    };
  }

  private sanitizeDataOperation(
    operation: UpdateOperationInsertDataInput
  ): AST.UpdateOperationInsertData;
  private sanitizeDataOperation(
    operation: UpdateOperationDeleteDataInput
  ): AST.UpdateOperationDeleteData;
  private sanitizeDataOperation(
    operation: UpdateOperationDeleteWhereInput
  ): AST.UpdateOperationDeleteWhere;
  private sanitizeDataOperation(
    operation:
      | UpdateOperationInsertDataInput
      | UpdateOperationDeleteDataInput
      | UpdateOperationDeleteWhereInput
  ):
    | AST.UpdateOperationInsertData
    | AST.UpdateOperationDeleteData
    | AST.UpdateOperationDeleteWhere {
    return {
      ...operation,
      data: operation.data.map(quads => this.sanitizeQuads(quads)),
    };
  }

  private sanitizeClearDropOperation(
    operation: UpdateOperationClearInput
  ): AST.UpdateOperationClear;
  private sanitizeClearDropOperation(operation: UpdateOperationDropInput): AST.UpdateOperationDrop;
  private sanitizeClearDropOperation(
    operation: UpdateOperationClearInput | UpdateOperationDropInput
  ): AST.UpdateOperationClear | AST.UpdateOperationDrop {
    return {
      ...operation,
      destination: this.sanitizeGraphRef(operation.destination),
    };
  }

  private sanitizeCreateOperation(
    operation: UpdateOperationCreateInput
  ): AST.UpdateOperationCreate {
    return {
      ...operation,
      destination: this.sanitizeGraphRef(operation.destination),
    };
  }

  private sanitizeLoadOperation(operation: UpdateOperationLoadInput): AST.UpdateOperationLoad {
    return {
      ...operation,
      source: termIri.parseOrThrow(operation.source, this.factoryFunctions),
      ...(operation.destination
        ? { destination: this.sanitizeGraphRef(operation.destination) }
        : { destination: undefined }),
    };
  }

  private sanitizeModifyOperation(
    operation: UpdateOperationModifyInput
  ): AST.UpdateOperationModify {
    return {
      ...operation,
      graph: operation.graph
        ? termIri.parseOrThrow(operation.graph, this.factoryFunctions)
        : undefined,
      insert: operation.insert.map(quads => this.sanitizeQuads(quads)),
      delete: operation.delete.map(quads => this.sanitizeQuads(quads)),
      from: this.sanitizeDatasetClauses(operation.from),
      where: this.sanitizePatternBasic(operation.where),
    };
  }

  protected sanitizeExpression(expression: ExpressionInput): AST.Expression {
    if (isObjectLike(expression) && expression.type === 'expression') {
      switch (expression.subType) {
        case 'operation':
          return {
            ...expression,
            args: expression.args.map(arg => this.sanitizeExpression(arg)),
          };
        case 'functionCall':
          return {
            ...expression,
            function: termIri.parseOrThrow(expression.function, this.factoryFunctions),
            args: expression.args.map(arg => this.sanitizeExpression(arg)),
          };
        case 'patternOperation':
          return {
            ...expression,
            args: this.sanitizePatternBasic(expression.args),
          };
        case 'raw':
          return this.sanitizeRaw(expression) as unknown as AST.Expression;
        case 'aggregate':
          if (isWildCardInputArray(expression.expression)) {
            return {
              ...expression,
              expression: expression.expression,
            };
          }

          return {
            ...expression,
            expression: [this.sanitizeExpression(expression.expression[0])],
          };
        default:
          throw new SparkqlNormalizationError('expression', expression);
      }
    }

    if (termExpression.accepts(expression)) {
      return termExpression.parseOrThrow(expression, this.factoryFunctions);
    }

    throw new SparkqlNormalizationError('expression', expression);
  }

  protected sanitizeValuePatternColumns(columns: ValuePatternColumnsInput): AST.ValuePatternRow[] {
    const properties = Object.keys(columns);

    if (properties.length === 0) {
      return [];
    }

    const rowCount = columns[properties[0]]?.length ?? 0;
    const rows: AST.ValuePatternRow[] = [];

    for (let index = 0; index < rowCount; index++) {
      const row: AST.ValuePatternRow = {};

      for (const property of properties) {
        row[property] =
          columns[property][index] !== undefined
            ? termValues.parseOrThrow(columns[property][index], this.factoryFunctions)
            : undefined;
      }

      rows.push(row);
    }

    return rows;
  }

  protected sanitizePropertyPath(
    path: TermIriInput | PathNegatedEltInput | PathAlternativeLimitedInput
  ): AST.TermIri | AST.PathNegatedElt | AST.PathAlternativeLimited;
  protected sanitizePropertyPath(path: PathInput): AST.Path;
  protected sanitizePropertyPath(path: PathInput): AST.Path {
    if (termIri.accepts(path)) {
      return termIri.parseOrThrow(path, this.factoryFunctions);
    }

    switch (path.subType) {
      case '|':
      case '/':
        return {
          ...path,
          items: path.items.map(item => this.sanitizePropertyPath(item)),
        };
      case '?':
      case '*':
      case '+':
      case '^':
        return {
          ...path,
          items: [this.sanitizePropertyPath(path.items[0])],
        };
      case '!':
        return {
          ...path,
          items: [this.sanitizePropertyPath(path.items[0])],
        };
      default:
        throw new SparkqlNormalizationError('property path', path);
    }
  }

  private sanitizePredicate(
    predicate: TripleNestingInput['predicate']
  ): AST.TripleNesting['predicate'] {
    if (termGraph.accepts(predicate)) {
      return termGraph.parseOrThrow(predicate, this.factoryFunctions);
    }

    return this.sanitizePropertyPath(predicate);
  }

  private sanitizeGraphNode(node: GraphNodeInput): AST.GraphNode {
    if (tripleCollectionListInputBase.accepts(node)) {
      return this.sanitizeTripleCollectionListBase(
        tripleCollectionListInputBase.parseOrThrow(node, this.factoryFunctions)
      );
    }
    if (tripleCollectionBlankNodePropertiesInputBase.accepts(node)) {
      return this.sanitizeTripleCollectionBlankNodePropertiesBase(
        tripleCollectionBlankNodePropertiesInputBase.parseOrThrow(node, this.factoryFunctions)
      );
    }

    return this.sanitizeTerm(node);
  }

  private sanitizeTerm(term_: TermInput): AST.Term {
    if (term.accepts(term_)) {
      return term.parseOrThrow(term_, this.factoryFunctions);
    }
    throw new SparkqlNormalizationError('term', term_);
  }

  protected sanitizeTripleNesting(triple: TripleNestingInput): AST.TripleNesting {
    return {
      ...triple,
      predicate: this.sanitizePredicate(triple.predicate),
      subject: this.sanitizeGraphNode(triple.subject),
      object: this.sanitizeGraphNode(triple.object),
    };
  }

  protected sanitizeTripleCollectionListBase(
    collection: TripleCollectionListInputBase
  ): AST.TripleCollectionList {
    return {
      type: 'tripleCollection',
      subType: 'list',
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      identifier: termBlank.parseOrThrow(collection.identifier, this.factoryFunctions),
      triples: collection.triples.map(t => this.sanitizeTripleNesting(t)),
    };
  }

  protected sanitizeTripleCollectionBlankNodePropertiesBase(
    collection: TripleCollectionBlankNodePropertiesInputBase
  ): AST.TripleCollectionBlankNodeProperties {
    return {
      type: 'tripleCollection',
      subType: 'blankNodeProperties',
      loc: {
        sourceLocationType: 'autoGenerate',
      },
      identifier: termBlank.parseOrThrow(collection.identifier, this.factoryFunctions),
      triples: collection.triples.map(t => this.sanitizeTripleNesting(t)),
    };
  }

  protected sanitizeBasicGraph(bgraphs: BasicGraphPatternInput): AST.BasicGraphPattern {
    return bgraphs.flatMap(entry => {
      if (tripleCollectionListInputBase.accepts(entry)) {
        return this.sanitizeTripleCollectionListBase(
          tripleCollectionListInputBase.parseOrThrow(entry, this.factoryFunctions)
        );
      }
      if (tripleCollectionBlankNodePropertiesInputBase.accepts(entry)) {
        return this.sanitizeTripleCollectionBlankNodePropertiesBase(
          tripleCollectionBlankNodePropertiesInputBase.parseOrThrow(entry, this.factoryFunctions)
        );
      }
      return this.sanitizeTripleNesting(entry);
    });
  }

  private sanitizeBgpPattern(pattern: PatternBgpInput): AST.PatternBgp {
    return {
      ...pattern,
      triples: this.sanitizeBasicGraph(pattern.triples),
    };
  }

  private sanitizePatternBasic(pattern: PatternGroupInput): AST.PatternGroup;
  private sanitizePatternBasic(pattern: PatternOptionalInput): AST.PatternOptional;
  private sanitizePatternBasic(pattern: PatternMinusInput): AST.PatternMinus;
  private sanitizePatternBasic(
    pattern: PatternGroupInput | PatternOptionalInput | PatternMinusInput
  ): AST.PatternGroup | AST.PatternOptional | AST.PatternMinus {
    return {
      ...pattern,
      patterns: this.sanitizePatternList(pattern.patterns),
    };
  }
  private sanitizePatternBasicGraph(pattern: PatternGraphInput): AST.PatternGraph;
  private sanitizePatternBasicGraph(pattern: PatternServiceInput): AST.PatternService;
  private sanitizePatternBasicGraph(
    pattern: PatternGraphInput | PatternServiceInput
  ): AST.PatternGraph | AST.PatternService {
    return {
      ...pattern,
      name: termGraph.parseOrThrow(pattern.name, this.factoryFunctions),
      patterns: this.sanitizePatternList(pattern.patterns),
    };
  }

  private sanitizePatternUnion(pattern: PatternUnionInput): AST.PatternUnion {
    return {
      ...pattern,
      patterns: pattern.patterns.map(group => this.sanitizePatternBasic(group)),
    };
  }

  private sanitizePatternFilter(pattern: PatternFilterInput): AST.PatternFilter {
    return {
      ...pattern,
      expression: this.sanitizeExpression(pattern.expression),
    };
  }

  private sanitizePatternBind(pattern: PatternBindInput): AST.PatternBind {
    return {
      ...pattern,
      expression: this.sanitizeExpression(pattern.expression),
      variable: termVariable.parseOrThrow(pattern.variable, this.factoryFunctions),
    };
  }

  private sanitizePatternValues(pattern: PatternValuesInput): AST.PatternValues {
    return {
      ...pattern,
      variables: pattern.variables.map(variable =>
        termVariable.parseOrThrow(variable, this.factoryFunctions)
      ),
      values: this.sanitizeValuePatternColumns(pattern.values),
    };
  }

  private sanitizePatternList(patterns: PatternInput[]): AST.Pattern[] {
    return patterns.map(pattern => this.sanitizePattern(pattern));
  }

  protected sanitizePattern(pattern: PatternBgpInput): AST.PatternBgp;
  protected sanitizePattern(pattern: PatternOptionalInput): AST.PatternOptional;
  protected sanitizePattern(pattern: PatternGroupInput): AST.PatternGroup;
  protected sanitizePattern(pattern: PatternGraphInput): AST.PatternGraph;
  protected sanitizePattern(pattern: PatternMinusInput): AST.PatternMinus;
  protected sanitizePattern(pattern: PatternServiceInput): AST.PatternService;
  protected sanitizePattern(pattern: PatternUnionInput): AST.PatternUnion;
  protected sanitizePattern(pattern: PatternFilterInput): AST.PatternFilter;
  protected sanitizePattern(pattern: PatternBindInput): AST.PatternBind;
  protected sanitizePattern(pattern: PatternValuesInput): AST.PatternValues;
  protected sanitizePattern(pattern: QuerySelectInput): AST.QuerySelect;
  protected sanitizePattern(pattern: PatternInput): AST.Pattern;
  protected sanitizePattern(pattern: PatternInput): AST.Pattern {
    const candidate: unknown = pattern;
    if (this.dialect.patterns.is(candidate)) {
      // The runtime dialect erases its node types only at the normalization seam.
      // Public builders and getSPARQL retain the concrete dialect types.
      return this.dialect.patterns.normalize(candidate, {
        factory: this.factoryFunctions,
        pattern: value => this.sanitizePattern(value),
        expression: value => this.sanitizeExpression(value),
      }) as unknown as AST.Pattern;
    }
    if (pattern.type === 'query') {
      return this.buildSelectQuery(pattern);
    }

    switch (pattern.subType) {
      case 'raw':
        return this.sanitizeRaw(pattern) as unknown as AST.Pattern;
      case 'bgp':
        return this.sanitizeBgpPattern(pattern);
      case 'group':
        return this.sanitizePatternBasic(pattern);
      case 'optional':
        return this.sanitizePatternBasic(pattern);
      case 'graph':
        return this.sanitizePatternBasicGraph(pattern);
      case 'minus':
        return this.sanitizePatternBasic(pattern);
      case 'service':
        return this.sanitizePatternBasicGraph(pattern);
      case 'union':
        return this.sanitizePatternUnion(pattern);
      case 'filter':
        return this.sanitizePatternFilter(pattern);
      case 'bind':
        return this.sanitizePatternBind(pattern);
      case 'values':
        return this.sanitizePatternValues(pattern);
      default:
        throw new SparkqlNormalizationError('pattern', pattern);
    }
  }

  private sanitizeRaw(node: RawExpressionInput): RawExpression;
  private sanitizeRaw(node: RawPatternInput): RawPattern;
  private sanitizeRaw(node: RawExpressionInput | RawPatternInput): RawExpression | RawPattern {
    const { strings, values } = node;
    if (
      !Array.isArray(strings) ||
      !Array.isArray(values) ||
      strings.length !== values.length + 1 ||
      !strings.every(text => typeof text === 'string')
    ) {
      throw new SparkqlNormalizationError(node.type, node);
    }
    return {
      type: node.type,
      subType: 'raw',
      loc: node.loc,
      strings: [...strings],
      values: values.map(value => this.sanitizeRawValue(value)),
    } as RawExpression | RawPattern;
  }

  /** Interpolated values become AST nodes; none of them is spliced as text. */
  private sanitizeRawValue(value: RawValue): RawASTValue {
    if (Array.isArray(value)) {
      throw new SparkqlError({
        message: 'Arrays cannot be interpolated into sparql templates; use sparql.join().',
      });
    }
    if (isObjectLike(value) && (value.type === 'pattern' || value.type === 'query')) {
      return this.sanitizePattern(value as PatternInput);
    }
    // Database term formats apply first, as they do for db.iri()/db.literal().
    const formats = this.builderContext.formats;
    for (const kind of ['iri', 'literal', 'blank'] as const) {
      for (const formatter of formats?.[kind] ?? []) {
        if (formatter.test(value)) return formatter.format(value, this.factoryFunctions);
      }
    }
    if (isObjectLike(value) && value.type === 'expression') {
      return this.sanitizeExpression(value as ExpressionInput);
    }
    if (term.accepts(value)) {
      return term.parseOrThrow(value, this.factoryFunctions);
    }
    throw new SparkqlNormalizationError('expression', value);
  }

  protected sanitizeQuads(quads: QuadsInput): AST.Quads {
    if (quads.type === 'pattern') {
      return this.sanitizeBgpPattern(quads);
    }

    return {
      ...quads,
      graph: termGraph.parseOrThrow(quads.graph, this.factoryFunctions),
      triples: this.sanitizeBgpPattern(quads.triples),
    };
  }
}
