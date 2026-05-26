// Zagreb Park-Šuma Bingo — game logic.
// Depends on PARKS (parks.js), tr()/LANG (i18n.js), and Leaflet's L (optional).
// scratch.js / share.js / bikes.js (loaded after) reuse the globals here.

const FREE = 12;                          // center cell of the 5×5
const STORAGE_KEY = "parkSumaBingo:v2";
const SEEN_VERSION_KEY = "parkSumaBingo:seenVersion";
const CHECKIN_M = 300;                     // GPS check-in radius (metres)
const APP_VERSION = "0.12.0";             // single source of truth for the version

// Level ladder — names are i18n keys (tier.<key>); thresholds are counts.
const TIERS = [
  { n: 0,  key: "newcomer", emoji: "🌰" },
  { n: 1,  key: "seedling", emoji: "🌱" },
  { n: 5,  key: "sprout",   emoji: "🌿" },
  { n: 10, key: "sapling",  emoji: "🪴" },
  { n: 15, key: "grove",    emoji: "🌳" },
  { n: 20, key: "forester", emoji: "🧭" },
  { n: 24, key: "champion", emoji: "🏆" },
];
function tierName(t){ return tr('tier.' + t.key); }

// Versions (newest first) for the "What's new" tab; notes live in i18n.
const CHANGELOG_VERSIONS = ["0.12.0","0.11.0","0.10.0","0.9.0","0.8.0","0.7.0","0.6.0","0.5.0","0.4.0","0.3.0","0.2.0","0.1.0"];

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

// Size-weighted ladder: same tiers, thresholds in hectares (bigger parks weigh more).
const AREA_FRACS = [0, 0.03, 0.15, 0.33, 0.55, 0.8, 1];
const AREA_TIERS = TIERS.map((t, i) => ({ n: Math.round(AREA_FRACS[i] * TOTAL_HA), key: t.key, emoji: t.emoji }));

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
  if (!confirm(tr('reset.confirm'))) return;
  state.visited = {}; state.goal = null; state.seenTiers = []; state.seenAreaTiers = []; state.seenDistricts = [];
  save();
  buildCard(false);
  refreshAll();
  toast(tr('toast.reset'));
}
function refreshGoal(){
  const chip = $('goalChip'); if (!chip) return;
  const g = state.goal;
  if (g && !isVisited(g)) {
    let txt = tr('goal.chip', { name: g });
    if (gpsActive && userPos) { const p = BY_NAME[g]; txt += ' (' + fmtDist(haversine(userPos.lat, userPos.lon, p.lat, p.lon)) + ')'; }
    chip.textContent = txt; chip.style.display = '';
  } else { chip.textContent = ''; chip.style.display = 'none'; }
  if (window.bikesGoalUpdate) window.bikesGoalUpdate();
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
      pin.title = tr('title.pin');
      pin.addEventListener('click', e => e.stopPropagation());
      cell.appendChild(pin);
      cell.addEventListener('click', () => { focusParkOnMap(name); attemptCheckin(name); });
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
  if (isVisited(name)) { setVisited(name, false); return; }
  if (gpsActive && userPos) {
    const pk = BY_NAME[name];
    const d = haversine(userPos.lat, userPos.lon, pk.lat, pk.lon);
    if (d > CHECKIN_M) { toast(tr('toast.tooFar', { d: fmtDist(d), name, m: CHECKIN_M })); return; }
    toast(tr('toast.checkedIn', { name }));
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
  if (state.goal && name === state.goal) {
    queueBanner("🎯", tr('cel.destinyTitle'), tr('cel.destinyMsg', { name }));
    state.goal = null; save(); refreshGoal();
  }
  const newLines = completeLines().filter(l => !bingoSeen.has(l.join(',')));
  newLines.forEach(l => bingoSeen.add(l.join(',')));
  if (newLines.length) queueBanner("🎯", tr('banner.bingo'), tr('cel.bingoMsg'));

  const dName = BY_NAME[name].district;
  const dist = DISTRICTS.find(d => d.name === dName);
  if (dist && dist.parks.every(isVisited) && !state.seenDistricts.includes(dName)) {
    state.seenDistricts.push(dName); save();
    queueBanner("🗺️", tr('cel.sweptTitle'), tr('cel.sweptMsg', { d: dName }));
  }

  const ha = Math.round(haExplored());
  TIERS.forEach((t, i) => {
    if (i === 0 || i === TIERS.length - 1) return;
    if (count >= t.n && !state.seenTiers.includes(t.n)) {
      state.seenTiers.push(t.n);
      if (state.mode === 'count') queueBanner(t.emoji, tr('cel.levelTitle', { name: tierName(t) }), tr('cel.levelCount', { n: count }));
    }
  });
  AREA_TIERS.forEach((t, i) => {
    if (i === 0 || i === AREA_TIERS.length - 1) return;
    if (ha >= t.n && !state.seenAreaTiers.includes(t.n)) {
      state.seenAreaTiers.push(t.n);
      if (state.mode === 'area') queueBanner(t.emoji, tr('cel.levelTitle', { name: tierName(t) }), tr('cel.levelArea', { n: ha }));
    }
  });
  save();
  if (count === 24 && !state.seenTiers.includes(24)) {
    state.seenTiers.push(24); save();
    queueBanner("🏆", tr('cel.championTitle'), tr('cel.championMsg'));
  }
  flushBanners();
}

// ---- progress / districts UI ----
function refreshProgress(){
  const count = visitedCount();
  const tiers = ladder(), val = progressValue();
  const tier = tierForVal(val, tiers), next = nextForVal(val, tiers);
  lvlBadge.textContent = tier.emoji;
  lvlName.textContent = tierName(tier);
  countEl.textContent = count + " / 24";
  const hs = $('haStat');
  if (hs) hs.textContent = tr('progress.ha', { a: Math.round(haExplored()), t: Math.round(TOTAL_HA) });
  const unit = state.mode === 'area' ? tr('unit.ha') : '';
  lvlNext.textContent = next ? tr('progress.next', { n: next.n, unit, name: tierName(next) }) : tr('progress.max');
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
  if (!unvisited.length) { nearHint.textContent = tr('near.all'); return; }
  let best = null, bestD = Infinity;
  unvisited.forEach(p => { const d = haversine(userPos.lat, userPos.lon, p.lat, p.lon); if (d < bestD) { bestD = d; best = p; } });
  nearHint.textContent = tr('near.nearest', { name: best.name, d: fmtDist(bestD) });
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
  if (gpsActive && userPos) dist = ' · ' + tr('scratch.away', { d: fmtDist(haversine(userPos.lat, userPos.lon, p.lat, p.lon)) });
  const status = on ? tr('pop.visited', { date: state.visited[p.name] }) : (p.name === state.goal ? tr('pop.goal') : tr('pop.notVisited'));
  const approx = p.approx ? ' <span class="pop-meta">' + tr('pop.approx') + '</span>' : '';
  const size = p.ha ? ' · ' + p.ha + ' ha' : '';
  const btn = `<button class="pop-btn" onclick="attemptCheckin('${p.name.replace(/'/g, "\\'")}')">${on ? tr('pop.unCheck') : tr('pop.checkIn')}</button>`;
  const link = `<a class="pop-link" href="${mapsLink(p.name)}" target="_blank" rel="noopener">${tr('pop.maps')}</a>`;
  return `<b>${p.name}</b>${approx}<br><span class="pop-meta">${p.district}${size} · ${status}${dist}</span><br>${btn}${link}`;
}
// Desktop-only synergy: tapping a card tile pans + opens that park's popup on the map.
// Mobile no-ops because the map is hidden behind the Card/Map toggle there.
const DESKTOP_MQ = window.matchMedia('(min-width: 1024px)');
function focusParkOnMap(name){
  if (!DESKTOP_MQ.matches) return;
  if (!map || !mapReady) return;
  const p = BY_NAME[name]; if (!p) return;
  map.flyTo([p.lat, p.lon], 14, { duration: 0.6 });
  const m = markers[name];
  if (m) m.bindPopup(popupHtml(p)).openPopup();
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
function setGpsStatus(){ gpsStatus.textContent = gpsActive ? tr('gps.on', { m: CHECKIN_M }) : tr('gps.off'); }
function toggleGps(){
  if (gpsActive) { stopGps(); return; }
  if (!navigator.geolocation) { toast(tr('toast.noGeo')); return; }
  toast(tr('toast.locating'));
  watchId = navigator.geolocation.watchPosition(
    pos => {
      gpsActive = true; userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      $('locate').classList.add('on'); $('locate').textContent = tr('btn.gpsOn');
      setGpsStatus();
      if (mapReady) {
        if (!userMarker) userMarker = L.circleMarker([userPos.lat, userPos.lon],
          { radius: 7, weight: 2, color: '#fff', fillColor: '#4aa3ff', fillOpacity: 1 }).addTo(map);
        else userMarker.setLatLng([userPos.lat, userPos.lon]);
      }
      refreshNearest(); refreshGoal();
    },
    err => { toast(tr('toast.locFail')); stopGps(); },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
  );
}
function stopGps(){
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null; gpsActive = false; userPos = null;
  $('locate').classList.remove('on'); $('locate').textContent = tr('btn.locate');
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
let helpTab = 'howto';
function renderHelp(tab){
  helpTab = tab;
  document.querySelectorAll('.help-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const body = $('helpBody');
  if (tab === 'news') {
    const cl = tr('changelog');
    body.innerHTML = CHANGELOG_VERSIONS.map((v, i) =>
      `<div class="cl${i === 0 ? ' cur' : ''}"><h4>v${v}${i === 0 ? ' · ' + tr('help.current') : ''}</h4><ul>` +
      ((cl[v] || []).map(n => `<li>${n}</li>`).join('')) + `</ul></div>`).join('');
  } else {
    body.innerHTML = tr('howto', { m: CHECKIN_M });
  }
}
function openHelp(tab){ renderHelp(tab || 'howto'); $('help').classList.add('show'); }
function closeHelp(){ $('help').classList.remove('show'); }
function maybeShowWhatsNew(){
  let seen = null;
  try { seen = localStorage.getItem(SEEN_VERSION_KEY); } catch(e){}
  if (seen !== APP_VERSION) {
    openHelp(seen ? 'news' : 'howto');
    try { localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION); } catch(e){}
  }
}

// ---- language change hook (called by i18n.setLang) ----
window.onLangChange = function(){
  setGpsStatus();
  $('locate').textContent = gpsActive ? tr('btn.gpsOn') : tr('btn.locate');
  refreshAll();
  if ($('help').classList.contains('show')) renderHelp(helpTab);
  if (window.bikesRelabel) window.bikesRelabel();
  if (window.scratchRelabel) window.scratchRelabel();
  if (window.shareRelabel) window.shareRelabel();
};

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

// Desktop shows both Card + Map at once, so the map can't lazy-init on toggle.
// Eager-init at boot if we start in desktop, and again whenever the breakpoint
// is crossed (e.g. window resized from narrow to wide).
function ensureMapForDesktop(){
  if (!DESKTOP_MQ.matches) return;
  initMap();
  if (mapReady) setTimeout(() => map.invalidateSize(), 0);
}
ensureMapForDesktop();
DESKTOP_MQ.addEventListener('change', ensureMapForDesktop);

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
