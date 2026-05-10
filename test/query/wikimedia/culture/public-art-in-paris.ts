import { db, v, n, b } from '#test/index.js';
import {
  triples,
  predicates,
  optional,
  filter,
  ne,
  eq,
  lang,
  str,
  replace,
  group,
  union,
  bind,
  sample,
  groupConcatDistinct,
  as,
  seq,
  zeroOrMore,
} from '#src/index.js';

export default () => {
  const innerSubQuery = db
    .selectDistinct({ item: v.item })
    .where(
      union(
        group(triples(v.item, predicates([n.wdt.P136, n.wd.Q557141], [n.wdt.P131, n.wd.Q90]))),
        group(
          triples(
            v.item,
            predicates(
              [n.wdt.P136, n.wd.Q557141],
              [seq(n.wdt.P131, zeroOrMore(n.wdt.P131)), n.wd.Q90]
            )
          )
        )
      )
    )
    .$asSubQuery();

  return db
    .select({
      item: v.item,
      title: as(sample(v.titleL), v.title),
      creator: as(groupConcatDistinct(v.creatorL, ', '), v.creator),
      genre: as(groupConcatDistinct(v.genreL, ', '), v.genre),
      place: as(groupConcatDistinct(v.placeL, ', '), v.place),
      arrondissement: as(groupConcatDistinct(v.arr, ', '), v.arrondissement),
      image: as(sample(v.img), v.image),
      coordinates: as(sample(v.coord), v.coordinates),
    })
    .where(
      innerSubQuery,
      optional(triples(v.item, n.rdfs.label, v.titleL), filter(eq(lang(v.titleL), 'fr'))),
      optional(
        triples(v.item, n.wdt.P170, [n.rdfs.label, v.creatorL]),
        filter(eq(lang(v.creatorL), 'fr'))
      ),
      optional(
        union(
          group(
            triples(v.item, n.wdt.P136, v.g),
            filter(ne(str(v.g), 'http://www.wikidata.org/entity/Q557141'))
          ),
          group(triples(v.item, n.wdt.P31, v.g))
        ),
        triples(v.g, n.rdfs.label, v.genreL),
        filter(eq(lang(v.genreL), 'fr'))
      ),
      optional(
        triples(v.item, n.wdt.P276, [n.rdfs.label, v.placeL]),
        filter(eq(lang(v.placeL), 'fr'))
      ),
      optional(
        triples(v.item, n.wdt.P131, [predicates([n.wdt.P131, n.wd.Q90], [n.rdfs.label, v.arrL])]),
        filter(eq(lang(v.arrL), 'fr')),
        bind(replace(v.arrL, /^([0-9]+).*$/, '$1', 'si'), v.arr)
      ),
      optional(triples(v.item, n.wdt.P18, v.img)),
      optional(triples(v.item, n.wdt.P625, v.coord))
    )
    .groupBy(v.item);
};
