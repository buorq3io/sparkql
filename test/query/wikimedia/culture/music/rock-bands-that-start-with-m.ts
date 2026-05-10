import { db, v, n } from '#test/index.js';
import { triples, filter, eq, lang, strstarts, asc, lcase } from '#src/index.js';

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
