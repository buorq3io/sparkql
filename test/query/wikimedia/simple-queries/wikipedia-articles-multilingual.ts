import { db, v, n } from '#test/index.js';
import { triples, predicates, filter, inArray, not, contains } from '#src/index.js';

export default () =>
  db
    .selectDistinct({ lang: v.lang, name: v.name })
    .where(
      triples(v.article, n.schema.about, n.wd.Q5),
      triples(n.hint.Prior, n.hint.runFirst, true),
      triples(
        v.article,
        predicates(
          [n.schema.inLanguage, v.lang],
          [n.schema.name, v.name],
          [n.schema.isPartOf, [n.wikibase.wikiGroup, 'wikipedia']]
        )
      ),
      filter(inArray(v.lang, ['en', 'uz', 'ru', 'ko'])),
      filter(not(contains(v.name, ':')))
    );
