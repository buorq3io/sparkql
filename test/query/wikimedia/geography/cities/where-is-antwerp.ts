import { db, v, n } from '#test/index.js';
import { triples, oneOrMore, filter, regex } from '#src/index.js';

export default () =>
  db
    .selectDistinct({ settlement: v.settlement, name: v.name, coor: v.coor })
    .where(
      triples(v.subclass_settlement, oneOrMore(n.wdt.P279), n.wd.Q486972),
      triples(v.settlement, n.wdt.P31, v.subclass_settlement),
      triples(v.settlement, n.wdt.P625, v.coor),
      triples(v.settlement, n.rdfs.label, v.name),
      filter(regex(v.name, 'Antwerp', 'i'))
    )
    .limit(50);
