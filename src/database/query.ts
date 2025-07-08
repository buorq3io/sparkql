import {
  Query,
  Triple,
  Pattern,
  IriTerm,
  ValuePatternRow,
  SparqlGenerator,
} from '../generic';
import { Generator } from 'sparqljs';
import SparqlClient from 'sparql-http-client';
import { createBgpPatterns } from '../structures';

export abstract class QueryBuilderBase<TConfig extends Query, KReturn> {
  protected readonly config: TConfig;
  protected readonly endpointUrl: string;
  protected _promise: Promise<KReturn> | null = null;
  protected readonly sparqlGenerator: SparqlGenerator;

  protected constructor(initialConfig: TConfig) {
    if (!process.env.DATABASE_URL) {
      throw Error(
        '$DATABASE_URL environment variable ' +
          'should be defined as your SPARQL endpoint!'
      );
    }

    this.config = initialConfig;
    this.sparqlGenerator = new Generator();
    this.endpointUrl = process.env.DATABASE_URL;
  }

  from(...iris: IriTerm[]) {
    if (this.config.from) {
      this.config.from.default = [...this.config.from.default, ...iris];
    } else {
      this.config.from = {
        default: iris,
        named: [],
      };
    }
  }

  fromNamed(...iris: IriTerm[]) {
    if (this.config.from) {
      this.config.from.named = [...this.config.from.named, ...iris];
    } else {
      this.config.from = {
        default: [],
        named: iris,
      };
    }
  }

  values(...rows: ValuePatternRow[]) {
    if (this.config.values) {
      this.config.values = [...this.config.values, ...rows];
    } else {
      this.config.values = rows;
    }
  }

  where(...patterns: (Pattern | Triple)[]) {
    if (patterns.length !== 0) {
      this.config.where = createBgpPatterns(patterns);
    }
    return this;
  }

  getSPARQL() {
    return this.config;
  }

  toSPARQL() {
    return this.sparqlGenerator.stringify(this.getSPARQL());
  }

  protected abstract makeQuery(client: SparqlClient): Promise<KReturn>;

  protected execute(): Promise<KReturn> {
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
}
