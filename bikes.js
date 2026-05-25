// Toggleable nextbike station layer for the map. Pure client-side fetch
// (the endpoint sends Access-Control-Allow-Origin: *). Reuses app.js globals:
// map (Leaflet), L, PARKS, isVisited, state, haversine, fmtDist, toast.
(function () {
  const FEED = 'https://maps.nextbike.net/maps/nextbike-live.json?city=1172&domains=hd&list_cities=0&bikes=0';
  const NEAR_M = 300;       // a station this close to an unvisited park is "near"
  const POLL_MS = 60000;    // nextbike updates ~every minute

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
      '<span class="pop-meta">🚲 ' + (p.bikes || 0) + ' bikes · ' + (p.free_racks || 0) + ' free racks</span><br>' +
      '<a class="pop-link" href="https://www.google.com/maps/dir/?api=1&destination=' +
      p.lat + ',' + p.lng + '" target="_blank" rel="noopener">Navigate ↗</a>';
  }

  function render() {
    if (!layer) layer = L.layerGroup().addTo(map);
    layer.clearLayers();
    places.forEach(p => {
      if (p.lat == null || p.lng == null) return;
      const m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: badgeHtml(p), iconSize: [0, 0] })
      });
      m.bindPopup(popupHtml(p));
      layer.addLayer(m);
    });
    updateGoalLine();
  }

  // tie-in: nearest bikes to the current 🎯 goal
  function updateGoalLine() {
    const el = document.getElementById('bikesHint'); if (!el) return;
    const g = state.goal;
    if (!on || !g || !places.length) { el.textContent = ''; return; }
    const pk = PARKS.find(p => p.name === g); if (!pk) { el.textContent = ''; return; }
    let best = null, bd = Infinity;
    places.forEach(p => {
      if ((p.bikes || 0) > 0) { const d = haversine(pk.lat, pk.lon, p.lat, p.lng); if (d < bd) { bd = d; best = p; } }
    });
    el.textContent = best
      ? '🚲 Nearest bikes to ' + g + ': ' + best.name + ' (' + fmtDist(bd) + ', ' + best.bikes + ' bikes)'
      : '';
  }
  window.bikesGoalUpdate = updateGoalLine;   // let app.js refresh this when the goal changes

  function loadNow() {
    fetchBikes()
      .then(p => { if (!on) return; places = p; render(); })
      .catch(() => { if (on) toast('Could not load bike data'); });
  }

  function turnOn() {
    if (typeof map === 'undefined' || !map) { toast('Open the Map first'); return; }
    on = true;
    const btn = document.getElementById('bikesToggle');
    btn.classList.add('on'); btn.textContent = '🚲 Hide bikes';
    map.attributionControl.addAttribution('Bikes &copy; nextbike');
    loadNow();
    timer = setInterval(() => { if (!document.hidden) loadNow(); }, POLL_MS);
  }
  function turnOff() {
    on = false;
    const btn = document.getElementById('bikesToggle');
    btn.classList.remove('on'); btn.textContent = '🚲 Show bikes';
    if (timer) clearInterval(timer); timer = null;
    if (layer && map) { map.removeLayer(layer); layer = null; }
    if (map) map.attributionControl.removeAttribution('Bikes &copy; nextbike');
    places = []; updateGoalLine();
  }

  document.getElementById('bikesToggle').addEventListener('click', () => { on ? turnOff() : turnOn(); });
})();
