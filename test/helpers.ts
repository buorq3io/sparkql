import * as AST from '@traqula/rules-sparql-1-1';

export function canonicalizeQuery(query: AST.SparqlQuery, blankNodePrefix: string): any {
  const newQuery = JSON.parse(JSON.stringify(query));

  const bnodeMap = new Map<string, string>();
  let bnodeCounter = 0;

  function walk(node: AST.Sparql11Nodes) {
    if (typeof node !== 'object' || node === null) {
      return;
    }

    if (
      'type' in node &&
      node.type === 'term' &&
      node.subType === 'blankNode' &&
      node.label.startsWith(blankNodePrefix)
    ) {
      if (!bnodeMap.has(node.label)) {
        bnodeMap.set(node.label, `g_${bnodeCounter++}`);
      }
      node.label = bnodeMap.get(node.label)!;
    }

    // Recurse into child properties
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        if (key === "loc") {
          node[key] = undefined as any
          continue
        }
        walk(node[key as keyof AST.Sparql11Nodes] as any);
      }
    }
  }

  walk(newQuery);
  return newQuery;
}
