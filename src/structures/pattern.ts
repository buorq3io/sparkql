import {
  IriTerm,
  VariableTerm,
  Triple,
  Pattern,
  Quads,
  UpdateQuads,
  GraphQuads,
  BgpPattern,
  BindPattern,
  UnionPattern,
  GroupPattern,
  GraphPattern,
  MinusPattern,
  FilterPattern,
  ValuesPattern,
  ServicePattern,
  OptionalPattern,
  ValuePatternRow,
  PatternOrTriple,
  ExpressionOrPrimitive,
} from '../generic';
import { processPrimitiveExpression } from './expression';

export function createBgpPatterns(patterns: PatternOrTriple[]) {
  const isPatternNotTriple = (v: any): v is Pattern => {
    return !!v.type;
  };

  let temp: Triple[] = [];
  const result: Pattern[] = [];

  for (const pattern of patterns) {
    if (isPatternNotTriple(pattern)) {
      if (temp.length != 0) {
        result.push(bgp(...temp));
        temp = [];
      }
      result.push(pattern);
    } else {
      temp.push(pattern);
    }
  }
  if (temp.length != 0) {
    result.push(bgp(...temp));
  }
  return result;
}

export function createBgpQuads(quads: UpdateQuads): Quads[] {
  let temp: Triple[] = [];
  const result: Quads[] = [];

  for (const quad of quads) {
    if ('type' in quad) {
      if (temp.length != 0) {
        result.push(bgp(...temp));
        temp = [];
      }
      result.push(quad);
    } else {
      temp.push(quad);
    }
  }
  if (temp.length != 0) {
    result.push(bgp(...temp));
  }
  return result;
}

export function bgp(...triples: Triple[]): BgpPattern {
  return {
    type: 'bgp',
    triples: triples,
  };
}

export function optional(...patterns: PatternOrTriple[]): OptionalPattern {
  return {
    type: 'optional',
    patterns: createBgpPatterns(patterns),
  };
}

export function union(...patterns: PatternOrTriple[]): UnionPattern {
  return {
    type: 'union',
    patterns: createBgpPatterns(patterns),
  };
}

export function group(...patterns: PatternOrTriple[]): GroupPattern {
  return {
    type: 'group',
    patterns: createBgpPatterns(patterns),
  };
}

export function graph(
  name: IriTerm | VariableTerm,
  ...patterns: PatternOrTriple[]
): GraphPattern {
  return {
    type: 'graph',
    name: name,
    patterns: createBgpPatterns(patterns),
  };
}

export function quadgraph(
  name: IriTerm | VariableTerm,
  ...triples: Triple[]
): GraphQuads {
  return {
    type: 'graph',
    name: name,
    triples: triples,
  };
}

export function minus(...patterns: PatternOrTriple[]): MinusPattern {
  return {
    type: 'minus',
    patterns: createBgpPatterns(patterns),
  };
}

function serviceBase(
  name: IriTerm | VariableTerm,
  silent: boolean,
  ...patterns: PatternOrTriple[]
): ServicePattern {
  return {
    type: 'service',
    name: name,
    silent: silent,
    patterns: createBgpPatterns(patterns),
  };
}

export function service(
  name: IriTerm | VariableTerm,
  ...patterns: PatternOrTriple[]
): ServicePattern {
  return serviceBase(name, false, ...patterns);
}

export function serviceSilent(
  name: IriTerm | VariableTerm,
  ...patterns: PatternOrTriple[]
): ServicePattern {
  return serviceBase(name, true, ...patterns);
}

export function filter(expression: ExpressionOrPrimitive<any>): FilterPattern {
  return {
    type: 'filter',
    expression: processPrimitiveExpression(expression),
  };
}

export function bind(
  expression: ExpressionOrPrimitive<any>,
  variable: VariableTerm
): BindPattern {
  return {
    type: 'bind',
    expression: processPrimitiveExpression(expression),
    variable: variable,
  };
}

export function values(...values: ValuePatternRow[]): ValuesPattern {
  return {
    type: 'values',
    values: values,
  };
}
