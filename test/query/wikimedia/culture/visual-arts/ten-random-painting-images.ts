import { db, v, n } from '#test/index.js';
import { triples, service, md5, concat, str, rand, as, asc } from '#src/index.js';

export default () =>
  db
    .select({
      item: v.item,
      itemLabel: v.itemLabel,
      image: v.image,
      random: as(md5(concat(str(v.item), str(rand()))), v.random),
    })
    .where(
      triples(v.item, n.wdt.P31, n.wd.Q3305213),
      triples(v.item, n.wdt.P18, v.image),
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    )
    .orderBy(asc(v.random))
    .limit(10)
    .offset(0);
