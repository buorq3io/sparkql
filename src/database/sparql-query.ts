import {
  Term,
  Quads,
  BlankTerm,
  LiteralTerm,
  PrimitiveTerm,
  AnonymousBlankTerm,
  Pattern,
  Expression,
  SparqlQuery,
  ValuePatternRow,
  QueryReturnType,
  SparqlGenerator,
  FactoryFunctions,
} from '../generic.js';
import SparqlJs from 'sparqljs';
import SparqlClient from 'sparql-http-client';
import { bgp } from '../structures/index.js';

export abstract class SparqlQueryBuilderBase<TConfig extends SparqlQuery, KReturn> {
  protected readonly config: TConfig;
  protected readonly endpointUrl: string | undefined;
  protected _promise: Promise<KReturn> | null = null;
  protected readonly sparqlGenerator: SparqlGenerator;
  protected readonly factoryFunctions: FactoryFunctions;
  protected readonly anonymousBlanks: Map<symbol, Exclude<BlankTerm, AnonymousBlankTerm>>;

  protected constructor(initialConfig: TConfig, factoryFunctions: FactoryFunctions) {
    this.config = initialConfig;
    this.anonymousBlanks = new Map<symbol, Exclude<BlankTerm, AnonymousBlankTerm>>();
    this.factoryFunctions = factoryFunctions;
    this.sparqlGenerator = new SparqlJs.Generator();
    this.endpointUrl = process.env.DATABASE_URL;
  }

  public getSPARQL() {
    return this.config;
  }

  public toSPARQL() {
    return this.sparqlGenerator.stringify(this.getSPARQL());
  }

  protected abstract makeQuery(client: SparqlClient): Promise<KReturn>;

  protected execute(): Promise<KReturn> {
    if (!this.endpointUrl) {
      throw Error(
        '$DATABASE_URL environment variable ' + 'should be defined as your SPARQL endpoint!'
      );
    }

    if (this._promise) {
      return this._promise;
    }

    this._promise = (async () => {
      try {
        const client = new SparqlClient({ endpointUrl: this.endpointUrl });
        return await this.makeQuery(client);
      } catch (error) {
        console.error('SPARQL execution failed:', error);
        throw error;
      }
    })();
    return this._promise;
  }

  public then<TResult1 = KReturn, TResult2 = never>(
    onfulfilled?: ((value: KReturn) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  protected sanitizeTerm<T extends Term>(
    t: T
  ): T extends Exclude<Term, PrimitiveTerm | AnonymousBlankTerm>
    ? T
    : T extends PrimitiveTerm
    ? Exclude<LiteralTerm, PrimitiveTerm>
    : Exclude<BlankTerm, AnonymousBlankTerm> {
    const urls = {
      integer: 'http://www.w3.org/2001/XMLSchema#integer',
      float: 'http://www.w3.org/2001/XMLSchema#decimal',
      bigint: 'http://www.w3.org/2001/XMLSchema#integer',
      boolean: 'http://www.w3.org/2001/XMLSchema#boolean',
    };

    if (Array.isArray(t) && t.length === 0) {
      return this.factoryFunctions.blank() as any;
    } else if (typeof t === 'symbol') {
      if (!this.anonymousBlanks.get(t)) {
        this.anonymousBlanks.set(t, this.factoryFunctions.blank());
      }
      return this.anonymousBlanks.get(t) as any;
    } else if (typeof t === 'number') {
      if (Number.isInteger(t)) {
        return this.factoryFunctions.literal(
          t.toString(),
          this.factoryFunctions.iri(urls.integer)
        ) as any;
      } else {
        return this.factoryFunctions.literal(
          t.toString(),
          this.factoryFunctions.iri(urls.float)
        ) as any;
      }
    } else if (typeof t === 'bigint') {
      return this.factoryFunctions.literal(
        t.toString(),
        this.factoryFunctions.iri(urls.integer)
      ) as any;
    } else if (typeof t === 'boolean') {
      return this.factoryFunctions.literal(
        t ? 'true' : 'false',
        this.factoryFunctions.iri(urls.boolean)
      ) as any;
    } else if (typeof t === 'string') {
      return this.factoryFunctions.literal(t) as any;
    }

    return t as any;
  }

  protected sanitizeExpression<T extends QueryReturnType>(
    expression: Expression<T>
  ): SparqlJs.Expression {
    const isExpressionOrPattern = (o: Expression | Pattern): o is Expression => {
      if (typeof o !== 'object') {
        return true;
      } else if (!('type' in o)) {
        return true;
      } else if (['operation', 'functionCall', 'aggregate'].includes(o.type)) {
        return true;
      }
      return false;
    };

    if (Array.isArray(expression)) {
      return expression.map(e => this.sanitizeExpression(e));
    } else if (typeof expression !== 'object') {
      return this.sanitizeTerm(expression);
    } else if ('type' in expression) {
      if (expression.type === 'operation') {
        return {
          ...expression,
          args: expression.args.map(a => {
            if (isExpressionOrPattern(a)) {
              return this.sanitizeExpression(a);
            } else {
              return this.sanitizePattern(a);
            }
          }),
        };
      } else if (expression.type === 'functionCall') {
        return {
          ...expression,
          args: expression.args.map(a => {
            return this.sanitizeExpression(a);
          }),
        };
      } else if (expression.type === 'aggregate') {
        return {
          ...expression,
          expression:
            typeof expression.expression === 'object' &&
            'termType' in expression.expression &&
            expression.expression.termType === 'Wildcard'
              ? expression.expression
              : this.sanitizeExpression(expression.expression),
        };
      }
      throw Error();
    }

    return expression;
  }

  protected sanitizeValuePatternRow(row: ValuePatternRow): SparqlJs.ValuePatternRow {
    const result = {} as Record<string, any>;
    for (const key in row) {
      result[key] = row[key] ? this.sanitizeTerm(row[key]) : undefined;
    }
    return result;
  }

  protected sanitizePattern(pattern: Pattern): SparqlJs.Pattern {
    if (pattern.type === 'triple') {
      return this.sanitizePattern(bgp(pattern));
    }

    if (pattern.type === 'bgp') {
      return {
        ...pattern,
        triples: pattern.triples.map(t => {
          return {
            ...t,
            subject: this.sanitizeTerm(t.subject),
            object: this.sanitizeTerm(t.object),
          };
        }),
      };
    } else if (
      pattern.type === 'optional' ||
      pattern.type === 'union' ||
      pattern.type === 'group' ||
      pattern.type === 'graph' ||
      pattern.type === 'minus' ||
      pattern.type === 'service'
    ) {
      return {
        ...pattern,
        patterns: pattern.patterns.map(p => {
          return this.sanitizePattern(p);
        }),
      };
    } else if (pattern.type === 'filter' || pattern.type === 'bind') {
      return {
        ...pattern,
        expression: this.sanitizeExpression(pattern.expression),
      };
    } else if (pattern.type === 'values') {
      return {
        ...pattern,
        values: pattern.values?.map(v => this.sanitizeValuePatternRow(v)),
      };
    } else if (pattern.type === 'query') {
      return pattern;
    }
    throw Error();
  }

  protected sanitizeQuads(quads: Quads): SparqlJs.Quads {
    if (quads.type === 'triple') {
      return this.sanitizePattern(bgp(quads)) as any;
    } else if (quads.type === 'bgp') {
      return this.sanitizePattern(quads) as any;
    } else if (quads.type === 'graph') {
      return { ...quads, triples: quads.triples.map(t => this.sanitizePattern(t)) as any };
    }
    throw Error();
  }
}
