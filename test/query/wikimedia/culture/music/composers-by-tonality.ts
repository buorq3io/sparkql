import { db, v, n } from '#test/index.js';
import { triples, predicates, service, count, max, as, gt, desc } from '#src/index.js';

// For explanation, see:
// https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries/examples#Composers_and_their_most-used_tonality

export default () => {
  const mostInnerQuery = db
    .select({
      composer: v.composer,
      tonality: v.tonality,
      count: as(count(v.composition), v.count),
    })
    .where(triples(v.composition, predicates([n.wdt.P86, v.composer], [n.wdt.P826, v.tonality])))
    .groupBy(v.composer, v.tonality)
    .having(gt(v.count, 1))
    .$asSubQuery();

  const innerQuery = db
    .select({ composer: v.composer, count: as(max(v.count), v.count_) })
    .where(mostInnerQuery)
    .groupBy(v.composer)
    .$asSubQuery();

  return db
    .select({ composerLabel: v.composerLabel, tonalityLabel: v.tonalityLabel, count: v.count })
    .where(
      innerQuery,
      mostInnerQuery,
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    )
    .orderBy(desc(v.count));
};
