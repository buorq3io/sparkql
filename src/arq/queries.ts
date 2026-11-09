import { GeneratorBuilder } from '@traqula/core';
import * as AST from '@traqula/rules-sparql-1-1';
import type { DataFactory } from 'rdf-data-factory';
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
import type { QuadsInput, TermLiteralInput, TermVariableInput } from '../helpers/types.js';
import { isObjectLike, termLiteral, termVariable } from '../helpers/utilities.js';
import { arqGeneratorBuilder } from './generator.js';
import type { ArqAST, ArqInput } from './types.js';

type PatternDialect = SparqlDialect<ArqInput, ArqAST>;
type Body = DialectAST<PatternDialect, AST.QuerySelect>;
export type JsonScalar = string | number | boolean | null;
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
/** Unbound variables are omitted by ARQ; JavaScript result transforms do not apply. */
export type JsonResult<P extends JsonProjection> = {
  [K in Exclude<keyof P, VariableKeys<P>>]: JsonConstant<P[K]>;
} & { [K in VariableKeys<P>]?: JsonScalar };
export interface JsonQueryAST {
  type: 'query';
  subType: 'json';
  loc: AST.Query['loc'];
  projection: Record<string, AST.TermVariable | AST.TermLiteral>;
  body: Body;
}
export interface ConstructQuadsAST {
  type: 'query';
  subType: 'constructQuads';
  loc: AST.Query['loc'];
  template: AST.Quads[];
  body: Body;
}
export type ConstructedQuad = ReturnType<DataFactory['quad']>;
interface JsonConfig<P extends JsonProjection> extends PatternQueryConfig {
  projection: P;
}
interface QuadsConfig extends PatternQueryConfig {
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
    execute: async (sparql, client, ast) => {
      const data = await requestQueryJson(client, sparql, 'application/json');
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
    execute: async (sparql, client) => {
      const results: ConstructedQuad[] = [];
      const stream = client.query.construct(sparql, {
        operation: 'postDirect',
        headers: { accept: 'application/n-quads' },
      });
      for await (const quad of stream) results.push(quad);
      return results;
    },
  };
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
export const arqQueries = {
  json:
    (context: QueryModuleContext<PatternDialect>) =>
    <P extends JsonProjection>(projection: P) =>
      new JsonQueryBuilder(projection, context),
  constructQuads:
    (context: QueryModuleContext<PatternDialect>) =>
    (...template: QuadsInput[]) =>
      new ConstructQuadsQueryBuilder(template, context),
};
