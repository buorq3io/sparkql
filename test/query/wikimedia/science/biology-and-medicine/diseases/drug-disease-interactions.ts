import { db, v, n } from '#test/index.js';
import {
  triples,
  predicates,
  filter,
  eq,
  lang,
  bind,
  ternary,
  oneOrMore,
  values,
} from '#src/index.js';

export default () =>
  db
    .selectDistinct({ item: v.item, itemLabel: v.itemLabel, rgb: v.rgb, link: v.link })
    .where(
      values({ [v.toggle.value]: [true, false] }),
      triples(
        v.disease,
        predicates(
          [n.wdt.P699, v.doid],
          [oneOrMore(n.wdt.P279), n.wd.Q18123741],
          [n.wdt.P2176, v.drug]
        )
      ),
      triples(v.drug, n.rdfs.label, v.drugLabel),
      filter(eq(lang(v.drugLabel), 'en')),
      triples(v.disease, n.rdfs.label, v.diseaseLabel),
      filter(eq(lang(v.diseaseLabel), 'en')),
      bind(ternary(v.toggle, v.disease, v.drug), v.item),
      bind(ternary(v.toggle, v.diseaseLabel, v.drugLabel), v.itemLabel),
      bind(ternary(v.toggle, 'FFA500', '7FFF00'), v.rgb),
      bind(ternary(v.toggle, '', v.disease), v.link)
    );
