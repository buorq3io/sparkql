import { db, v, n } from '#test/index.js';
import { triples, objects } from '#src/index.js';

export default () =>
  db
    .select({ lexemeId: v.lexemeId, lemma: v.lemma, form: v.form, word: v.word })
    .where(
      triples(v.lexemeId, n.dct.language, n.wd.Q9288),
      triples(v.lexemeId, n.wikibase.lexicalCategory, n.wd.Q1084),
      triples(v.lexemeId, n.wikibase.lemma, v.lemma),
      triples(v.lexemeId, n.ontolex.lexicalForm, v.form),
      triples(v.form, n.wikibase.grammaticalFeature, objects(n.wd.Q499327, n.wd.Q1775415)),
      triples(v.form, n.ontolex.representation, v.word)
    );
