import SparqlJs from 'sparqljs';

export function canonicalizeQuery(query: SparqlJs.SparqlQuery, blankNodePrefix: string): any {
  const newQuery = JSON.parse(JSON.stringify(query));

  const bnodeMap = new Map<string, string>();
  let bnodeCounter = 0;

  function walk(node: any) {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (node.termType === 'BlankNode' && node.value.startsWith(blankNodePrefix)) {
      if (!bnodeMap.has(node.value)) {
        bnodeMap.set(node.value, `g_${bnodeCounter++}`);
      }
      node.value = bnodeMap.get(node.value);
    }

    // Recurse into child properties
    for (const key in node) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        walk(node[key]);
      }
    }
  }

  walk(newQuery);
  return newQuery;
}
