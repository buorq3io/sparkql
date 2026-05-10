import { db, v, n } from '#test/index.js';
import { triples, service, optional, minus, seq, zeroOrMore, asc } from '#src/index.js';

export default () =>
  db
    .selectDistinct({ item: v.item, itemLabel: v.itemLabel, website: v.website })
    .where(
      triples(v.item, seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q212805),
      optional(triples(v.item, n.wdt.P856, v.website)),
      minus(triples(v.item, n.wdt.P576, [])),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, 'en, es, ca, fr, de, pl, uk, ru, he')
      )
    )
    .orderBy(asc(v.itemLabel));
