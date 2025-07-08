import { createBgpPatterns } from '../structures';
import { SparqlQueryBuilderBase } from './sparql-query';
import { Query, Triple, Pattern, IriTerm, ValuePatternRow } from '../generic';

export abstract class QueryBuilderBase<
  TConfig extends Query,
  KReturn
> extends SparqlQueryBuilderBase<TConfig, KReturn> {
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
}
