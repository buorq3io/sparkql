import { GeneratorBuilder } from '@traqula/core';
import * as AST from '@traqula/rules-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import type { SparqlDialect } from '../database/dialect.js';
import { SparkqlError } from '../database/errors.js';
import { sparkqlGeneratorBuilder } from '../database/generator.js';
import { assertNonNegativeInteger } from '../database/pattern-query-module.js';
import {
  emptySelect,
  ModuleQueryBuilder,
  type QueryModule,
  type QueryModuleContext,
  requestQueryJson,
} from '../database/query-module.js';
import type {
  DefaultQueryReturnType,
  PathInput,
  PatternGroupInput,
  PatternInput,
  QuerySelectInput,
  TermIriInput,
  TermVariableInput,
} from '../helpers/types.js';
import { isObjectLike, termIri, termVariable } from '../helpers/utilities.js';
import { group } from '../structures/pattern.js';

/** One edge of a path: its bindings as RDF terms, keyed by variable name. */
export type PathBinding = Readonly<Record<string, DefaultQueryReturnType | undefined>>;
/** A path returned by a Stardog `PATHS` query. */
export interface PathResult {
  /** The edges of the path, in order from the start node to the end node. */
  edges: PathBinding[];
}
/** An IRI or group pattern restricting a path endpoint in `start()` or `end()`. */
export type PathEndpointInput = TermIriInput | PatternGroupInput;
interface EndpointInput {
  variable: TermVariableInput;
  constraint?: PathEndpointInput;
}
interface EndpointAST {
  variable: AST.TermVariable;
  constraint?: AST.TermIri | AST.PatternGroup;
}
type ViaInput =
  | { kind: 'pattern'; pattern: PatternGroupInput }
  | { kind: 'path'; path: PathInput }
  | { kind: 'variable'; variable: TermVariableInput };
type ViaAST =
  | { kind: 'pattern'; pattern: AST.PatternGroup }
  | { kind: 'path'; path: AST.Path }
  | { kind: 'variable'; variable: AST.TermVariable };
interface PathsConfig {
  body: QuerySelectInput;
  start?: EndpointInput;
  end?: EndpointInput;
  via?: ViaInput;
  mode: 'SHORTEST' | 'ALL';
  cyclic: boolean;
  maxLength?: number;
  limit?: number;
  offset?: number;
}
/** @internal */
export interface PathsQueryAST {
  /** Query node kind. */
  type: 'query';
  /** PATHS query kind. */
  subType: 'paths';
  /** Source location. */
  loc: AST.Query['loc'];
  /** Query prologue. */
  context: AST.ContextDefinition[];
  /** Dataset clauses. */
  datasets: AST.DatasetClauses;
  /** Starting endpoint. */
  start: EndpointAST;
  /** Ending endpoint. */
  end: EndpointAST;
  /** Edge traversal. */
  via: ViaAST;
  /** Path selection mode. */
  mode: 'SHORTEST' | 'ALL';
  /** Whether cycles are included. */
  cyclic: boolean;
  /** Maximum path length. */
  maxLength?: number;
  /** Maximum number of results. */
  limit?: number;
  /** Number of results skipped. */
  offset?: number;
}
const loc = { sourceLocationType: 'autoGenerate' } as const;
const pathsRule: AST.SparqlGeneratorRule<'stardogPaths', PathsQueryAST> = {
  name: 'stardogPaths',
  gImpl:
    ({ SUBRULE, PRINT_WORD }) =>
    ast => {
      SUBRULE(AST.gram.prologue, ast.context);
      PRINT_WORD('PATHS');
      PRINT_WORD(ast.mode);
      if (ast.cyclic) PRINT_WORD('CYCLIC');
      SUBRULE(AST.gram.datasetClauseStar, ast.datasets);
      for (const [clause, endpoint] of [
        ['START', ast.start],
        ['END', ast.end],
      ] as const) {
        PRINT_WORD(clause);
        SUBRULE(AST.gram.var_, endpoint.variable);
        if (endpoint.constraint?.type === 'pattern')
          SUBRULE(AST.gram.groupGraphPattern, endpoint.constraint);
        else if (endpoint.constraint) {
          PRINT_WORD('=');
          SUBRULE(AST.gram.iri, endpoint.constraint);
        }
      }
      PRINT_WORD('VIA');
      if (ast.via.kind === 'pattern') SUBRULE(AST.gram.groupGraphPattern, ast.via.pattern);
      else if (ast.via.kind === 'variable') SUBRULE(AST.gram.var_, ast.via.variable);
      else SUBRULE(AST.gram.pathGenerator, ast.via.path, undefined);
      if (ast.maxLength !== undefined) PRINT_WORD(`MAX LENGTH ${ast.maxLength}`);
      if (ast.offset !== undefined) PRINT_WORD(`OFFSET ${ast.offset}`);
      if (ast.limit !== undefined) PRINT_WORD(`LIMIT ${ast.limit}`);
    },
};
const generator = GeneratorBuilder.create(sparkqlGeneratorBuilder).addRule(pathsRule).build();
const rdf = new DataFactory();

function decodeTerm(value: unknown): DefaultQueryReturnType {
  if (!isObjectLike(value) || typeof value.value !== 'string')
    throw new SparkqlError({ message: 'Invalid PATHS RDF term.' });
  if (value.type === 'uri') return rdf.namedNode(value.value);
  if (value.type === 'bnode') return rdf.blankNode(value.value);
  if (value.type === 'literal' || value.type === 'typed-literal') {
    const language = value['xml:lang'];
    const datatype = value.datatype;
    if (
      (language !== undefined && typeof language !== 'string') ||
      (datatype !== undefined && typeof datatype !== 'string')
    ) {
      throw new SparkqlError({ message: 'Invalid PATHS literal metadata.' });
    }
    return rdf.literal(value.value, language || (datatype ? rdf.namedNode(datatype) : undefined));
  }
  throw new SparkqlError({ message: 'Unsupported PATHS RDF term type.' });
}

/**
 * Decodes the SPARQL JSON response of a Stardog `PATHS` query into paths of RDF terms.
 *
 * Each binding set is one edge, and an empty binding set ends a path. Awaiting `db.paths()`
 * already uses it; call it directly when you send a `PATHS` query some other way, such as
 * through `session.raw()`.
 *
 * @param data - Parsed SPARQL JSON result set.
 * @throws When `data` is not a SPARQL JSON result set, or a term has an unsupported type or
 * invalid literal metadata.
 *
 * @example
 * Decode a response holding one path from Alice through Carol to Bob.
 *
 * ```ts
 * import { decodePaths } from 'sparkql/stardog';
 *
 * const alice = { type: 'uri', value: 'https://example.org/alice' };
 * const carol = { type: 'uri', value: 'https://example.org/carol' };
 * const bob = { type: 'uri', value: 'https://example.org/bob' };
 * const paths = decodePaths({
 *   results: { bindings: [{ start: alice, end: carol }, { start: carol, end: bob }, {}] },
 * });
 * // [{ edges: [{ start: NamedNode, end: NamedNode }, { start: NamedNode, end: NamedNode }] }]
 * ```
 */
export function decodePaths(data: unknown): PathResult[] {
  if (!isObjectLike(data) || !isObjectLike(data.results) || !Array.isArray(data.results.bindings)) {
    throw new SparkqlError({ message: 'Expected a PATHS SPARQL JSON result set.' });
  }
  const paths: PathResult[] = [];
  let edges: PathBinding[] = [];
  for (const row of data.results.bindings) {
    if (!isObjectLike(row) || Array.isArray(row))
      throw new SparkqlError({ message: 'Invalid PATHS binding set.' });
    if (!Object.keys(row).length) {
      if (edges.length) {
        paths.push({ edges });
        edges = [];
      }
    } else {
      edges.push(
        Object.fromEntries(Object.entries(row).map(([key, value]) => [key, decodeTerm(value)]))
      );
    }
  }
  if (edges.length) paths.push({ edges });
  return paths;
}
const pathsModule: QueryModule<PathsConfig, PathsQueryAST, PathResult[], SparqlDialect> = {
  normalize: (config, context) => {
    if (!config.start || !config.end || !config.via)
      throw new SparkqlError({ message: 'PATHS requires START, END, and VIA.' });
    const normalizer = context.normalizer(config.body);
    const body = normalizer.getSPARQL();
    const endpoint = (input: EndpointInput): EndpointAST => ({
      variable: termVariable.parseOrThrow(input.variable, context.factory),
      ...(input.constraint
        ? {
            constraint: termIri.accepts(input.constraint)
              ? termIri.parseOrThrow(input.constraint, context.factory)
              : (normalizer.pattern(input.constraint) as AST.PatternGroup),
          }
        : {}),
    });
    const via: ViaAST =
      config.via.kind === 'pattern'
        ? { kind: 'pattern', pattern: normalizer.pattern(config.via.pattern) as AST.PatternGroup }
        : config.via.kind === 'variable'
          ? {
              kind: 'variable',
              variable: termVariable.parseOrThrow(config.via.variable, context.factory),
            }
          : { kind: 'path', path: normalizer.path(config.via.path) };
    return {
      type: 'query',
      subType: 'paths',
      loc,
      context: body.context,
      datasets: body.datasets,
      start: endpoint(config.start),
      end: endpoint(config.end),
      via,
      mode: config.mode,
      cyclic: config.cyclic,
      maxLength: config.maxLength,
      limit: config.limit,
      offset: config.offset,
    };
  },
  generate: ast => generator.stardogPaths(ast, AST.completeGeneratorContext({})).trim(),
  execute: async (sparql, session) =>
    decodePaths(await requestQueryJson(session, sparql, 'application/sparql-results+json')),
};

type Incomplete = 'then' | 'execute' | 'getSPARQL' | 'toSPARQL';
type Hidden<S extends boolean, E extends boolean, V extends boolean> =
  | (S extends true ? 'start' : never)
  | (E extends true ? 'end' : never)
  | (V extends true ? 'via' : never)
  | (S extends true
      ? E extends true
        ? V extends true
          ? never
          : Incomplete
        : Incomplete
      : Incomplete);
/**
 * The chain returned by `db.paths()`.
 *
 * `start`, `end` and `via` disappear once called, and `then`, `execute`, `getSPARQL` and
 * `toSPARQL` appear once all three have been called. The modifier methods (`all`, `limit`, ...)
 * return the same narrowed type.
 *
 * @typeParam S - Whether `start` has been called.
 * @typeParam E - Whether `end` has been called.
 * @typeParam V - Whether `via` has been called.
 */
export type PathsQuery<
  S extends boolean = false,
  E extends boolean = false,
  V extends boolean = false,
> = Omit<PathsQueryBuilder<S, E, V>, Hidden<S, E, V>>;

/**
 * Builder for a Stardog `PATHS` query, created by `db.paths()`.
 *
 * Use it through the {@link PathsQuery} type that `db.paths()` returns, which enforces that
 * `start`, `end` and `via` are each set once before the query runs.
 */
export class PathsQueryBuilder<
  S extends boolean = false,
  E extends boolean = false,
  V extends boolean = false,
> extends ModuleQueryBuilder<PathsConfig, PathsQueryAST, PathResult[], SparqlDialect> {
  constructor(context: QueryModuleContext<SparqlDialect>) {
    super(
      { body: emptySelect(context.context), mode: 'SHORTEST', cyclic: false },
      pathsModule,
      context
    );
  }
  /**
   * Sets the `START` endpoint of the paths.
   *
   * Can be called once, in any order with `end` and `via`. `toSPARQL()`, `getSPARQL()`
   * and execution become available once all three are set.
   *
   * Without `constraint` a path may start at any node. An IRI fixes the start node
   * (`START ?start = <iri>`); a {@link group} pattern restricts it to the nodes it matches.
   *
   * @param variable - Variable bound to the start node of each path.
   * @param constraint - An IRI or a group pattern restricting the start node.
   *
   * @example
   * Find the shortest chain of acquaintances from Alice to Bob.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db.paths().start(v.start, alice).end(v.end, bob).via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows
   * ```
   */
  start(variable: TermVariableInput, constraint?: PathEndpointInput): PathsQuery<true, E, V> {
    this.config.start = { variable, constraint };
    return this as unknown as PathsQuery<true, E, V>;
  }
  /**
   * Sets the `END` endpoint of the paths.
   *
   * Can be called once, in any order with `start` and `via`. `toSPARQL()`, `getSPARQL()`
   * and execution become available once all three are set.
   *
   * Without `constraint` a path may end at any node. An IRI fixes the end node
   * (`END ?end = <iri>`); a {@link group} pattern restricts it to the nodes it matches.
   *
   * @param variable - Variable bound to the end node of each path.
   * @param constraint - An IRI or a group pattern restricting the end node.
   *
   * @example
   * Find the shortest chain of acquaintances from Alice to anyone named Bob.
   *
   * ```ts
   * import { SparqlDatabase, group, triples } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db
   *   .paths()
   *   .start(v.start, alice)
   *   .end(v.end, group(triples(v.end, n.foaf.name, 'Bob')))
   *   .via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end {
   *   ?end foaf:name "Bob" .
   * }
   * VIA foaf:knows
   * ```
   */
  end(variable: TermVariableInput, constraint?: PathEndpointInput): PathsQuery<S, true, V> {
    this.config.end = { variable, constraint };
    return this as unknown as PathsQuery<S, true, V>;
  }
  /**
   * Sets the `VIA` clause: the edges a path may follow.
   *
   * Can be called once, in any order with `start` and `end`. `toSPARQL()`, `getSPARQL()`
   * and execution become available once all three are set.
   *
   * An IRI or property path follows matching edges (`VIA foaf:knows`). A variable follows edges
   * of any predicate (`VIA ?p`).
   *
   * @param path - IRI, property path or variable describing the edges.
   *
   * @example
   * Follow `foaf:knows` links from Alice to Bob.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db.paths().start(v.start, alice).end(v.end, bob).via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows
   * ```
   *
   * @example
   * Follow links of any kind from Alice to Bob.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db.paths().start(v.start, alice).end(v.end, bob).via(v.link);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA ?link
   * ```
   */
  via(path: PathInput | TermVariableInput): PathsQuery<S, E, true>;
  /**
   * Sets the `VIA` clause from graph patterns that describe one edge.
   *
   * The patterns are joined into one group, which should bind both the `start` and the `end`
   * variable. See the first overload for details.
   *
   * @param patterns - Graph patterns describing one edge from the start to the end variable.
   *
   * @example
   * Follow `foaf:knows` links only to people with a recorded age.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db
   *   .paths()
   *   .start(v.start, alice)
   *   .end(v.end, bob)
   *   .via(triples(v.start, n.foaf.knows, v.end), triples(v.end, n.foaf.age, v.age));
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA {
   *   ?start foaf:knows ?end .
   *   ?end foaf:age ?age .
   * }
   * ```
   */
  via(...patterns: [PatternInput, ...PatternInput[]]): PathsQuery<S, E, true>;
  via(...values: (PathInput | TermVariableInput | PatternInput)[]): PathsQuery<S, E, true> {
    const value = values[0];
    if (!value) throw new SparkqlError({ message: 'VIA requires a path or graph pattern.' });
    if (values.length === 1 && termVariable.is(value))
      this.config.via = { kind: 'variable', variable: value };
    else if (
      values.length === 1 &&
      (termIri.accepts(value) || (isObjectLike(value) && value.type === 'path'))
    ) {
      this.config.via = { kind: 'path', path: value as PathInput };
    } else this.config.via = { kind: 'pattern', pattern: group(...(values as PatternInput[])) };
    return this as unknown as PathsQuery<S, E, true>;
  }
  /**
   * Returns `ALL` paths instead of only the shortest ones.
   *
   * Replaces the selection mode set by an earlier `all()` or `shortest()`; the default is
   * `SHORTEST`. Combine it with `maxLength` or `limit` to bound the result.
   *
   * @example
   * Find every chain of acquaintances from Alice to Bob.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chains = db.paths().all().start(v.start, alice).end(v.end, bob).via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS ALL START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows
   * ```
   */
  all(): PathsQuery<S, E, V> {
    this.config.mode = 'ALL';
    return this as unknown as PathsQuery<S, E, V>;
  }
  /**
   * Returns only the `SHORTEST` paths.
   *
   * This is the default, so it is only needed to undo an earlier `all()`.
   *
   * @example
   * Find the shortest chain of acquaintances from Alice to Bob, stating the mode explicitly.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db.paths().shortest().start(v.start, alice).end(v.end, bob).via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows
   * ```
   */
  shortest(): PathsQuery<S, E, V> {
    this.config.mode = 'SHORTEST';
    return this as unknown as PathsQuery<S, E, V>;
  }
  /**
   * Adds the `CYCLIC` keyword, which lets paths contain cycles.
   *
   * Use it to find paths that lead back to their start node. It cannot be removed once added.
   *
   * @example
   * Find chains of acquaintances that lead from Alice back to Alice.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const cycles = db
   *   .paths()
   *   .all()
   *   .cyclic()
   *   .start(v.start, alice)
   *   .end(v.end, alice)
   *   .via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS ALL CYCLIC START ?start = <https://example.org/alice> END ?end = <https://example.org/alice> VIA foaf:knows
   * ```
   */
  cyclic(): PathsQuery<S, E, V> {
    this.config.cyclic = true;
    return this as unknown as PathsQuery<S, E, V>;
  }
  /**
   * Adds a `FROM` dataset clause.
   *
   * Can be called several times, at any point in the chain.
   *
   * @param iri - IRI of a graph to merge into the default graph.
   *
   * @example
   * Search only the people graph for a chain of acquaintances.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db
   *   .paths()
   *   .from(db.iri('https://example.org/people'))
   *   .start(v.start, alice)
   *   .end(v.end, bob)
   *   .via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST FROM <https://example.org/people> START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows
   * ```
   */
  from(iri: TermIriInput): PathsQuery<S, E, V> {
    this.moduleContext.normalizer(this.config.body).from(iri);
    return this as unknown as PathsQuery<S, E, V>;
  }
  /**
   * Adds a `FROM NAMED` dataset clause.
   *
   * Can be called several times, at any point in the chain.
   *
   * @param iri - IRI of a graph to make available to `GRAPH` patterns.
   *
   * @example
   * Make the people graph available as a named graph.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db
   *   .paths()
   *   .fromNamed(db.iri('https://example.org/people'))
   *   .start(v.start, alice)
   *   .end(v.end, bob)
   *   .via(n.foaf.knows);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST FROM NAMED <https://example.org/people> START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows
   * ```
   */
  fromNamed(iri: TermIriInput): PathsQuery<S, E, V> {
    this.moduleContext.normalizer(this.config.body).fromNamed(iri);
    return this as unknown as PathsQuery<S, E, V>;
  }
  /**
   * Adds a `MAX LENGTH` clause that limits the number of edges in a path.
   *
   * A later call replaces the earlier value.
   *
   * @param value - Maximum number of edges.
   * @throws When `value` is not a non-negative safe integer.
   *
   * @example
   * Find a chain of at most four acquaintances from Alice to Bob.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chain = db.paths().start(v.start, alice).end(v.end, bob).via(n.foaf.knows).maxLength(4);
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows MAX LENGTH 4
   * ```
   */
  maxLength(value: number): PathsQuery<S, E, V> {
    assertNonNegativeInteger(value, 'MAX LENGTH');
    this.config.maxLength = value;
    return this as unknown as PathsQuery<S, E, V>;
  }
  /**
   * Adds a `LIMIT` clause that caps the number of paths returned.
   *
   * A later call replaces the earlier value.
   *
   * @param value - Maximum number of paths.
   * @throws When `value` is not a non-negative safe integer.
   *
   * @example
   * Return at most three chains of acquaintances from Alice to Bob.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chains = db
   *   .paths()
   *   .all()
   *   .start(v.start, alice)
   *   .end(v.end, bob)
   *   .via(n.foaf.knows)
   *   .limit(3);
   * ```
   *
   * ```sparql
   * PATHS ALL START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows LIMIT 3
   * ```
   */
  limit(value: number): PathsQuery<S, E, V> {
    assertNonNegativeInteger(value, 'LIMIT');
    this.config.limit = value;
    return this as unknown as PathsQuery<S, E, V>;
  }
  /**
   * Adds an `OFFSET` clause that skips paths.
   *
   * A later call replaces the earlier value. `OFFSET` is printed before `LIMIT`.
   *
   * @param value - Number of paths to skip.
   * @throws When `value` is not a non-negative safe integer.
   *
   * @example
   * Return the second page of three chains of acquaintances.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const page = db
   *   .paths()
   *   .all()
   *   .start(v.start, alice)
   *   .end(v.end, bob)
   *   .via(n.foaf.knows)
   *   .limit(3)
   *   .offset(3);
   * ```
   *
   * ```sparql
   * PATHS ALL START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows OFFSET 3 LIMIT 3
   * ```
   */
  offset(value: number): PathsQuery<S, E, V> {
    assertNonNegativeInteger(value, 'OFFSET');
    this.config.offset = value;
    return this as unknown as PathsQuery<S, E, V>;
  }
}
/** Factories for the Stardog database method `db.paths()`. */
export const stardogQueries = {
  /**
   * Starts a Stardog `PATHS` query, which finds paths between nodes in the graph.
   *
   * Set the endpoints with `start` and `end` and the edges with `via`; the query can only be
   * generated or awaited once all three are set. It finds the `SHORTEST` paths unless `all()` is
   * called. Awaiting it requests SPARQL JSON results and resolves to {@link PathResult} objects.
   *
   * @example
   * Find the shortest chain of acquaintances from Alice to Bob.
   *
   * ```ts
   * import { SparqlDatabase } from 'sparkql/stardog';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   * const alice = db.iri('https://example.org/alice');
   * const bob = db.iri('https://example.org/bob');
   *
   * const chains = await db.paths().start(v.start, alice).end(v.end, bob).via(n.foaf.knows);
   * // [{ edges: [{ start: NamedNode, end: NamedNode }, ...] }, ...]
   * ```
   *
   * ```sparql
   * PATHS SHORTEST START ?start = <https://example.org/alice> END ?end = <https://example.org/bob> VIA foaf:knows
   * ```
   */
  paths: (context: QueryModuleContext<SparqlDialect>) => (): PathsQuery =>
    new PathsQueryBuilder(context),
};
