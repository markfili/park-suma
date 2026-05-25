// The 24 officially protected park-šume (forest parks) of the City of Zagreb.
// Coordinates geocoded via OpenStreetMap/Nominatim. The list runs roughly
// west → east along the Medvednica foothills. Two parks not in OSM (Lisičine,
// Dankovečina) are interpolated along that chain and flagged approx:true.
// Districts are Zagreb's "gradske četvrti" (used for District Sweeps).
const PARKS = [
  { name: "Susedgrad",         lat: 45.82029, lon: 15.83100, district: "Podsused – Vrapče" },
  { name: "Lisičine",          lat: 45.82100, lon: 15.87700, district: "Podsused – Vrapče", approx: true },
  { name: "Grmoščica",         lat: 45.81725, lon: 15.92225, district: "Črnomerec" },
  { name: "Šestinski dol",     lat: 45.81895, lon: 15.94525, district: "Črnomerec" },
  { name: "Zamorski breg",     lat: 45.83744, lon: 15.94652, district: "Črnomerec" },
  { name: "Vrhovec",           lat: 45.82957, lon: 15.94656, district: "Črnomerec" },
  { name: "Jelenovac",         lat: 45.82652, lon: 15.95103, district: "Črnomerec" },
  { name: "Pantovčak",         lat: 45.83575, lon: 15.95573, district: "Gornji grad – Medveščak" },
  { name: "Prekrižje",         lat: 45.84663, lon: 15.95715, district: "Podsljeme" },
  { name: "Kraljevec",         lat: 45.83698, lon: 15.96423, district: "Gornji grad – Medveščak" },
  { name: "Zelengaj",          lat: 45.82422, lon: 15.96673, district: "Gornji grad – Medveščak" },
  { name: "Tuškanac",          lat: 45.82508, lon: 15.97353, district: "Gornji grad – Medveščak" },
  { name: "Dubravkin put",     lat: 45.81785, lon: 15.97164, district: "Gornji grad – Medveščak" },
  { name: "Cmrok",             lat: 45.83519, lon: 15.97342, district: "Gornji grad – Medveščak" },
  { name: "Remetski kamenjak", lat: 45.84691, lon: 15.97965, district: "Gornji grad – Medveščak" },
  { name: "Mirogoj",           lat: 45.84103, lon: 15.98848, district: "Gornji grad – Medveščak" },
  { name: "Remete",            lat: 45.85318, lon: 16.00295, district: "Maksimir" },
  { name: "Maksimir",          lat: 45.83152, lon: 16.01905, district: "Maksimir" },
  { name: "Dotrščina",         lat: 45.85493, lon: 16.01513, district: "Gornja Dubrava" },
  { name: "Miroševečina",      lat: 45.86570, lon: 16.02293, district: "Gornja Dubrava" },
  { name: "Dankovečina",       lat: 45.86000, lon: 16.03600, district: "Gornja Dubrava", approx: true },
  { name: "Granešina",         lat: 45.85336, lon: 16.04918, district: "Gornja Dubrava" },
  { name: "Oporovec",          lat: 45.85768, lon: 16.06776, district: "Gornja Dubrava" },
  { name: "Čulinečina",        lat: 45.81102, lon: 16.07547, district: "Gornja Dubrava" },
];
