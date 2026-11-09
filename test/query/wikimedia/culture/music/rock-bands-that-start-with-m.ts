import { asc, eq, filter, lang, lcase, strstarts, triples } from '#src/index.js';
import { db, n, v } from '#test/index.js';

export default () =>
  db
    .select({ band: v.band, bandLabel: v.bandLabel })
    .where(
      triples(v.band, n.wdt.P31, n.wd.Q5741069),
      triples(v.band, n.rdfs.label, v.bandLabel),
      filter(eq(lang(v.bandLabel), 'en')),
      filter(strstarts(v.bandLabel, 'M'))
    )
    .orderBy(asc(lcase(v.bandLabel)));
