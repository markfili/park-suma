// Zagreb Park-Šuma Bingo — game logic.
// Depends on PARKS (from parks.js) and Leaflet's global L (optional).

const FREE = 12;                         // center cell of the 5×5
const STORAGE_KEY = "parkSumaBingo:v2";
const CHECKIN_M = 300;                    // GPS check-in radius (metres)

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
const DISTRICTS = [];                      // [{name, parks:[...]}] in west→east order
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
      seenTiers: Array.isArray(s.seenTiers) ? s.seenTiers : [],
      seenDistricts: Array.isArray(s.seenDistricts) ? s.seenDistricts : [],
    };
  } catch(e){ return { visited:{}, order:null, seenTiers:[], seenDistricts:[] }; }
}
function save(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }

let state = load();

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
      if (isVisited(name)) cell.classList.add('marked');
      cell.addEventListener('click', () => attemptCheckin(name));
    }
    board.appendChild(cell); cells.push(cell);
  }
  bingoSeen = new Set(completeLines().map(l => l.join(',')));  // don't re-celebrate existing lines
  highlightLines();
}

function highlightLines(){
  const winning = completeLines();
  const idx = new Set(winning.flat());
  cells.forEach((c,i) => c.classList.toggle('win', idx.has(i)));
}

function refreshCardCells(){
  cells.forEach((c,i) => { if (i !== FREE) c.classList.toggle('marked', isVisited(cellNames[i])); });
  highlightLines();
}

// ---- check-in (honor + GPS) ----
function attemptCheckin(name){
  if (isVisited(name)) { setVisited(name, false); return; }     // un-checking is always allowed
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

  // level up (1/5/10/15/20), champion (24) handled last as the finale
  TIERS.filter(t => t.n >= 1 && t.n < 24).forEach(t => {
    if (count >= t.n && !state.seenTiers.includes(t.n)) {
      state.seenTiers.push(t.n); save();
      queueBanner(t.emoji, `Level up: ${t.name}!`, `${count} of 24 parks visited.`);
    }
  });
  if (count === 24 && !state.seenTiers.includes(24)) {
    state.seenTiers.push(24); save();
    queueBanner("🏆", "Forest Champion!", "All 24 park-šume of Zagreb visited. Bravo! 🌲");
  }

  flushBanners();
}

// ---- progress / districts UI ----
function refreshProgress(){
  const count = visitedCount(), tier = tierFor(count), next = nextTier(count);
  lvlBadge.textContent = tier.emoji;
  lvlName.textContent = tier.name;
  countEl.textContent = count + " / 24";
  lvlNext.textContent = next ? `Next: ${next.n} → ${next.name}` : "Max level reached! 🏆";
  const pct = next ? (count - tier.n) / (next.n - tier.n) * 100 : 100;
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

function refreshAll(){ refreshCardCells(); refreshMapStyles(); refreshProgress(); refreshDistricts(); refreshNearest(); }

// ---- map view ----
let map = null, markers = {}, userMarker = null, mapReady = false;

function initMap(){
  if (mapReady || typeof L === 'undefined') return;
  map = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

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
  const on = isVisited(name);
  return { radius: 9, weight: 2,
    color: on ? '#eafff3' : '#7fcfa3',
    fillColor: on ? '#2fae6f' : '#3a5d4d',
    fillOpacity: 0.95 };
}

function popupHtml(p){
  const on = isVisited(p.name);
  let dist = '';
  if (gpsActive && userPos) dist = ` · ${fmtDist(haversine(userPos.lat, userPos.lon, p.lat, p.lon))} away`;
  const status = on ? `✅ visited ${state.visited[p.name]}` : 'not visited yet';
  const approx = p.approx ? ' <span class="pop-meta">(approx. location)</span>' : '';
  const btn = `<button class="pop-btn" onclick="attemptCheckin('${p.name.replace(/'/g, "\\'")}')">${on ? 'Un-check' : 'Check in'}</button>`;
  const link = `<a class="pop-link" href="${mapsLink(p.name)}" target="_blank" rel="noopener">Maps ↗</a>`;
  return `<b>${p.name}</b>${approx}<br><span class="pop-meta">${p.district} · ${status}${dist}</span><br>${btn}${link}`;
}

function refreshMapStyles(){
  if (!mapReady) return;
  PARKS.forEach(p => { if (markers[p.name]) markers[p.name].setStyle(markerStyle(p.name)); });
  if (userMarker && userPos) userMarker.setLatLng([userPos.lat, userPos.lon]);
}

// ---- GPS ----
let gpsActive = false, userPos = null, watchId = null;
function setGpsStatus(){
  gpsStatus.textContent = gpsActive
    ? `GPS on — check-ins gated to ≤${CHECKIN_M} m`
    : "GPS off — honor mode";
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
      refreshNearest();
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
  setGpsStatus(); refreshNearest();
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
  if (which === 'map') {
    initMap();
    if (mapReady) setTimeout(() => { map.invalidateSize(); }, 0);  // container just became visible
  }
}

// ---- wire up ----
$('toggle').addEventListener('click', e => { const s = e.target.closest('.seg'); if (s) showView(s.dataset.view); });
$('new').addEventListener('click', () => { buildCard(true); refreshAll(); });
$('locate').addEventListener('click', toggleGps);
$('bClose').addEventListener('click', showNextBanner);
banner.addEventListener('click', e => { if (e.target === banner) showNextBanner(); });

buildCard(false);
setGpsStatus();
refreshAll();
