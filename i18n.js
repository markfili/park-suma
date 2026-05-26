// Tiny i18n layer. Croatian default, persisted. Global: tr(), LANG, setLang(),
// applyStaticI18n(). Loaded before app.js so tr() is available everywhere.
const LANG_KEY = "parkSumaBingo:lang";

const STRINGS = {
  hr: {
    "toggle.card": "🎲 Kartica", "toggle.map": "🗺 Karta",
    "btn.newCard": "🔀 Nova kartica", "btn.whereNext": "🎟 Kamo dalje?",
    "btn.locate": "📍 Lociraj me", "btn.gpsOn": "📍 GPS uključen", "btn.reset": "♻️ Poništi",
    "mode.count": "Po broju", "mode.size": "Po veličini",
    "legend": "🟢 posjećeno · ⚪ još ne · 🟡 cilj · 🔵 ti · dodirni oznaku za prijavu",
    "bikes.show": "🚲 Prikaži bicikle", "bikes.hide": "🚲 Sakrij bicikle",
    "footer.tagline": "24 zaštićene park-šume grada Zagreba",
    "banner.bingo": "BINGO!", "banner.close": "Super!",
    "help.howto": "Kako igrati", "help.news": "Novosti", "help.current": "trenutno",
    "scratch.title": "🎟 Kamo dalje?",
    "scratch.hintStart": "Grebi foliju da otkriješ sljedeći park…",
    "scratch.hintReveal": "Prihvati za 🎯 cilj ili ponovi.",
    "scratch.here": "🎟  GREBI OVDJE",
    "scratch.reroll": "🔄 Ponovi", "scratch.reveal": "Otkrij",
    "scratch.accept": "🎯 Prihvati", "scratch.nav": "Navigacija ↗", "scratch.share": "📤 Podijeli",
    "scratch.allTitle": "🏆 Svi parkovi posjećeni!", "scratch.allMeta": "Ti si Prvak šuma.",
    "scratch.completes": "✅ dovršava {d}!", "scratch.away": "{d} udaljeno",
    "scratch.shareText": "🎯 {name} ide u {park} ({district}) — sljedeća park-šuma ✨",
    "scratch.imgTitle": "Sljedeća park-šuma", "scratch.imgFor": "destinacija za {name}",
    "share.title": "📤 Podijeli statistiku", "share.namePh": "tvoje ime",
    "share.copy": "🔗 Kopiraj link", "share.share": "📤 Podijeli", "share.saveImg": "🖼 Spremi sliku",
    "share.playOwn": "🌲 Igraj svoju", "share.aForester": "Šumar",
    "share.svTitle": "👤 statistika — {name}",
    "share.statsLine": "{count} / 24 · {emoji} {tier} · {swept} četvrti · {ha} ha",
    "share.imgSub": "{name} · {emoji} {tier}",
    "share.imgSwept": "{swept} četvrti · {ha} ha istraženo",
    "share.copied": "🔗 Link kopiran", "share.imgSaved": "🖼 Slika spremljena",
    "share.copyPrompt": "Kopiraj link statistike:",
    "share.nativeText": "Moj Zagreb Park-Šuma Bingo: {n}/24 parkova posjećeno",
    "title.share": "Podijeli statistiku", "title.help": "Pomoć i novosti", "title.pin": "Otvori u Google Mapama",
    "tier.newcomer": "Žir", "tier.seedling": "Klica", "tier.sprout": "Mladica",
    "tier.sapling": "Sadnica", "tier.grove": "Gaj", "tier.forester": "Šumar", "tier.champion": "Prvak šuma",
    "progress.next": "Sljedeće: {n}{unit} → {name}", "progress.max": "Najviša razina! 🏆",
    "progress.ha": "{a} / {t} ha istraženo", "unit.ha": " ha",
    "near.nearest": "📍 Najbliži neposjećen: {name} ({d})",
    "near.all": "Svi parkovi posjećeni — ti si Prvak šuma! 🏆",
    "goal.chip": "🎯 Cilj: {name}",
    "gps.off": "GPS isključen — na povjerenje", "gps.on": "GPS uključen — prijava ≤{m} m",
    "toast.checkedIn": "Prijavljen u {name}! ✅",
    "toast.tooFar": "{d} od {name} — priđi na ≤{m} m za prijavu",
    "toast.locating": "Lociram…",
    "toast.locFail": "Lokacija nedostupna — na povjerenje (dodirni za oznaku)",
    "toast.noGeo": "Geolokacija nije podržana — ostajem na povjerenje",
    "toast.reset": "Napredak poništen 🌱", "toast.goalSet": "🎯 Cilj postavljen: {name}",
    "reset.confirm": "Poništiti sav napredak?\n\nObrisat će se svi posjećeni parkovi, cilj i osvojene razine. Nije moguće poništiti.",
    "cel.destinyTitle": "Cilj dosegnut!", "cel.destinyMsg": "Stigao si do svog cilja: {name}!",
    "cel.bingoMsg": "Povezao si 5 park-šuma u nizu — bonus!",
    "cel.sweptTitle": "Četvrt osvojena!", "cel.sweptMsg": "Posjetio si sve park-šume u četvrti {d}.",
    "cel.levelTitle": "Nova razina: {name}!",
    "cel.levelCount": "{n} od 24 parka posjećeno.", "cel.levelArea": "{n} ha istraženo.",
    "cel.championTitle": "Prvak šuma!", "cel.championMsg": "Svih 24 park-šuma Zagreba posjećeno. Bravo! 🌲",
    "pop.visited": "✅ posjećeno {date}", "pop.goal": "🎯 tvoj cilj", "pop.notVisited": "još neposjećeno",
    "pop.approx": "(približna lokacija)", "pop.checkIn": "Prijavi se", "pop.unCheck": "Poništi", "pop.maps": "Karte ↗",
    "bike.popup": "🚲 {n} bicikala · {f} slobodnih mjesta", "bike.nav": "Navigacija ↗",
    "bike.nearest": "🚲 Najbliži bicikli do {name}: {station} ({d}, {n} bicikala)",
    "bike.cantLoad": "🚲 Ne mogu učitati podatke o biciklima: {reason}", "bike.openMap": "Prvo otvori Kartu",
    "bike.errOffline": "izgledaš offline", "bike.errNetwork": "mrežna greška (feed nedostupan)",
    "bike.errTimeout": "isteklo nakon {s} s", "bike.errHttp": "server je vratio HTTP {status}",
    "bike.errBadData": "feed je vratio neispravne podatke", "bike.errNoCity": "feed nema podatke za Zagreb",
    "bike.errUnknown": "{detail}",
    "howto": `
      <p><strong>Cilj:</strong> posjeti svih 24 zaštićene <em>park-šume</em> grada Zagreba.</p>
      <ul>
        <li><strong>Označi park</strong> dodirom na pločicu ili oznaku na karti. Na povjerenje možeš označiti bilo kad; dodirni <strong>📍 Lociraj me</strong> za stvarnu GPS prijavu (unutar {m} m).</li>
        <li><strong>Napreduj kroz razine</strong> kako broj raste (🌰 → 🏆). Poveži 5 u nizu za <strong>Bingo</strong> bonus i posjeti sve parkove u četvrti za <strong>osvajanje četvrti</strong>.</li>
        <li><strong>🎟 Kamo dalje?</strong> grebe nasumičan neposjećen park — Prihvati ga za 🎯 cilj koji se prikazuje na karti i kartici.</li>
        <li><strong>🔀 Nova kartica</strong> premiješava ploču. Napredak se sprema automatski.</li>
      </ul>`,
    "changelog": {
      "0.12.0": ["📤 Podijeli rezultat „Kamo dalje?” — gumb na otkrivenoj karti šalje sliku i tekst kroz nativni izbornik dijeljenja.", "🚲 Jasnija greška kada se bicikli ne učitaju — razlog (offline, mreža, isteklo vrijeme, HTTP status, neispravni podaci, nema Zagreba u feedu) prikazan ispod prekidača.", "🖥️ Raspored za stolne uređaje — Kartica i Karta jedna pored druge na širim ekranima (≥1024 px), dodir polja centrira park na karti."],
      "0.11.0": ["🌐 Prebacivanje jezika — hrvatski / engleski (zadano hrvatski)."],
      "0.10.0": ["🗺️ Granice park-šuma na karti (iz OpenStreetMapa) + veličina svakog parka u hektarima.", "🌳 Statistika istraženih hektara i način napredovanja „Po veličini” gdje veći parkovi više vrijede."],
      "0.9.0": ["🚲 Uključivi sloj nextbike na karti — oznake stanica sa živim brojem bicikala.", "Stanice blizu neposjećenih parkova su istaknute; prikazani su najbliži bicikli do cilja."],
      "0.8.0": ["👤 Odaberi korisničko ime (spremljeno na uređaju).", "📤 Podijeli statistiku — kao link ili generiranu sliku."],
      "0.7.0": ["♻️ Gumb za poništavanje napretka."],
      "0.6.0": ["🎟 Grebalica „Kamo dalje?” — otkrij nasumičan neposjećen park i postavi ga za 🎯 cilj.", "ℹ️ Dijalog pomoći: Kako igrati + Novosti (otvara se automatski nakon ažuriranja)."],
      "0.5.0": ["SHA zadnjeg commita prikazan uz verziju u podnožju."],
      "0.4.0": ["🗺 Prikaz karte (Leaflet / OpenStreetMap) s prebacivanjem Kartica ⇄ Karta.", "📍 GPS prijava unutar 300 m (rezerva: na povjerenje).", "Napredovanje: razine po broju, Bingo bonus i osvajanje četvrti."],
      "0.3.0": ["Napredak se sprema u pregledniku (localStorage)."],
      "0.2.0": ["Podijeljeno u statičke datoteke i objavljeno na GitHub Pages."],
      "0.1.0": ["Prva verzija: 5×5 bingo s 24 zagrebačke park-šume."],
    },
  },
  en: {
    "toggle.card": "🎲 Card", "toggle.map": "🗺 Map",
    "btn.newCard": "🔀 New card", "btn.whereNext": "🎟 Where next?",
    "btn.locate": "📍 Locate me", "btn.gpsOn": "📍 GPS on", "btn.reset": "♻️ Reset",
    "mode.count": "By count", "mode.size": "By size",
    "legend": "🟢 visited · ⚪ not yet · 🟡 goal · 🔵 you · tap a pin to check in",
    "bikes.show": "🚲 Show bikes", "bikes.hide": "🚲 Hide bikes",
    "footer.tagline": "24 protected forest parks of Zagreb",
    "banner.bingo": "BINGO!", "banner.close": "Nice!",
    "help.howto": "How to play", "help.news": "What’s new", "help.current": "current",
    "scratch.title": "🎟 Where to next?",
    "scratch.hintStart": "Scratch the foil to reveal your next park…",
    "scratch.hintReveal": "Accept to set this as your 🎯 goal, or re-roll.",
    "scratch.here": "🎟  SCRATCH HERE",
    "scratch.reroll": "🔄 Re-roll", "scratch.reveal": "Reveal",
    "scratch.accept": "🎯 Accept", "scratch.nav": "Navigate ↗", "scratch.share": "📤 Share",
    "scratch.allTitle": "🏆 All parks visited!", "scratch.allMeta": "You’re a Forest Champion.",
    "scratch.completes": "✅ completes {d}!", "scratch.away": "{d} away",
    "scratch.shareText": "🎯 {name} is going to {park} ({district}) — next park-šuma ✨",
    "scratch.imgTitle": "Next park-šuma", "scratch.imgFor": "destiny for {name}",
    "share.title": "📤 Share your stats", "share.namePh": "your name",
    "share.copy": "🔗 Copy link", "share.share": "📤 Share", "share.saveImg": "🖼 Save image",
    "share.playOwn": "🌲 Play your own", "share.aForester": "A forester",
    "share.svTitle": "👤 {name}’s forest stats",
    "share.statsLine": "{count} / 24 · {emoji} {tier} · {swept} districts · {ha} ha",
    "share.imgSub": "{name} · {emoji} {tier}",
    "share.imgSwept": "{swept} districts swept · {ha} ha explored",
    "share.copied": "🔗 Link copied", "share.imgSaved": "🖼 Image saved",
    "share.copyPrompt": "Copy your stats link:",
    "share.nativeText": "My Zagreb Park-Šuma Bingo: {n}/24 parks visited",
    "title.share": "Share your stats", "title.help": "Help & what's new", "title.pin": "Open in Google Maps",
    "tier.newcomer": "Newcomer", "tier.seedling": "Seedling", "tier.sprout": "Sprout",
    "tier.sapling": "Sapling", "tier.grove": "Grove", "tier.forester": "Forester", "tier.champion": "Forest Champion",
    "progress.next": "Next: {n}{unit} → {name}", "progress.max": "Max level reached! 🏆",
    "progress.ha": "{a} / {t} ha explored", "unit.ha": " ha",
    "near.nearest": "📍 Nearest unvisited: {name} ({d})",
    "near.all": "Every park visited — you’re a Forest Champion! 🏆",
    "goal.chip": "🎯 Goal: {name}",
    "gps.off": "GPS off — honor mode", "gps.on": "GPS on — check-ins gated to ≤{m} m",
    "toast.checkedIn": "Checked in at {name}! ✅",
    "toast.tooFar": "You’re {d} from {name} — get within {m} m to check in",
    "toast.locating": "Locating…",
    "toast.locFail": "Couldn’t get location — honor mode (tap to mark)",
    "toast.noGeo": "Geolocation not supported — staying in honor mode",
    "toast.reset": "Progress reset 🌱", "toast.goalSet": "🎯 Goal set: {name}",
    "reset.confirm": "Reset all progress?\n\nThis clears every visited park, your goal, and earned milestones. It cannot be undone.",
    "cel.destinyTitle": "Destiny reached!", "cel.destinyMsg": "You made it to your goal: {name}!",
    "cel.bingoMsg": "You linked up 5 forest parks in a line — bonus!",
    "cel.sweptTitle": "District swept!", "cel.sweptMsg": "You’ve visited every park-šuma in {d}.",
    "cel.levelTitle": "Level up: {name}!",
    "cel.levelCount": "{n} of 24 parks visited.", "cel.levelArea": "{n} ha explored.",
    "cel.championTitle": "Forest Champion!", "cel.championMsg": "All 24 park-šume of Zagreb visited. Bravo! 🌲",
    "pop.visited": "✅ visited {date}", "pop.goal": "🎯 your goal", "pop.notVisited": "not visited yet",
    "pop.approx": "(approx. location)", "pop.checkIn": "Check in", "pop.unCheck": "Un-check", "pop.maps": "Maps ↗",
    "bike.popup": "🚲 {n} bikes · {f} free racks", "bike.nav": "Navigate ↗",
    "bike.nearest": "🚲 Nearest bikes to {name}: {station} ({d}, {n} bikes)",
    "bike.cantLoad": "🚲 Could not load bike data: {reason}", "bike.openMap": "Open the Map first",
    "bike.errOffline": "you appear to be offline", "bike.errNetwork": "network error (feed unreachable)",
    "bike.errTimeout": "timed out after {s} s", "bike.errHttp": "server returned HTTP {status}",
    "bike.errBadData": "feed returned invalid data", "bike.errNoCity": "feed has no Zagreb data",
    "bike.errUnknown": "{detail}",
    "howto": `
      <p><strong>Goal:</strong> visit all 24 protected <em>park-šume</em> (forest parks) of Zagreb.</p>
      <ul>
        <li><strong>Mark a park</strong> by tapping its tile or its map pin. In honor mode you can mark anytime; tap <strong>📍 Locate me</strong> to require a real GPS check-in (within {m} m).</li>
        <li><strong>Level up</strong> as your count grows (🌰 → 🏆). Line up 5 in a row for a <strong>Bingo</strong> bonus, and finish every park in a district for a <strong>sweep</strong>.</li>
        <li><strong>🎟 Where next?</strong> scratches a random unvisited park — Accept it to set a 🎯 goal that shows on the map and card.</li>
        <li><strong>🔀 New card</strong> reshuffles the board. Progress saves automatically.</li>
      </ul>`,
    "changelog": {
      "0.12.0": ["📤 Share your “Where to next?” pick — a button on the revealed card sends a one-park image + text through the native share sheet.", "🚲 Clearer bike-loading errors — the reason (offline, network, timeout, HTTP status, bad data, no Zagreb in feed) now shows under the toggle.", "🖥️ Desktop layout — Card and Map side-by-side on wider screens (≥1024 px); tapping a tile centers that park on the map."],
      "0.11.0": ["🌐 Language switcher — Croatian / English (Croatian by default)."],
      "0.10.0": ["🗺️ Park boundary polygons on the map (from OpenStreetMap) + each park’s size in hectares.", "🌳 Hectares-explored stat, and a “By size” progression mode where bigger parks weigh more toward your level."],
      "0.9.0": ["🚲 Toggleable nextbike layer on the map — live station badges with bike counts.", "Stations near unvisited parks are highlighted, and the nearest bikes to your goal are shown."],
      "0.8.0": ["👤 Pick a username (saved on your device).", "📤 Share your stats — as a link or a generated image card."],
      "0.7.0": ["♻️ Reset progress button."],
      "0.6.0": ["🎟 “Where to next?” scratch card — reveal a random unvisited park and set it as your 🎯 goal.", "ℹ️ Help dialog: How to play + What’s new (pops up automatically after an update)."],
      "0.5.0": ["Live commit SHA shown next to the version in the footer."],
      "0.4.0": ["🗺 Map view (Leaflet / OpenStreetMap) with a Card ⇄ Map toggle.", "📍 GPS check-in within 300 m (honor-mode fallback).", "Progression: levels by count, a Bingo-line bonus, and district sweeps."],
      "0.3.0": ["Progress saved in your browser (localStorage)."],
      "0.2.0": ["Split into static files and deployed on GitHub Pages."],
      "0.1.0": ["First version: a 5×5 bingo of Zagreb’s 24 forest parks."],
    },
  },
};

let LANG = (() => { try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'hr'; } catch(e){ return 'hr'; } })();

function tr(key, params){
  let v = STRINGS[LANG] && STRINGS[LANG][key];
  if (v === undefined) v = STRINGS.en[key];
  if (v === undefined) return key;
  if (typeof v === 'string' && params)
    v = v.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : '{' + k + '}');
  return v;
}

function applyStaticI18n(){
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = tr(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-title]').forEach(el => el.title = tr(el.dataset.i18nTitle));
  document.querySelectorAll('[data-i18n-ph]').forEach(el => el.placeholder = tr(el.dataset.i18nPh));
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', tr(el.dataset.i18nAria)));
  document.querySelectorAll('#langToggle button').forEach(b => b.classList.toggle('active', b.dataset.lang === LANG));
}

function setLang(l){
  if (l !== 'hr' && l !== 'en') return;
  LANG = l;
  try { localStorage.setItem(LANG_KEY, l); } catch(e){}
  applyStaticI18n();
  if (window.onLangChange) window.onLangChange();
}

document.addEventListener('DOMContentLoaded', applyStaticI18n);
applyStaticI18n();   // DOM already parsed (script loaded at end), run now too
const _lt = document.getElementById('langToggle');
if (_lt) _lt.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLang(b.dataset.lang); });
