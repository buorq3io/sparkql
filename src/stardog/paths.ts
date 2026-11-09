import { GeneratorBuilder } from '@traqula/core';
import { sparql11GeneratorBuilder } from '@traqula/generator-sparql-1-1';
import * as AST from '@traqula/rules-sparql-1-1';
import { DataFactory } from 'rdf-data-factory';
import type { SparqlDialect } from '../database/dialect.js';
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

export type PathBinding = Readonly<Record<string, DefaultQueryReturnType | undefined>>;
export interface PathResult {
  edges: PathBinding[];
}
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
export interface PathsQueryAST {
  type: 'query';
  subType: 'paths';
  loc: AST.Query['loc'];
  context: AST.ContextDefinition[];
  datasets: AST.DatasetClauses;
  start: EndpointAST;
  end: EndpointAST;
  via: ViaAST;
  mode: 'SHORTEST' | 'ALL';
  cyclic: boolean;
  maxLength?: number;
  limit?: number;
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
const generator = GeneratorBuilder.create(sparql11GeneratorBuilder).addRule(pathsRule).build();
const rdf = new DataFactory();

function decodeTerm(value: unknown): DefaultQueryReturnType {
  if (!isObjectLike(value) || typeof value.value !== 'string')
    throw new Error('Invalid PATHS RDF term.');
  if (value.type === 'uri') return rdf.namedNode(value.value);
  if (value.type === 'bnode') return rdf.blankNode(value.value);
  if (value.type === 'literal' || value.type === 'typed-literal') {
    const language = value['xml:lang'];
    const datatype = value.datatype;
    if (
      (language !== undefined && typeof language !== 'string') ||
      (datatype !== undefined && typeof datatype !== 'string')
    ) {
      throw new Error('Invalid PATHS literal metadata.');
    }
    return rdf.literal(value.value, language || (datatype ? rdf.namedNode(datatype) : undefined));
  }
  throw new Error('Unsupported PATHS RDF term type.');
}

/** Stardog represents each edge as bindings and separates paths with empty bindings. */
export function decodePaths(data: unknown): PathResult[] {
  if (!isObjectLike(data) || !isObjectLike(data.results) || !Array.isArray(data.results.bindings)) {
    throw new Error('Expected a PATHS SPARQL JSON result set.');
  }
  const paths: PathResult[] = [];
  let edges: PathBinding[] = [];
  for (const row of data.results.bindings) {
    if (!isObjectLike(row) || Array.isArray(row)) throw new Error('Invalid PATHS binding set.');
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
      throw new Error('PATHS requires START, END, and VIA.');
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
export type PathsQuery<
  S extends boolean = false,
  E extends boolean = false,
  V extends boolean = false,
> = Omit<PathsQueryBuilder<S, E, V>, Hidden<S, E, V>>;

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
  start(variable: TermVariableInput, constraint?: PathEndpointInput): PathsQuery<true, E, V> {
    this.config.start = { variable, constraint };
    return this as unknown as PathsQuery<true, E, V>;
  }
  end(variable: TermVariableInput, constraint?: PathEndpointInput): PathsQuery<S, true, V> {
    this.config.end = { variable, constraint };
    return this as unknown as PathsQuery<S, true, V>;
  }
  via(path: PathInput | TermVariableInput): PathsQuery<S, E, true>;
  via(...patterns: [PatternInput, ...PatternInput[]]): PathsQuery<S, E, true>;
  via(...values: (PathInput | TermVariableInput | PatternInput)[]): PathsQuery<S, E, true> {
    const value = values[0];
    if (!value) throw new Error('VIA requires a path or graph pattern.');
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
  all(): this {
    this.config.mode = 'ALL';
    return this;
  }
  shortest(): this {
    this.config.mode = 'SHORTEST';
    return this;
  }
  cyclic(): this {
    this.config.cyclic = true;
    return this;
  }
  from(iri: TermIriInput): this {
    this.moduleContext.normalizer(this.config.body).from(iri);
    return this;
  }
  fromNamed(iri: TermIriInput): this {
    this.moduleContext.normalizer(this.config.body).fromNamed(iri);
    return this;
  }
  maxLength(value: number): this {
    assertNonNegativeInteger(value, 'MAX LENGTH');
    this.config.maxLength = value;
    return this;
  }
  limit(value: number): this {
    assertNonNegativeInteger(value, 'LIMIT');
    this.config.limit = value;
    return this;
  }
  offset(value: number): this {
    assertNonNegativeInteger(value, 'OFFSET');
    this.config.offset = value;
    return this;
  }
}
export const stardogQueries = {
  paths: (context: QueryModuleContext<SparqlDialect>) => (): PathsQuery =>
    new PathsQueryBuilder(context),
};
