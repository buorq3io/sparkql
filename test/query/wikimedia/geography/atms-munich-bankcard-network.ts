import { db, v, n } from '#test/index.js';
import {
  triples,
  service,
  minus,
  union,
  group,
  filter,
  bind,
  createFunctionCallExpression,
  strlang,
  predicates,
} from '#src/index.js';

export default () =>
  db
    .select({ atm: v.atm, geometry: v.geometry, bank: v.bank, bankLabel: v.bankLabel })
    .where(
      triples(n.hint.Query, n.hint.optimizer, 'None'),
      service(
        db.iri('http://linkedgeodata.org/sparql'),
        union(
          group(triples(v.atm, predicates([n.rdf.type, n.lgdo.Bank], [n.lgdo.atm, true]))),
          group(triples(v.atm, n.rdf.type, n.lgdo.Atm))
        ),
        triples(
          v.atm,
          predicates([n.geom.geometry, [n.geo.asWKT, v.geometry]], [n.lgdo.operator, v.operator])
        ),
        filter(
          createFunctionCallExpression(n.bif.st_intersects, [
            v.geometry,
            createFunctionCallExpression(n.bif.st_point, [11.5746898, 48.1479876]),
            5,
          ])
        )
      ),
      bind(strlang(v.operator, 'de'), v.bankLabel),
      triples(v.bank, n.rdfs.label, v.bankLabel),
      union(
        group(triples(v.bank, n.wdt.P527, n.wd.Q806724)),
        group(triples(v.bank, n.wdt.P1454, n.wd.Q5349747))
      ),
      minus(triples(n.wd.Q806724, n.wdt.P3113, v.bank))
    );
