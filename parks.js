// The 24 officially protected park-šume (forest parks) of the City of Zagreb.
// Coordinates geocoded via OpenStreetMap/Nominatim. The list runs roughly
// west → east along the Medvednica foothills. Two parks not in OSM (Lisičine,
// Dankovečina) are interpolated along that chain and flagged approx:true.
// Districts are Zagreb's "gradske četvrti" (used for District Sweeps).
// ha = area in hectares from OSM boundary polygons (null = no polygon mapped).
const PARKS = [
  { name: "Susedgrad",         lat: 45.82029, lon: 15.83100, district: "Podsused – Vrapče", ha: 6.9 },
  { name: "Lisičine",          lat: 45.82438, lon: 15.86608, district: "Podsused – Vrapče", ha: 8.8 },
  { name: "Grmoščica",         lat: 45.81724, lon: 15.91650, district: "Črnomerec", ha: 71.3 },
  { name: "Šestinski dol",     lat: 45.81895, lon: 15.94525, district: "Črnomerec", ha: 10.1 },
  { name: "Zamorski breg",     lat: 45.83744, lon: 15.94652, district: "Črnomerec", ha: null },
  { name: "Vrhovec",           lat: 45.82957, lon: 15.94656, district: "Črnomerec", ha: 30.2 },
  { name: "Jelenovac",         lat: 45.82652, lon: 15.95103, district: "Črnomerec", ha: 49.5 },
  { name: "Pantovčak",         lat: 45.83575, lon: 15.95573, district: "Gornji grad – Medveščak", ha: 104.9 },
  { name: "Prekrižje",         lat: 45.84251, lon: 15.96007, district: "Podsljeme", ha: 15.5 },
  { name: "Kraljevec",         lat: 45.83698, lon: 15.96423, district: "Gornji grad – Medveščak", ha: 52.5 },
  { name: "Zelengaj",          lat: 45.82422, lon: 15.96673, district: "Gornji grad – Medveščak", ha: 43.8 },
  { name: "Tuškanac",          lat: 45.82508, lon: 15.97353, district: "Gornji grad – Medveščak", ha: 38.5 },
  { name: "Dubravkin put",     lat: 45.81785, lon: 15.97164, district: "Gornji grad – Medveščak", ha: null },
  { name: "Cmrok",             lat: 45.83519, lon: 15.97342, district: "Gornji grad – Medveščak", ha: null },
  { name: "Remetski kamenjak", lat: 45.84691, lon: 15.97965, district: "Gornji grad – Medveščak", ha: 61.4 },
  { name: "Mirogoj",           lat: 45.84103, lon: 15.98848, district: "Gornji grad – Medveščak", ha: 37.1 },
  { name: "Remete",            lat: 45.85459, lon: 15.99646, district: "Maksimir", ha: 94.0 },
  { name: "Maksimir",          lat: 45.83152, lon: 16.01905, district: "Maksimir", ha: 164.4 },
  { name: "Dotrščina",         lat: 45.85493, lon: 16.01513, district: "Gornja Dubrava", ha: 311.0 },
  { name: "Miroševečina",      lat: 45.86712, lon: 16.02738, district: "Gornja Dubrava", ha: 119.8 },
  { name: "Dankovečina",       lat: 45.86611, lon: 16.04565, district: "Gornja Dubrava", ha: 180.4 },
  { name: "Granešina",         lat: 45.85336, lon: 16.04918, district: "Gornja Dubrava", ha: 20.7 },
  { name: "Oporovec",          lat: 45.85768, lon: 16.06776, district: "Gornja Dubrava", ha: 101.2 },
  { name: "Čulinečina",        lat: 45.81102, lon: 16.07547, district: "Gornja Dubrava", ha: 86.9 },
];
