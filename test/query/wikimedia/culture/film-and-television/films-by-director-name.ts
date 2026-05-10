import { db, v, n } from '#test/index.js';
import {
  triples,
  service,
  filter,
  eq,
  lang,
  year,
  min,
  groupConcatDistinct,
  as,
  desc,
  predicates,
  objects,
} from '#src/index.js';

export default () => {
  const innerSubQuery = db
    .select({
      film: v.film,
      genere: as(groupConcatDistinct(v.gL, ', '), v.genere),
      d: as(min(year(v.date)), v.d),
    })
    .where(
      triples(
        v.sitelink,
        predicates(
          [n.schema.about, v.director],
          [n.schema.isPartOf, db.iri('https://en.wikipedia.org/')],
          [n.schema.name, db.literal('Steven Spielberg', 'en')]
        )
      ),
      triples(v.film, predicates([n.wdt.P31, n.wd.Q11424], [n.wdt.P136, objects(v.g, v.g)])),
      triples(v.g, n.rdfs.label, v.gL),
      triples(v.film, predicates([n.wdt.P57, v.director], [n.wdt.P577, v.date])),
      filter(eq(lang(v.gL), 'en')),
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    )
    .groupBy(v.film)
    .$asSubQuery();

  return db
    .select({ film: v.film, filmLabel: v.filmLabel, genere: v.genere, d: v.d })
    .where(
      innerSubQuery,
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    )
    .orderBy(desc(v.d));
};
