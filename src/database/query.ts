import {
  Query,
  Triple,
  Pattern,
  IriTerm,
  ValuePatternRow,
  SparqlGenerator,
} from '../generic';
import { Generator } from 'sparqljs';
import { createBgpPatterns } from '../structures';

export abstract class QueryBuilderBase<TConfig extends Query> {
  protected readonly config: TConfig;
  protected readonly endpointUrl: string;
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
}
