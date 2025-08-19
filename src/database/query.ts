import { SparqlQueryBuilderBase } from './sparql-query.js';
import { Query, Pattern, IriTerm, ValuePatternRow } from '../generic.js';

export abstract class QueryBuilderBase<
  TConfig extends Query,
  KReturn
> extends SparqlQueryBuilderBase<TConfig, KReturn> {
  from(...iris: IriTerm[]) {
    if (iris.length === 0) {
      return this;
    }

    if (this.config.from) {
      this.config.from.default = [...this.config.from.default, ...iris];
    } else {
      this.config.from = {
        default: iris,
        named: [],
      };
    }
    return this;
  }

  fromNamed(...iris: IriTerm[]) {
    if (iris.length === 0) {
      return this;
    }

    if (this.config.from) {
      this.config.from.named = [...this.config.from.named, ...iris];
    } else {
      this.config.from = {
        default: [],
        named: iris,
      };
    }
    return this;
  }

  values(...rows: ValuePatternRow[]) {
    if (rows.length === 0) {
      return this;
    }

    if (this.config.values) {
      this.config.values = [
        ...this.config.values,
        ...rows.map(r => this.sanitizeValuePatternRow(r)),
      ];
    } else {
      this.config.values = rows.map(r => this.sanitizeValuePatternRow(r));
    }
    return this;
  }

  where(...patterns: Pattern[]) {
    if (patterns.length === 0) {
      return this;
    }

    if (this.config.where) {
      this.config.where = [...this.config.where, ...patterns.map(p => this.sanitizePattern(p))];
    } else {
      this.config.where = patterns.map(p => this.sanitizePattern(p));
    }
    return this;
  }
}
