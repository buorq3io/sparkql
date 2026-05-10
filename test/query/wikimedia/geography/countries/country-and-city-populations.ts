import { db, v, n } from '#test/index.js';
import { triples, service, as, sum, asc, div } from '#src/index.js';
export default () =>
  db
    .select({
      country: v.country,
      countryLabel: v.countryLabel,
      population: v.population,
      totalCityPopulation: v.totalCityPopulation,
      ratio: as(div(v.population, v.totalCityPopulation), v.ratio),
    })
    .where(
      triples(v.country, n.wdt.P1082, v.population),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en')
      ),
      db
        .select({
          country: v.country,
          totalCityPopulation: as(sum(v.cityPopulation), v.totalCityPopulation),
        })
        .where(
          triples(v.city, n.wdt.P31, n.wd.Q515),
          triples(v.city, n.wdt.P17, v.country),
          triples(v.city, n.wdt.P1082, v.cityPopulation)
        )
        .groupBy(v.country)
        .$asSubQuery()
    )
    .orderBy(asc(v.ratio));
