import { GeneratorBuilder } from '@traqula/core';
import * as AST from '@traqula/rules-sparql-1-1';
import type { DialectAST, SparqlDialect } from '../database/dialect.js';
import {
  PatternModuleQueryBuilder,
  type PatternQueryConfig,
} from '../database/pattern-query-module.js';
import {
  emptySelect,
  type QueryModule,
  type QueryModuleContext,
  requestQueryJson,
} from '../database/query-module.js';
import type { SparqlQuad } from '../database/session.js';
import type { QuadsInput, TermLiteralInput, TermVariableInput } from '../helpers/types.js';
import { isObjectLike, termLiteral, termVariable } from '../helpers/utilities.js';
import { arqGeneratorBuilder } from './generator.js';
import type { ArqAST, ArqInput } from './types.js';

type PatternDialect = SparqlDialect<ArqInput, ArqAST>;
type Body = DialectAST<PatternDialect, AST.QuerySelect>;
/** A scalar value in an ARQ `JSON` result. */
export type JsonScalar = string | number | boolean | null;
/**
 * The projection of an ARQ `JSON` query: output member names mapped to variables or to constant
 * literal values.
 */
export type JsonProjection = Record<string, TermVariableInput | TermLiteralInput>;
type VariableKeys<P> = {
  [K in keyof P]: Extract<P[K], AST.TermVariable> extends never ? never : K;
}[keyof P];
type JsonConstant<T> = T extends number | bigint
  ? number
  : T extends boolean
    ? boolean
    : T extends string | Date | RegExp
      ? string
      : JsonScalar;
/**
 * One object of an ARQ `JSON` query result.
 *
 * Members for variables are optional, because ARQ omits unbound variables, and hold plain JSON
 * scalars: the database's codecs and term formats do not apply. Constant members keep the
 * JSON type of the projected value: `bigint` becomes a number, `Date` and `RegExp` strings.
 */
export type JsonResult<P extends JsonProjection> = {
  [K in Exclude<keyof P, VariableKeys<P>>]: JsonConstant<P[K]>;
} & { [K in VariableKeys<P>]?: JsonScalar };
/** Normalized ARQ `JSON` query. */
export interface JsonQueryAST {
  /** Marks the node as a query. */
  type: 'query';
  /** The query subtype. */
  subType: 'json';
  /** Source location metadata. */
  loc: AST.Query['loc'];
  /** The projected JSON members. */
  projection: Record<string, AST.TermVariable | AST.TermLiteral>;
  /** The SELECT body holding the dataset, `WHERE` and solution modifier clauses. */
  body: Body;
}
/** Normalized ARQ quad construction query. */
export interface ConstructQuadsAST {
  /** Marks the node as a query. */
  type: 'query';
  /** The query subtype. */
  subType: 'constructQuads';
  /** Source location metadata. */
  loc: AST.Query['loc'];
  /** The triple and quad templates. */
  template: AST.Quads[];
  /** The SELECT body holding the dataset, `WHERE` and solution modifier clauses. */
  body: Body;
}
/** A quad returned by `db.constructQuads()`. */
export type ConstructedQuad = SparqlQuad;
interface JsonConfig<P extends JsonProjection> extends PatternQueryConfig {
  /** The projected JSON members. */
  projection: P;
}
interface QuadsConfig extends PatternQueryConfig {
  /** The quad templates. */
  template: QuadsInput[];
}
const loc = { sourceLocationType: 'autoGenerate' } as const;

const jsonRule: AST.SparqlGeneratorRule<'arqJsonQuery', JsonQueryAST> = {
  name: 'arqJsonQuery',
  gImpl:
    ({ SUBRULE, PRINT_WORD }) =>
    (ast, { astFactory: F }) => {
      SUBRULE(AST.gram.prologue, ast.body.context);
      PRINT_WORD('JSON');
      PRINT_WORD('{');
      Object.entries(ast.projection).forEach(([key, value], index) => {
        if (index) PRINT_WORD(',');
        PRINT_WORD(JSON.stringify(key));
        PRINT_WORD(':');
        SUBRULE(AST.gram.expression, value);
      });
      PRINT_WORD('}');
      SUBRULE(AST.gram.datasetClauseStar, ast.body.datasets);
      // Existing Traqula rule signatures describe standard nested patterns;
      // calls dispatch through the copied ARQ generator's patched pattern rules.
      SUBRULE(AST.gram.whereClause, F.wrap(ast.body.where as unknown as AST.PatternGroup, ast.loc));
      SUBRULE(
        AST.gram.solutionModifier,
        ast.body.solutionModifiers as unknown as AST.SolutionModifiers
      );
      if (ast.body.values) SUBRULE(AST.gram.inlineData, ast.body.values);
    },
};
const quadsRule: AST.SparqlGeneratorRule<'arqConstructQuads', ConstructQuadsAST> = {
  name: 'arqConstructQuads',
  gImpl:
    ({ SUBRULE, PRINT_WORD }) =>
    (ast, { astFactory: F }) => {
      SUBRULE(AST.gram.prologue, ast.body.context);
      PRINT_WORD('CONSTRUCT');
      PRINT_WORD('{');
      SUBRULE(AST.gram.quads, F.wrap(ast.template, ast.loc));
      PRINT_WORD('}');
      SUBRULE(AST.gram.datasetClauseStar, ast.body.datasets);
      SUBRULE(AST.gram.whereClause, F.wrap(ast.body.where as unknown as AST.PatternGroup, ast.loc));
      SUBRULE(
        AST.gram.solutionModifier,
        ast.body.solutionModifiers as unknown as AST.SolutionModifiers
      );
      if (ast.body.values) SUBRULE(AST.gram.inlineData, ast.body.values);
    },
};
const generator = GeneratorBuilder.create(arqGeneratorBuilder)
  .addRule(jsonRule)
  .addRule(quadsRule)
  .build();

function jsonModule<P extends JsonProjection>(
  /** The projected JSON members. */
  projection: P
): QueryModule<JsonConfig<P>, JsonQueryAST, JsonResult<P>[], PatternDialect> {
  return {
    normalize: (config, context) => {
      if (!Object.keys(config.projection).length)
        throw new Error('JSON requires at least one projected member.');
      const projection = Object.fromEntries(
        Object.entries(config.projection).map(([key, value]) => [
          key,
          termVariable.is(value)
            ? termVariable.parseOrThrow(value, context.factory)
            : termLiteral.parseOrThrow(value, context.factory),
        ])
      );
      return {
        type: 'query',
        subType: 'json',
        loc,
        projection,
        body: context.normalizer(config.body).getSPARQL(),
      };
    },
    generate: ast => generator.arqJsonQuery(ast, AST.completeGeneratorContext({})).trim(),
    execute: async (sparql, session, ast) => {
      const data = await requestQueryJson(session, sparql, 'application/json');
      if (!Array.isArray(data)) throw new Error('Expected an ARQ JSON array.');
      for (const row of data) {
        if (!isObjectLike(row) || Array.isArray(row))
          throw new Error('Expected an ARQ JSON object.');
        for (const [key, term] of Object.entries(ast.projection)) {
          // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn requires ES2022; this package targets ES2020.
          if (!Object.prototype.hasOwnProperty.call(row, key)) {
            if (term.subType !== 'variable') throw new Error(`Missing JSON constant: ${key}`);
            continue;
          }
          const value: unknown = row[key];
          if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
            throw new Error(`Invalid JSON scalar: ${key}`);
          }
          if (term.subType !== 'variable') {
            const input = projection[key];
            const expected =
              typeof input === 'bigint'
                ? 'number'
                : input instanceof Date || input instanceof RegExp
                  ? 'string'
                  : ['string', 'number', 'boolean'].includes(typeof input)
                    ? typeof input
                    : undefined;
            if (expected && typeof value !== expected)
              throw new Error(`Invalid JSON constant: ${key}`);
          }
        }
      }
      return data as JsonResult<P>[];
    },
  };
}
/**
 * Builder for an ARQ `JSON` query, created by `db.json()`.
 *
 * Awaiting it requests `application/json` and resolves to an array of {@link JsonResult}
 * objects. It rejects when the response is not an array of objects, when a member is not a
 * JSON scalar, or when a constant member is missing or has another type than projected.
 */
export class JsonQueryBuilder<P extends JsonProjection> extends PatternModuleQueryBuilder<
  JsonConfig<P>,
  JsonQueryAST,
  JsonResult<P>[],
  PatternDialect
> {
  constructor(projection: P, context: QueryModuleContext<PatternDialect>) {
    const snapshot = { ...projection };
    super(
      { projection: snapshot, body: emptySelect(context.context) },
      jsonModule(snapshot),
      context
    );
  }
}
const quadsModule: QueryModule<QuadsConfig, ConstructQuadsAST, ConstructedQuad[], PatternDialect> =
  {
    normalize: (config, context) => ({
      type: 'query',
      subType: 'constructQuads',
      loc,
      template: config.template.map(quad => context.normalizer().quads(quad)),
      body: context.normalizer(config.body).getSPARQL(),
    }),
    generate: ast => generator.arqConstructQuads(ast, AST.completeGeneratorContext({})).trim(),
    execute: (sparql, session) => session.quads(sparql, { accept: 'application/n-quads' }),
  };
/**
 * Builder for an ARQ `CONSTRUCT` query with `GRAPH` templates, created by
 * `db.constructQuads()`.
 *
 * Awaiting it requests `application/n-quads` and resolves to the constructed quads.
 */
export class ConstructQuadsQueryBuilder extends PatternModuleQueryBuilder<
  QuadsConfig,
  ConstructQuadsAST,
  ConstructedQuad[],
  PatternDialect
> {
  constructor(template: QuadsInput[], context: QueryModuleContext<PatternDialect>) {
    super({ template: [...template], body: emptySelect(context.context) }, quadsModule, context);
  }
}
/** Factories for the ARQ database methods `db.json()` and `db.constructQuads()`. */
export const arqQueries = {
  /**
   * Starts an ARQ `JSON` query, which returns one plain JSON object per solution.
   *
   * Each key of `projection` becomes a member of the result objects. A variable member holds
   * the variable's value as a JSON scalar and is omitted when the variable is unbound. A
   * constant member repeats the given value. The projection needs at least one member;
   * generating the query throws otherwise. Continue the chain with `where` and the other
   * clauses of {@link PatternModuleQueryBuilder}.
   *
   * @param projection - Output member names mapped to variables or constant values.
   *
   * @example
   * List each person's name and age as JSON objects tagged with their source.
   *
   * ```ts
   * import { SparqlDatabase, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const people = await db
   *   .json({ name: v.name, age: v.age, source: 'people' })
   *   .where(triples(v.person, n.foaf.name, v.name), triples(v.person, n.foaf.age, v.age));
   * // [{ name: 'Ada', age: 36, source: 'people' }, ...]
   * ```
   *
   * ```sparql
   * JSON { "name" : ?name , "age" : ?age , "source" : "people" } WHERE {
   *   ?person foaf:name ?name .
   *   ?person foaf:age ?age .
   * }
   * ```
   */
  json:
    (context: QueryModuleContext<PatternDialect>) =>
    <P extends JsonProjection>(projection: P) =>
      new JsonQueryBuilder(projection, context),
  /**
   * Starts an ARQ `CONSTRUCT` query whose template can place triples in named graphs.
   *
   * Pass triples for the default graph and {@link quads} for named graphs. Continue the chain
   * with `where` and the other clauses of {@link PatternModuleQueryBuilder}. Awaiting the query
   * resolves to the constructed quads.
   *
   * @param template - Triples, or triples inside a named graph, to construct for each solution.
   *
   * @example
   * Copy every `foaf:knows` link into a friends graph.
   *
   * ```ts
   * import { SparqlDatabase, quads, triples } from 'sparkql/arq';
   *
   * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
   * const db = SparqlDatabase.create({ managerConfig: prefixes });
   * const [v, n] = db.createManagers([], prefixes);
   *
   * const friends = db
   *   .constructQuads(
   *     quads(db.iri('https://example.org/friends'), triples(v.person, n.foaf.knows, v.friend))
   *   )
   *   .where(triples(v.person, n.foaf.knows, v.friend));
   * ```
   *
   * ```sparql
   * CONSTRUCT { GRAPH <https://example.org/friends> {
   *   ?person foaf:knows ?friend .
   * }
   * } WHERE {
   *   ?person foaf:knows ?friend .
   * }
   * ```
   */
  constructQuads:
    (context: QueryModuleContext<PatternDialect>) =>
    (...template: QuadsInput[]) =>
      new ConstructQuadsQueryBuilder(template, context),
};
