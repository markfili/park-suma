# CLAUDE.md — Zagreb Park-Šuma Bingo (greengo demo)

A static, dependency-free web game: a 5×5 bingo of the **24 officially protected
park-šume (forest parks) of the City of Zagreb**. Visit parks to mark them, level
up, sweep districts, and hit BINGO. Dark-green + mint theme, 🟢 "greengo" branding.

- **Repo:** `git@github.com:markfili/park-suma.git` (SSH remote, no token needed)
- **Live:** https://markfili.github.io/park-suma/ (GitHub Pages, branch `main` / root)
- **Local dir:** `~/greengo`

## Environment (important)

This box is **Debian running as a proot/chroot userland on Android**. Consequences:
- The host Android browser **cannot** open `file://` paths here, and there's no `/sdcard`
  mount or `am`/`termux-open` bridge. **View the app only via a localhost web server.**
- Only `python3` is preinstalled (no node/php). To run:
  ```bash
  cd ~/greengo && python3 -m http.server 8080 --bind 127.0.0.1
  ```
  then open `http://localhost:8080/` in Chrome. (A `serve [dir] [port]` bash function
  exists in `~/.bashrc` for interactive shells; it won't load in non-interactive `bash -c`.)
- Outbound 22/443 work, so `git push` over SSH and CDN/API fetches work.

## Run / deploy

- **No build step.** Just static files served as-is.
- **Deploy:** `git add -A && git commit && git push origin main`. Pages rebuilds in
  ~30–60s; the cache-buster (below) makes changes appear on the next refresh.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **`/deploy` skill** (`.claude/skills/deploy/`) automates the full flow: version
  bump → local verify → commit → push → poll the live site. Use it to ship a release.

## Files

```
index.html     markup + data-i18n attrs; chained <script> loader (order matters)
styles.css     all styling
i18n.js        tr() + STRINGS{hr,en}; lang persistence (loads BEFORE app.js)
app.js         core game logic, state (+ _rev), map, progression, help modal, badge hooks
badges.js      collectible achievements — registry + evaluate + badge case
scratch.js     "Where to next?" scratch-card goal picker
share.js       username + link/image stats sharing (+ earned-badge flair on the image)
bikes.js       toggleable nextbike station layer
together.js    P2P "Play together" — live shared leaderboard over WebRTC (PeerJS, lazy)
sync.js        live state sync across same-browser tabs (BroadcastChannel + storage)
update.js      polls version.json; nudges a long-open tab to reload on a new release
parks.js       the 24 parks: {name,lat,lon,district,ha?}
parks.geojson  21 OSM boundary polygons (name + ha)
version.json   { "version": APP_VERSION } — deployed-version manifest update.js polls
.nojekyll      serve files verbatim on Pages
```

**Script load order (in index.html, chained via onload):**
`leaflet (CDN) → parks.js → i18n.js → app.js → badges.js → scratch.js → share.js →
bikes.js → together.js → sync.js → update.js`.
All are classic scripts sharing one global scope: top-level `const`/`let`/`function`
in one file are visible to later files (e.g. `PARKS`, `tr`, `map`, `isVisited`,
`state`). Modules reach back into app.js globals and expose `window.*Relabel` /
`window.bikesGoalUpdate` hooks.

## Conventions / gotchas

- **Cache-busting:** `index.html` sets `window.__V = Date.now()` and appends `?v=__V`
  to every local asset (incl. `parks.geojson`). Fresh token per load ⇒ no stale
  JS/CSS on the Pages CDN. Don't "fix" this; it's intentional.
- **Versioning:** `APP_VERSION` in `app.js` is the single source. Footer shows
  `v<APP_VERSION>` + the **live commit SHA** (fetched from the GitHub API).
  `maybeShowWhatsNew()` auto-opens the help "What's new" tab when `APP_VERSION`
  differs from `localStorage parkSumaBingo:seenVersion`.
  - **To release a feature (5 spots):** bump `APP_VERSION` (app.js), add the version
    to `CHANGELOG_VERSIONS` (app.js), add notes under `changelog` in **both** `hr` and
    `en` (i18n.js), bump the `<span id="appVer">` default (index.html), and bump
    `version.json` (drives the in-app "new version available" nudge — see update.js).
  - **Do NOT bump version for pure data/cosmetic fixes** — it triggers a spurious
    What's-new popup. (Marker repositioning, layout tweaks = no bump.)
- **i18n:** `tr(key, params)` over `STRINGS.hr` / `STRINGS.en` (default **hr**, stored
  in `localStorage parkSumaBingo:lang`). Static text uses `data-i18n` /
  `data-i18n-title` / `data-i18n-ph` / `data-i18n-aria`; dynamic JS calls `tr()`.
  The function is named **`tr` (not `t`)** to avoid clashing with `t` loop vars.
  `setLang()` → `applyStaticI18n()` + `window.onLangChange()`; every used key MUST
  exist in both languages (there's a coverage check pattern — see below).
- **Persistence:** `localStorage parkSumaBingo:v2` =
  `{ visited:{name:ISOdate}, order:[24 names], name, mode:'count'|'area', goal,
  seenTiers:[], seenAreaTiers:[], seenDistricts:[] }`. Separate keys: `:seenVersion`,
  `:lang`. `load()` validates (order must be a full permutation; unknown names dropped).
- **Tiers:** `TIERS` = `{n,key,emoji}`; display name via `tierName(t)=tr('tier.'+key)`.
  `AREA_TIERS` derive ha thresholds from `TOTAL_HA`. Two progression modes
  (`state.mode`): count vs size; `celebrate()` awards both ladders, banners only the
  active mode.

## Data sources & how it was built (scripts were in /tmp, not committed)

- **Coords:** geocoded via **Nominatim** (`nominatim.openstreetmap.org/search`,
  bounded to Zagreb). Where a polygon exists, the marker is the **polygon centroid**
  (all 24 markers verified ≤250 m from their polygon; 3 without polygons —
  **Zamorski breg, Dubravkin put, Cmrok** — keep Nominatim points, `ha:null`).
- **Polygons / areas:** **Overpass API** —
  `way/relation["name"~"Park[- ]?[sš]uma",i]` in the Zagreb bbox, `out geom;`
  (must be `out geom;`, **not** `out tags geom;`, or relation member geometry is
  omitted). Main endpoint 504s under load → use mirror
  `https://overpass.kumi.systems/api/interpreter`. Relations are multipolygons:
  stitch member ways into rings by endpoint matching; area via geodesic ring formula
  → hectares. Name overrides: OSM `Lisičina`→`Lisičine`, `Dankovečka šuma`→`Dankovečina`.
- **nextbike (bikes.js):** `https://maps.nextbike.net/maps/nextbike-live.json?city=1172&domains=hd&list_cities=0&bikes=0`
  — **CORS open (`*`)**, so fetched client-side; feed sets `max-age=86400` so always
  append `&t=Date.now()` + `cache:'no-store'`. Parse `countries[*].cities[uid=1172].places`.

## Verification helpers (run after edits; no JS linter available here)

```bash
# serve check
for f in "" parks.js parks.geojson i18n.js app.js scratch.js share.js bikes.js styles.css; do
  curl -s -o /dev/null -w "/$f %{http_code}\n" "http://localhost:8080/$f?v=$(date +%s)"; done
# bracket balance (no node to lint)
python3 -c "s=open('app.js').read();print(all(s.count(a)==s.count(b) for a,b in [('(',')'),('{','}'),('[',']')]))"
# i18n key coverage: every tr('x')/data-i18n='x' must be defined in BOTH hr & en
```

## Feature set (current)

Bingo card + map (Leaflet/OSM, Card⇄Map toggle, boundary polygons) · GPS check-in
(≤300 m, honor-mode fallback, nearest-unvisited hint) · levels (count + size modes)
+ bingo-line bonus + district sweeps · scratch-card 🎯 goal · username + link/image
sharing · nextbike layer · reset · help/changelog modal · HR/EN switcher (hr default)
· 🏅 badges (collectible achievements + badge case) · 🤝 P2P "Play together" (live
shared leaderboard over WebRTC, no backend) · 🔄 live tab sync · 🌱 new-version nudge.

**No-backend networking note:** "Play together" (together.js) signals through the
**public PeerJS cloud broker**; game data is direct browser-to-browser, with STUN +
free **OpenRelay TURN** (`ICE_SERVERS`) so it works across different networks. Both
the broker and that free TURN are best-effort third parties — for real use, plug in
a dedicated TURN (self-hosted coturn / Metered API key) and/or self-host PeerServer.

Ideas not yet built: photo mementos per park, badge *perks* (badges that change play,
e.g. a free re-roll / unlockable card color), more badges, hole/inner-ring polygon
rendering, polygons for the 3 missing parks, optional PWA/offline (service worker).
