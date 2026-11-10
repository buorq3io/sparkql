import type { ExtensionPattern } from '../database/dialect.js';
import type {
  MergePlaceholders,
  PlaceholderCarrier,
  PlaceholderValues,
} from '../database/prepared.js';
import type {
  BasicGraphPatternInput,
  ExpressionInput,
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
  Presence,
  TermIriInput,
  TermVariableInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';

/**
 * Creates a basic graph pattern.
 *
 * The supplied triple collections are combined into one basic graph pattern.
 *
 * @param triples - Triple collections or nested triples to include.
 *
 * @example
 * Find people and their names.
 *
 * ```ts
 * db.select({ name: v.name }).where(bgp(...triples(v.person, n.foaf.name, v.name).triples));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function bgp<const T extends BasicGraphPatternInput>(
  ...triples: T
): PatternBgpInput & PlaceholderCarrier<MergePlaceholders<T[number]>>;
export function bgp(...triples: BasicGraphPatternInput): PatternBgpInput {
  return {
    type: 'pattern',
    subType: 'bgp',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    triples: triples,
  };
}

/**
 * Adds an `OPTIONAL` group pattern.
 *
 * Variables bound only in this group may be unbound in results. Mark selected
 * variables with {@link maybe} to include `undefined` in their result types;
 * `optional` does not infer that presence automatically.
 *
 * @param patterns - Graph patterns to match optionally.
 *
 * @example
 * Select names and optional ages.
 *
 * ```ts
 * db.select({ name: v.name, age: maybe(v.age) }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   optional(triples(v.person, n.foaf.age, v.age))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name ?age WHERE {
 *   ?person foaf:name ?name .
 *   OPTIONAL {
 *     ?person foaf:age ?age .
 *   }
 * }
 * ```
 */
export function optional<const Inputs extends PatternInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternOptionalInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
/**
 * Adds an `OPTIONAL` group pattern.
 *
 * See the first overload for details.
 *
 * @param patterns - Graph patterns to match optionally.
 *
 * @example
 * Select names and optional ages.
 *
 * ```ts
 * db.select({ name: v.name, age: maybe(v.age) }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   optional(triples(v.person, n.foaf.age, v.age))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name ?age WHERE {
 *   ?person foaf:name ?name .
 *   OPTIONAL {
 *     ?person foaf:age ?age .
 *   }
 * }
 * ```
 */
export function optional<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternOptionalInput<P>;

export function optional<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternOptionalInput<P> {
  return {
    type: 'pattern',
    subType: 'optional',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    patterns: patterns,
  };
}

/**
 * Adds a `UNION` of group patterns.
 *
 * Each branch contributes solutions; variables absent from a matching branch may be unbound.
 *
 * @param patterns - Group patterns to match as alternatives.
 *
 * @example
 * Find names recorded with either FOAF or Schema.org.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   union(
 *     group(triples(v.person, n.foaf.name, v.name)),
 *     group(triples(v.person, n.schema.name, v.name))
 *   )
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   {
 *     ?person foaf:name ?name .
 *   }
 *   UNION {
 *     ?person schema:name ?name .
 *   }
 * }
 * ```
 */
export function union<const Inputs extends PatternGroupInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternUnionInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
/**
 * Adds a `UNION` of group patterns.
 *
 * See the first overload for details.
 *
 * @param patterns - Group patterns to match as alternatives.
 *
 * @example
 * Find names recorded with either FOAF or Schema.org.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   union(
 *     group(triples(v.person, n.foaf.name, v.name)),
 *     group(triples(v.person, n.schema.name, v.name))
 *   )
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   {
 *     ?person foaf:name ?name .
 *   }
 *   UNION {
 *     ?person schema:name ?name .
 *   }
 * }
 * ```
 */
export function union<P extends ExtensionPattern = never>(
  ...patterns: PatternGroupInput<P>[]
): PatternUnionInput<P>;

export function union<P extends ExtensionPattern = never>(
  ...patterns: PatternGroupInput<P>[]
): PatternUnionInput<P> {
  return {
    type: 'pattern',
    subType: 'union',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

/**
 * Adds a group graph pattern.
 *
 * The patterns are enclosed in a group, which can also serve as a `UNION` branch.
 *
 * @param patterns - Graph patterns to include in the group.
 *
 * @example
 * Find names within a grouped pattern.
 *
 * ```ts
 * db.select({ name: v.name }).where(group(triples(v.person, n.foaf.name, v.name)));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   {
 *     ?person foaf:name ?name .
 *   }
 * }
 * ```
 */
export function group<const Inputs extends PatternInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternGroupInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
/**
 * Adds a group graph pattern.
 *
 * See the first overload for details.
 *
 * @param patterns - Graph patterns to include in the group.
 *
 * @example
 * Find names within a grouped pattern.
 *
 * ```ts
 * db.select({ name: v.name }).where(group(triples(v.person, n.foaf.name, v.name)));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   {
 *     ?person foaf:name ?name .
 *   }
 * }
 * ```
 */
export function group<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternGroupInput<P>;

export function group<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternGroupInput<P> {
  return {
    type: 'pattern',
    subType: 'group',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

/**
 * Adds a `GRAPH` pattern.
 *
 * The enclosed patterns match against the named graph identified by the IRI or variable.
 *
 * @param name - IRI or variable identifying the named graph.
 * @param patterns - Graph patterns to match in the named graph.
 *
 * @example
 * Find names in the people graph.
 *
 * ```ts
 * db.select({ name: v.name }).where(graph(n.schema.people, triples(v.person, n.foaf.name, v.name)));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   GRAPH schema:people {
 *     ?person foaf:name ?name .
 *   }
 * }
 * ```
 */
export function graph<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput<P>[]
): PatternGraphInput<P> {
  return {
    type: 'pattern',
    subType: 'graph',
    name: name,
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

/**
 * Adds a `MINUS` group pattern.
 *
 * Solutions are removed when a compatible solution from the group shares a variable with them.
 * A group with no shared variables does not remove solutions.
 *
 * @param patterns - Graph patterns whose solutions are excluded.
 *
 * @example
 * Find people whose age is not recorded as 18.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   minus(triples(v.person, n.foaf.age, 18))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   MINUS {
 *     ?person foaf:age "18"^^<http://www.w3.org/2001/XMLSchema#integer> .
 *   }
 * }
 * ```
 */
export function minus<const Inputs extends PatternInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternMinusInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
/**
 * Adds a `MINUS` group pattern.
 *
 * See the first overload for details.
 *
 * @param patterns - Graph patterns whose solutions are excluded.
 *
 * @example
 * Find people whose age is not recorded as 18.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   minus(triples(v.person, n.foaf.age, 18))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   MINUS {
 *     ?person foaf:age "18"^^<http://www.w3.org/2001/XMLSchema#integer> .
 *   }
 * }
 * ```
 */
export function minus<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternMinusInput<P>;

export function minus<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternMinusInput<P> {
  return {
    type: 'pattern',
    subType: 'minus',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

function serviceBase<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  silent: boolean,
  ...patterns: PatternInput<P>[]
): PatternServiceInput<P> {
  return {
    type: 'pattern',
    subType: 'service',
    name: name,
    silent: silent,
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

/**
 * Adds a `SERVICE` pattern.
 *
 * The enclosed patterns are evaluated by the specified remote SPARQL service.
 *
 * @param name - IRI or variable identifying the service.
 * @param patterns - Graph patterns to evaluate remotely.
 *
 * @example
 * Find names through a remote people service.
 *
 * ```ts
 * db.select({ name: v.name }).where(service(n.schema.people, triples(v.person, n.foaf.name, v.name)));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   SERVICE schema:people {
 *     ?person foaf:name ?name .
 *   }
 * }
 * ```
 */
export function service<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput<P>[]
): PatternServiceInput<P> {
  return serviceBase(name, false, ...patterns);
}

/**
 * Adds a `SERVICE SILENT` pattern.
 *
 * The enclosed patterns are evaluated remotely; service failures do not fail the whole query.
 *
 * @param name - IRI or variable identifying the service.
 * @param patterns - Graph patterns to evaluate remotely.
 *
 * @example
 * Find names through a remote service without failing on service errors.
 *
 * ```ts
 * db.select({ name: v.name }).where(serviceSilent(n.schema.people, triples(v.person, n.foaf.name, v.name)));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   SERVICE SILENT schema:people {
 *     ?person foaf:name ?name .
 *   }
 * }
 * ```
 */
export function serviceSilent<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput<P>[]
): PatternServiceInput<P> {
  return serviceBase(name, true, ...patterns);
}

/**
 * Adds a `FILTER` to the enclosing group pattern.
 *
 * Solutions for which `expression` evaluates to false, or raises an error, are
 * removed. SPARQL applies a filter to the whole group it appears in, wherever
 * it is placed, so `filter` can be listed before or after the triples it tests.
 *
 * @param expression - A boolean expression, usually built from operators such as
 * {@link gt} or functions such as {@link regex}.
 *
 * @example
 * Keep only adults.
 *
 * ```ts
 * const adults = db
 *   .select({ name: v.name })
 *   .where(
 *     triples(v.person, n.foaf.name, v.name),
 *     triples(v.person, n.foaf.age, v.age),
 *     filter(gt(v.age, 18))
 *   );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age > "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function filter<E extends ExpressionInput>(
  expression: E
): PatternFilterInput & PlaceholderCarrier<PlaceholderValues<E>>;
export function filter(expression: ExpressionInput): PatternFilterInput {
  return {
    type: 'pattern',
    subType: 'filter',
    expression: expression,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

/**
 * Adds a `BIND` expression to the group pattern.
 *
 * The target variable must not already be in scope at this point in the group.
 * An expression error leaves the variable unbound for that solution.
 *
 * @param expression - Expression to evaluate.
 * @param variable - Variable to bind to the result.
 *
 * @example
 * Bind Ada as a selected name.
 *
 * ```ts
 * db.select({ name: v.name }).where(bind("Ada", v.name));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   BIND( "Ada" AS ?name )
 * }
 * ```
 */
export function bind<T, K extends Presence>(
  expression: ExpressionInput<T>,
  variable: TermVariableInput<any, K>
): PatternBindInput<T, K> {
  return {
    type: 'pattern',
    subType: 'bind',
    expression: expression,
    variable: variable,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

/**
 * Adds inline `VALUES` bindings.
 *
 * Object keys name variables and arrays supply their column values. Values at the same
 * index form a row; `undefined` becomes `UNDEF`. The first column's length sets the number
 * of rows: extra values in longer columns are dropped.
 *
 * @param values - Variable names mapped to arrays of values.
 *
 * @example
 * Supply Ada and Grace as inline names.
 *
 * ```ts
 * db.select({ name: v.name }).where(values({ name: ["Ada", "Grace"] }));
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   VALUES ?name {
 *     "Ada"
 *     "Grace"
 *   }
 * }
 * ```
 */
export function values(values: ValuePatternColumnsInput): PatternValuesInput {
  return {
    type: 'pattern',
    subType: 'values',
    variables: Object.keys(values).map(v => ({
      type: 'term',
      subType: 'variable',
      value: v,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
    })),
    values: values,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}
