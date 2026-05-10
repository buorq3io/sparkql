import { db, v, n } from '#test/index.js';
import { triples, service, count, desc, as, asc } from '#src/index.js';

export default () =>
  db
    .select({ place: v.place, placeLabel: v.placeLabel, count: as(count(), v.count) })
    .where(
      triples(v.item, n.wdt.P136, n.wd.Q557141),
      triples(v.item, n.wdt.P131, v.place),
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    )
    .groupBy(v.place, v.placeLabel)
    .orderBy(desc(v.count), asc(v.placeLabel));
