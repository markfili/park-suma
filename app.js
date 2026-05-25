// Zagreb Park-Šuma Bingo — game logic.
// Depends on PARKS (parks.js, loaded first) and Leaflet's global L (optional).
// scratch.js (loaded after) reuses the globals exposed here.

const FREE = 12;                          // center cell of the 5×5
const STORAGE_KEY = "parkSumaBingo:v2";
const SEEN_VERSION_KEY = "parkSumaBingo:seenVersion";
const CHECKIN_M = 300;                     // GPS check-in radius (metres)
const APP_VERSION = "0.10.0";              // single source of truth for the version

// Level ladder — the headline progression (visit count -> tier).
const TIERS = [
  { n: 0,  name: "Newcomer",        emoji: "🌰" },
  { n: 1,  name: "Seedling",        emoji: "🌱" },
  { n: 5,  name: "Sprout",          emoji: "🌿" },
  { n: 10, name: "Sapling",         emoji: "🪴" },
  { n: 15, name: "Grove",           emoji: "🌳" },
  { n: 20, name: "Forester",        emoji: "🧭" },
  { n: 24, name: "Forest Champion", emoji: "🏆" },
];

// Changelog (newest first) — drives the "What's new" tab and update detection.
const CHANGELOG = [
  { v: "0.10.0", notes: [
    "🗺️ Park boundary polygons on the map (from OpenStreetMap) + each park’s size in hectares.",
    "🌳 Hectares-explored stat, and a “By size” progression mode where bigger parks weigh more toward your level.",
  ]},
  { v: "0.9.0", notes: [
    "🚲 Toggleable nextbike layer on the map — live station badges with bike counts.",
    "Stations near unvisited parks are highlighted, and the nearest bikes to your goal are shown.",
  ]},
  { v: "0.8.0", notes: [
    "👤 Pick a username (saved on your device).",
    "📤 Share your stats — as a link (progress packed into the URL) or a generated image card.",
  ]},
  { v: "0.7.0", notes: [
    "♻️ Reset progress button — wipe visited parks, goal, and milestones for a clean slate.",
  ]},
  { v: "0.6.0", notes: [
    "🎟 “Where to next?” scratch card — scratch to reveal a random unvisited park and set it as your 🎯 goal.",
    "ℹ️ This help dialog: How to play + What’s new (pops up automatically after an update).",
  ]},
  { v: "0.5.0", notes: ["Live commit SHA shown next to the version in the footer."] },
  { v: "0.4.0", notes: [
    "🗺 Map view (Leaflet / OpenStreetMap) with a Card ⇄ Map toggle.",
    "📍 GPS check-in — mark a park only when you’re within 300 m (honor-mode fallback).",
    "Progression: levels by count, a Bingo-line bonus, and district sweeps.",
  ]},
  { v: "0.3.0", notes: ["Progress now saved in your browser (localStorage)."] },
  { v: "0.2.0", notes: ["Split into static files and deployed on GitHub Pages."] },
  { v: "0.1.0", notes: ["First version: a 5×5 bingo of Zagreb’s 24 forest parks."] },
];

const HOWTO = `
  <p><strong>Goal:</strong> visit all 24 protected <em>park-šume</em> (forest parks) of Zagreb.</p>
  <ul>
    <li><strong>Mark a park</strong> by tapping its tile or its map pin. In honor mode you can mark anytime; tap
        <strong>📍 Locate me</strong> to require a real GPS check-in (within ${CHECKIN_M} m).</li>
    <li><strong>Level up</strong> as your count grows (🌰 → 🏆). Line up 5 in a row for a <strong>Bingo</strong> bonus,
        and finish every park in a district for a <strong>sweep</strong>.</li>
    <li><strong>🎟 Where next?</strong> scratches a random unvisited park — Accept it to set a 🎯 goal that shows on
        the map and card.</li>
    <li><strong>🔀 Nova kartica</strong> reshuffles the board. Progress saves automatically.</li>
  </ul>`;

// ---- DOM ----
const $ = id => document.getElementById(id);
const board = $('board'), countEl = $('count');
const lvlBadge = $('lvlBadge'), lvlName = $('lvlName'), lvlNext = $('lvlNext'), trackFill = $('trackFill');
const nearHint = $('nearHint'), districtsEl = $('districts'), gpsStatus = $('gpsStatus');
const banner = $('banner'), bEmoji = $('bEmoji'), bTitle = $('bTitle'), bMsg = $('bMsg');
const toastEl = $('toast');

// ---- derived data ----
const NAMES = PARKS.map(p => p.name);
const BY_NAME = Object.fromEntries(PARKS.map(p => [p.name, p]));
const DISTRICTS = [];                       // [{name, parks:[...]}] west→east
PARKS.forEach(p => {
  let d = DISTRICTS.find(x => x.name === p.district);
  if (!d) { d = { name: p.district, parks: [] }; DISTRICTS.push(d); }
  d.parks.push(p.name);
});

const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0,1,2,3,4].map(c => r*5+c));
  for (let c = 0; c < 5; c++) L.push([0,1,2,3,4].map(r => r*5+c));
  L.push([0,6,12,18,24]); L.push([4,8,12,16,20]);
  return L;
})();

// ---- helpers ----
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];} return a; }
function mapsLink(name){ return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Park-šuma " + name + " Zagreb"); }
function isVisited(name){ return !!state.visited[name]; }
function visitedCount(){ return NAMES.filter(isVisited).length; }
function tierFor(c){ let t = TIERS[0]; for (const x of TIERS) if (c >= x.n) t = x; return t; }
function nextTier(c){ return TIERS.find(x => x.n > c) || null; }
function fmtDist(m){ return m < 1000 ? Math.round(m) + " m" : (m/1000).toFixed(1) + " km"; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function haversine(aLat, aLon, bLat, bLon){
  const R = 6371000, toR = d => d*Math.PI/180;
  const dLat = toR(bLat-aLat), dLon = toR(bLon-aLon);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(aLat))*Math.cos(toR(bLat))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}

// ---- area (hectares) ----
const TOTAL_HA = PARKS.reduce((s, p) => s + (p.ha || 0), 0);
function haOf(name){ return BY_NAME[name].ha || 0; }
function haExplored(){ return NAMES.reduce((s, n) => s + (isVisited(n) ? haOf(n) : 0), 0); }

// Size-weighted level ladder: same tier names, thresholds in hectares.
// Bigger parks push you up faster — that's the "weight" on earned badges.
const AREA_FRACS = [0, 0.03, 0.15, 0.33, 0.55, 0.8, 1];
const AREA_TIERS = TIERS.map((t, i) => ({ n: Math.round(AREA_FRACS[i] * TOTAL_HA), name: t.name, emoji: t.emoji }));

function ladder(){ return state.mode === 'area' ? AREA_TIERS : TIERS; }
function progressValue(){ return state.mode === 'area' ? Math.round(haExplored()) : visitedCount(); }
function tierForVal(v, tiers){ let t = tiers[0]; for (const x of tiers) if (v >= x.n) t = x; return t; }
function nextForVal(v, tiers){ return tiers.find(x => x.n > v) || null; }

// ---- persistence (v2) ----
function load(){
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    const set = new Set(NAMES);
    const visited = {};
    if (s.visited && typeof s.visited === 'object')
      for (const k in s.visited) if (set.has(k)) visited[k] = s.visited[k];
    let order = null;
    if (Array.isArray(s.order) && s.order.length === NAMES.length) {
      const os = new Set(s.order);
      if (os.size === NAMES.length && NAMES.every(n => os.has(n))) order = s.order;
    }
    return {
      visited, order,
      name: (typeof s.name === 'string') ? s.name : '',
      mode: (s.mode === 'area') ? 'area' : 'count',
      goal: (typeof s.goal === 'string' && set.has(s.goal)) ? s.goal : null,
      seenTiers: Array.isArray(s.seenTiers) ? s.seenTiers : [],
      seenAreaTiers: Array.isArray(s.seenAreaTiers) ? s.seenAreaTiers : [],
      seenDistricts: Array.isArray(s.seenDistricts) ? s.seenDistricts : [],
    };
  } catch(e){ return { visited:{}, order:null, name:'', mode:'count', goal:null, seenTiers:[], seenAreaTiers:[], seenDistricts:[] }; }
}
function save(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }

let state = load();

// ---- goal (scratch card destination) ----
function getGoal(){ return state.goal || null; }
function setGoal(name){ state.goal = name; save(); refreshAll(); }
function clearGoal(){ state.goal = null; save(); refreshAll(); }
function pickNext(){ const pool = PARKS.filter(p => !isVisited(p.name)); return pool.length ? pool[Math.random()*pool.length|0] : null; }
function completesDistrict(name){
  const d = DISTRICTS.find(x => x.parks.includes(name));
  return !!(d && !isVisited(name) && d.parks.filter(isVisited).length === d.parks.length - 1);
}
function resetProgress(){
  if (!confirm('Reset all progress?\n\nThis clears every visited park, your goal, and earned milestones. It cannot be undone.')) return;
  state.visited = {}; state.goal = null; state.seenTiers = []; state.seenDistricts = [];
  save();
  buildCard(false);   // keep the card layout, just clear the marks
  refreshAll();
  toast('Progress reset 🌱');
}
function refreshGoal(){
  const chip = $('goalChip'); if (!chip) return;
  const g = state.goal;
  if (g && !isVisited(g)) {
    let txt = '🎯 Goal: ' + g;
    if (gpsActive && userPos) { const p = BY_NAME[g]; txt += ' (' + fmtDist(haversine(userPos.lat, userPos.lon, p.lat, p.lon)) + ')'; }
    chip.textContent = txt; chip.style.display = '';
  } else { chip.textContent = ''; chip.style.display = 'none'; }
  if (window.bikesGoalUpdate) window.bikesGoalUpdate();   // keep the bikes tie-in in sync
}

// ---- board (card view) ----
let cells = [], cellNames = [], bingoSeen = new Set();

function isCellMarked(i){ return i === FREE || isVisited(cellNames[i]); }
function completeLines(){ return LINES.filter(line => line.every(isCellMarked)); }

function buildCard(fresh){
  if (fresh || !state.order) { state.order = shuffle(NAMES); save(); }
  const order = state.order;
  board.innerHTML = ''; cells = []; cellNames = [];
  let p = 0;
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (i === FREE) {
      cell.classList.add('free','marked'); cell.textContent = '🟢'; cellNames.push(null);
    } else {
      const name = order[p++]; cellNames.push(name);
      cell.dataset.name = name; cell.textContent = name;
      const pin = document.createElement('a');
      pin.className = 'pin'; pin.textContent = '📍';
      pin.href = mapsLink(name); pin.target = '_blank'; pin.rel = 'noopener';
      pin.title = 'Open in Google Maps';
      pin.addEventListener('click', e => e.stopPropagation());
      cell.appendChild(pin);
      cell.addEventListener('click', () => attemptCheckin(name));
    }
    board.appendChild(cell); cells.push(cell);
  }
  bingoSeen = new Set(completeLines().map(l => l.join(',')));
  refreshCardCells();
}

function highlightLines(){
  const idx = new Set(completeLines().flat());
  cells.forEach((c,i) => c.classList.toggle('win', idx.has(i)));
}
function refreshCardCells(){
  cells.forEach((c,i) => {
    if (i === FREE) return;
    const n = cellNames[i];
    c.classList.toggle('marked', isVisited(n));
    c.classList.toggle('goal', !isVisited(n) && n === state.goal);
  });
  highlightLines();
}

// ---- check-in (honor + GPS) ----
function attemptCheckin(name){
  if (isVisited(name)) { setVisited(name, false); return; }     // un-checking always allowed
  if (gpsActive && userPos) {
    const pk = BY_NAME[name];
    const d = haversine(userPos.lat, userPos.lon, pk.lat, pk.lon);
    if (d > CHECKIN_M) { toast(`You're ${fmtDist(d)} from ${name} — get within ${CHECKIN_M} m to check in`); return; }
    toast(`Checked in at ${name}! ✅`);
  }
  setVisited(name, true);
}
function setVisited(name, on){
  if (on) state.visited[name] = todayISO(); else delete state.visited[name];
  save();
  refreshAll();
  if (on) celebrate(name);
}

// ---- celebrations (queued banners) ----
let bannerQueue = [], bannerOpen = false;
function queueBanner(emoji, title, msg){ bannerQueue.push({emoji,title,msg}); }
function showNextBanner(){
  const b = bannerQueue.shift();
  if (!b) { banner.classList.remove('show'); bannerOpen = false; return; }
  bEmoji.textContent = b.emoji; bTitle.textContent = b.title; bMsg.textContent = b.msg;
  banner.classList.add('show'); bannerOpen = true;
}
function flushBanners(){ if (!bannerOpen) showNextBanner(); }

function celebrate(name){
  const count = visitedCount();

  // reaching your scratch-card goal
  if (state.goal && name === state.goal) {
    queueBanner("🎯", "Destiny reached!", `You made it to your goal: ${name}!`);
    state.goal = null; save(); refreshGoal();
  }
  // bonus: new bingo line(s)
  const newLines = completeLines().filter(l => !bingoSeen.has(l.join(',')));
  newLines.forEach(l => bingoSeen.add(l.join(',')));
  if (newLines.length) queueBanner("🎯", "BINGO!", "You linked up 5 forest parks in a line — bonus!");
  // district sweep
  const dName = BY_NAME[name].district;
  const dist = DISTRICTS.find(d => d.name === dName);
  if (dist && dist.parks.every(isVisited) && !state.seenDistricts.includes(dName)) {
    state.seenDistricts.push(dName); save();
    queueBanner("🗺️", "District swept!", `You've visited every park-šuma in ${dName}.`);
  }
  // level up — award BOTH ladders (count + size); banner only for the active mode
  const ha = Math.round(haExplored());
  TIERS.forEach((t, i) => {
    if (i === 0 || i === TIERS.length - 1) return;          // skip Newcomer + Champion
    if (count >= t.n && !state.seenTiers.includes(t.n)) {
      state.seenTiers.push(t.n);
      if (state.mode === 'count') queueBanner(t.emoji, `Level up: ${t.name}!`, `${count} of 24 parks visited.`);
    }
  });
  AREA_TIERS.forEach((t, i) => {
    if (i === 0 || i === AREA_TIERS.length - 1) return;
    if (ha >= t.n && !state.seenAreaTiers.includes(t.n)) {
      state.seenAreaTiers.push(t.n);
      if (state.mode === 'area') queueBanner(t.emoji, `Level up: ${t.name}!`, `${ha} ha explored.`);
    }
  });
  save();
  if (count === 24 && !state.seenTiers.includes(24)) {
    state.seenTiers.push(24); save();
    queueBanner("🏆", "Forest Champion!", "All 24 park-šume of Zagreb visited. Bravo! 🌲");
  }
  flushBanners();
}

// ---- progress / districts UI ----
function refreshProgress(){
  const count = visitedCount();
  const tiers = ladder(), val = progressValue();
  const tier = tierForVal(val, tiers), next = nextForVal(val, tiers);
  lvlBadge.textContent = tier.emoji;
  lvlName.textContent = tier.name;
  countEl.textContent = count + " / 24";
  const hs = $('haStat');
  if (hs) hs.textContent = Math.round(haExplored()) + " / " + Math.round(TOTAL_HA) + " ha explored";
  const unit = state.mode === 'area' ? ' ha' : '';
  lvlNext.textContent = next ? `Next: ${next.n}${unit} → ${next.name}` : "Max level reached! 🏆";
  const pct = next ? (val - tier.n) / (next.n - tier.n) * 100 : 100;
  trackFill.style.width = Math.max(0, Math.min(100, pct)) + "%";
}
function refreshDistricts(){
  districtsEl.innerHTML = '';
  DISTRICTS.forEach(d => {
    const v = d.parks.filter(isVisited).length, t = d.parks.length;
    const chip = document.createElement('span');
    chip.className = 'chip' + (v === t ? ' done' : '');
    chip.textContent = `${d.name} ${v}/${t}`;
    districtsEl.appendChild(chip);
  });
}
function refreshNearest(){
  if (!gpsActive || !userPos) { nearHint.textContent = ''; return; }
  const unvisited = PARKS.filter(p => !isVisited(p.name));
  if (!unvisited.length) { nearHint.textContent = "Every park visited — you're a Forest Champion! 🏆"; return; }
  let best = null, bestD = Infinity;
  unvisited.forEach(p => { const d = haversine(userPos.lat, userPos.lon, p.lat, p.lon); if (d < bestD) { bestD = d; best = p; } });
  nearHint.textContent = `📍 Nearest unvisited: ${best.name} (${fmtDist(bestD)})`;
}
function refreshAll(){ refreshCardCells(); refreshMapStyles(); refreshProgress(); refreshDistricts(); refreshNearest(); refreshGoal(); }

// ---- map view ----
let map = null, markers = {}, userMarker = null, mapReady = false, parkPolys = null;
function initMap(){
  if (mapReady || typeof L === 'undefined') return;
  map = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  // park boundary polygons (own pane, below the pins; non-interactive so pins keep clicks)
  map.createPane('parks'); map.getPane('parks').style.zIndex = 350;
  fetch('parks.geojson?v=' + (window.__V || ''))
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(geo => { parkPolys = L.geoJSON(geo, { pane: 'parks', interactive: false, style: f => polyStyle(f.properties.name) }).addTo(map); })
    .catch(() => {});
  const pts = [];
  PARKS.forEach(p => {
    const m = L.circleMarker([p.lat, p.lon], markerStyle(p.name)).addTo(map);
    m.on('click', () => m.bindPopup(popupHtml(p)).openPopup());
    markers[p.name] = m; pts.push([p.lat, p.lon]);
  });
  map.fitBounds(L.latLngBounds(pts).pad(0.12));
  if (gpsActive && userPos) {
    userMarker = L.circleMarker([userPos.lat, userPos.lon],
      { radius: 7, weight: 2, color: '#fff', fillColor: '#4aa3ff', fillOpacity: 1 }).addTo(map);
  }
  mapReady = true;
}
function markerStyle(name){
  const on = isVisited(name), goal = !on && name === state.goal;
  return { radius: goal ? 11 : 9, weight: goal ? 3 : 2,
    color: goal ? '#ffd56b' : (on ? '#eafff3' : '#7fcfa3'),
    fillColor: on ? '#2fae6f' : (goal ? '#caa23a' : '#3a5d4d'),
    fillOpacity: 0.95 };
}
function polyStyle(name){
  const on = isVisited(name), goal = !on && name === state.goal;
  return { weight: goal ? 3 : 1.5, color: goal ? '#ffd56b' : (on ? '#2fae6f' : '#5a8f78'),
    fillColor: on ? '#2fae6f' : '#3a5d4d', fillOpacity: on ? 0.45 : 0.18 };
}
function popupHtml(p){
  const on = isVisited(p.name);
  let dist = '';
  if (gpsActive && userPos) dist = ` · ${fmtDist(haversine(userPos.lat, userPos.lon, p.lat, p.lon))} away`;
  const status = on ? `✅ visited ${state.visited[p.name]}` : (p.name === state.goal ? '🎯 your goal' : 'not visited yet');
  const approx = p.approx ? ' <span class="pop-meta">(approx. location)</span>' : '';
  const size = p.ha ? ' · ' + p.ha + ' ha' : '';
  const btn = `<button class="pop-btn" onclick="attemptCheckin('${p.name.replace(/'/g, "\\'")}')">${on ? 'Un-check' : 'Check in'}</button>`;
  const link = `<a class="pop-link" href="${mapsLink(p.name)}" target="_blank" rel="noopener">Maps ↗</a>`;
  return `<b>${p.name}</b>${approx}<br><span class="pop-meta">${p.district}${size} · ${status}${dist}</span><br>${btn}${link}`;
}
function refreshMapStyles(){
  if (!mapReady) return;
  PARKS.forEach(p => { if (markers[p.name]) markers[p.name].setStyle(markerStyle(p.name)); });
  if (parkPolys) parkPolys.eachLayer(l => {
    const nm = l.feature && l.feature.properties && l.feature.properties.name;
    if (nm) l.setStyle(polyStyle(nm));
  });
  if (userMarker && userPos) userMarker.setLatLng([userPos.lat, userPos.lon]);
}

// ---- GPS ----
let gpsActive = false, userPos = null, watchId = null;
function setGpsStatus(){
  gpsStatus.textContent = gpsActive ? `GPS on — check-ins gated to ≤${CHECKIN_M} m` : "GPS off — honor mode";
}
function toggleGps(){
  if (gpsActive) { stopGps(); return; }
  if (!navigator.geolocation) { toast("Geolocation not supported — staying in honor mode"); return; }
  toast("Locating…");
  watchId = navigator.geolocation.watchPosition(
    pos => {
      gpsActive = true; userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      $('locate').classList.add('on'); $('locate').textContent = '📍 GPS on';
      setGpsStatus();
      if (mapReady) {
        if (!userMarker) userMarker = L.circleMarker([userPos.lat, userPos.lon],
          { radius: 7, weight: 2, color: '#fff', fillColor: '#4aa3ff', fillOpacity: 1 }).addTo(map);
        else userMarker.setLatLng([userPos.lat, userPos.lon]);
      }
      refreshNearest(); refreshGoal();
    },
    err => { toast("Couldn't get location — honor mode (tap to mark)"); stopGps(); },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
  );
}
function stopGps(){
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null; gpsActive = false; userPos = null;
  $('locate').classList.remove('on'); $('locate').textContent = '📍 Locate me';
  if (userMarker && map) { map.removeLayer(userMarker); userMarker = null; }
  setGpsStatus(); refreshNearest(); refreshGoal();
}

// ---- toast ----
let toastT = null;
function toast(msg){
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

// ---- view toggle ----
function showView(which){
  document.querySelectorAll('.seg').forEach(s => s.classList.toggle('active', s.dataset.view === which));
  $('cardView').classList.toggle('active', which === 'card');
  $('mapView').classList.toggle('active', which === 'map');
  if (which === 'map') { initMap(); if (mapReady) setTimeout(() => map.invalidateSize(), 0); }
}

// ---- help / changelog modal ----
function renderHelp(tab){
  document.querySelectorAll('.help-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const body = $('helpBody');
  if (tab === 'news') {
    body.innerHTML = CHANGELOG.map((c, i) =>
      `<div class="cl${i === 0 ? ' cur' : ''}"><h4>v${c.v}${i === 0 ? ' · current' : ''}</h4><ul>` +
      c.notes.map(n => `<li>${n}</li>`).join('') + `</ul></div>`).join('');
  } else {
    body.innerHTML = HOWTO;
  }
}
function openHelp(tab){ renderHelp(tab || 'howto'); $('help').classList.add('show'); }
function closeHelp(){ $('help').classList.remove('show'); }
function maybeShowWhatsNew(){
  let seen = null;
  try { seen = localStorage.getItem(SEEN_VERSION_KEY); } catch(e){}
  if (seen !== APP_VERSION) {
    openHelp(seen ? 'news' : 'howto');     // first-timers: How to play; returning after update: What's new
    try { localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION); } catch(e){}
  }
}

// ---- wire up ----
$('toggle').addEventListener('click', e => { const s = e.target.closest('.seg'); if (s) showView(s.dataset.view); });
$('new').addEventListener('click', () => { buildCard(true); refreshAll(); });
$('locate').addEventListener('click', toggleGps);
$('reset').addEventListener('click', resetProgress);
$('modeToggle').addEventListener('click', e => {
  const b = e.target.closest('.modeseg'); if (!b) return;
  state.mode = b.dataset.mode; save();
  document.querySelectorAll('.modeseg').forEach(s => s.classList.toggle('active', s.dataset.mode === state.mode));
  refreshProgress();
});
$('bClose').addEventListener('click', showNextBanner);
banner.addEventListener('click', e => { if (e.target === banner) showNextBanner(); });
$('infoBtn').addEventListener('click', () => openHelp('howto'));
$('helpX').addEventListener('click', closeHelp);
$('help').addEventListener('click', e => { if (e.target === $('help')) closeHelp(); });
$('helpTabs').addEventListener('click', e => { const t = e.target.closest('.help-tab'); if (t) renderHelp(t.dataset.tab); });

// ---- init ----
buildCard(false);
setGpsStatus();
refreshAll();
document.querySelectorAll('.modeseg').forEach(s => s.classList.toggle('active', s.dataset.mode === state.mode));
$('appVer').textContent = 'v' + APP_VERSION;
maybeShowWhatsNew();

// Footer build id: live commit SHA from GitHub (reflects the deployed main).
(function showSha(){
  const el = $('sha'); if (!el) return;
  fetch('https://api.github.com/repos/markfili/park-suma/commits/main')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(d => {
      if (!d || !d.sha) return;
      el.innerHTML = '· <a href="https://github.com/markfili/park-suma/commit/' +
        d.sha + '" target="_blank" rel="noopener">' + d.sha.slice(0, 7) + '</a>';
    })
    .catch(() => {});
})();
