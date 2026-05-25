// Toggleable nextbike station layer. Reuses app.js globals (map, L, PARKS,
// isVisited, state, haversine, fmtDist, toast) + tr() (i18n.js).
(function () {
  const FEED = 'https://maps.nextbike.net/maps/nextbike-live.json?city=1172&domains=hd&list_cities=0&bikes=0';
  const NEAR_M = 300;
  const POLL_MS = 60000;

  let layer = null, places = [], timer = null, on = false;

  function fetchBikes() {
    return fetch(FEED + '&t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        const cities = (d.countries || []).reduce((a, c) => a.concat(c.cities || []), []);
        const city = cities.find(c => String(c.uid) === '1172') || cities[0];
        return (city && city.places) ? city.places : [];
      });
  }

  function nearUnvisited(p) {
    return PARKS.some(pk => !isVisited(pk.name) && haversine(p.lat, p.lng, pk.lat, pk.lon) <= NEAR_M);
  }
  function badgeHtml(p) {
    const n = p.bikes || 0;
    let cls = 'bike-badge';
    if (!n) cls += ' empty';
    if (n && nearUnvisited(p)) cls += ' near';
    return '<div class="' + cls + '">🚲 ' + n + '</div>';
  }
  function popupHtml(p) {
    return '<b>' + p.name + '</b><br>' +
      '<span class="pop-meta">' + tr('bike.popup', { n: p.bikes || 0, f: p.free_racks || 0 }) + '</span><br>' +
      '<a class="pop-link" href="https://www.google.com/maps/dir/?api=1&destination=' +
      p.lat + ',' + p.lng + '" target="_blank" rel="noopener">' + tr('bike.nav') + '</a>';
  }

  function render() {
    if (!layer) layer = L.layerGroup().addTo(map);
    layer.clearLayers();
    places.forEach(p => {
      if (p.lat == null || p.lng == null) return;
      const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: badgeHtml(p), iconSize: [0, 0] }) });
      m.bindPopup(popupHtml(p));
      layer.addLayer(m);
    });
    updateGoalLine();
  }

  function updateGoalLine() {
    const el = document.getElementById('bikesHint'); if (!el) return;
    const g = state.goal;
    if (!on || !g || !places.length) { el.textContent = ''; return; }
    const pk = PARKS.find(p => p.name === g); if (!pk) { el.textContent = ''; return; }
    let best = null, bd = Infinity;
    places.forEach(p => { if ((p.bikes || 0) > 0) { const d = haversine(pk.lat, pk.lon, p.lat, p.lng); if (d < bd) { bd = d; best = p; } } });
    el.textContent = best ? tr('bike.nearest', { name: g, station: best.name, d: fmtDist(bd), n: best.bikes }) : '';
  }
  window.bikesGoalUpdate = updateGoalLine;

  function loadNow() {
    fetchBikes()
      .then(p => { if (!on) return; places = p; render(); })
      .catch(() => { if (on) toast(tr('bike.cantLoad')); });
  }

  function turnOn() {
    if (typeof map === 'undefined' || !map) { toast(tr('bike.openMap')); return; }
    on = true;
    document.getElementById('bikesToggle').textContent = tr('bikes.hide');
    map.attributionControl.addAttribution('Bikes &copy; nextbike');
    loadNow();
    timer = setInterval(() => { if (!document.hidden) loadNow(); }, POLL_MS);
  }
  function turnOff() {
    on = false;
    document.getElementById('bikesToggle').textContent = tr('bikes.show');
    if (timer) clearInterval(timer); timer = null;
    if (layer && map) { map.removeLayer(layer); layer = null; }
    if (map) map.attributionControl.removeAttribution('Bikes &copy; nextbike');
    places = []; updateGoalLine();
  }

  document.getElementById('bikesToggle').addEventListener('click', () => { on ? turnOff() : turnOn(); });

  // re-render in the new language
  window.bikesRelabel = function () {
    document.getElementById('bikesToggle').textContent = on ? tr('bikes.hide') : tr('bikes.show');
    if (on && places.length) render();
    updateGoalLine();
  };
})();
