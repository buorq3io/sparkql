import { db, v, n } from '#test/index.js';
import {
  triples,
  predicates,
  service,
  filter,
  langMatches,
  lang,
  groupConcatDistinct,
  as,
  inArray,
} from '#src/index.js';

export default () => {
  const innerSubQuery = db
    .selectDistinct({
      animal: v.animal,
      scientific_names: as(groupConcatDistinct(v.scientific_name, ', '), v.scientific_names),
      common_names: as(groupConcatDistinct(v.common_name, ', '), v.common_names),
    })
    .where(
      triples(
        v.animal,
        predicates(
          [n.wdt.P141, v.status],
          [n.wdt.P225, v.scientific_name],
          [n.wdt.P1843, v.common_name]
        )
      ),
      filter(inArray(v.status, [n.wd.Q11394, n.wd.Q219127, n.wd.Q278113])),
      filter(langMatches(lang(v.common_name), 'en'))
    )
    .groupBy(v.animal)
    .$asSubQuery();

  return db
    .select({
      animal: v.animal,
      scientific_names: v.scientific_names,
      common_names: v.common_names,
      statusLabel: v.statusLabel,
    })
    .where(
      innerSubQuery,
      triples(v.animal, n.wdt.P141, v.status),
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    );
};
