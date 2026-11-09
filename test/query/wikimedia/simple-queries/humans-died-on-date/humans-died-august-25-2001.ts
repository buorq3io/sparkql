import {
  asc,
  bind,
  inv,
  predicates,
  replace,
  service,
  triples,
  ucase,
  values,
} from '#src/index.js';
import { db, n, v } from '#test/index.js';

export default () =>
  db
    .select({
      item: v.item,
      articlename: v.articlename,
      itemLabel: v.itemLabel,
      itemDescription: v.itemDescription,
      sl: v.sl,
    })
    .where(
      values({ dod: [db.literal('+2001-08-25', n.xsd.dateTime)] }),
      triples(v.dod, inv(n.wdt.P570), v.item),
      triples(v.item, n.wikibase.sitelinks, v.sl),
      triples(v.item, inv(n.schema.about), v.article),
      triples(
        v.article,
        predicates(
          [n.schema.isPartOf, db.iri('https://en.wikipedia.org/')],
          [n.schema.name, v.articlename]
        )
      ),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en'),
        triples(v.item, n.rdfs.label, v.itemLabel),
        triples(v.item, n.schema.description, v.itemDescription)
      ),
      bind(
        replace(
          v.itemLabel,
          /^.*(?<! [Vv][ao]n| [Dd][aeiu]| [Dd][e][lns]| [Ll][ae]) (?!([SJ]r\.?|[XVI]+)$)/,
          ''
        ),
        v.sortname
      )
    )
    .orderBy(asc(ucase(v.sortname)), asc(ucase(v.itemLabel)));
