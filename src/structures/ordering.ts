import { OrderingInput, ExpressionInput } from '../helpers/types.js';

export function asc(expression: ExpressionInput): OrderingInput {
  return {
    descending: false,
    expression: expression,
    loc: {
      sourceLocationType:'autoGenerate'
    }
  }
}

export function desc(expression: ExpressionInput): OrderingInput {
  return {
    descending: true,
    expression: expression,
    loc: {
      sourceLocationType:'autoGenerate'
    }
  }
}
