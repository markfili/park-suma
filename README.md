# 🌲 Zagreb Park-Šuma Bingo

A tiny static web game: a 5×5 bingo card of the **officially protected
park-šume (forest parks) of the City of Zagreb**. Tap a park you've visited,
get 5 in a row, win. Each tile links to the park on Google Maps.

🟢 A *greengo* demo.

## The parks (24)

Susedgrad · Lisičine · Grmoščica · Šestinski dol · Zamorski breg · Vrhovec ·
Jelenovac · Pantovčak · Prekrižje · Kraljevec · Zelengaj · Tuškanac ·
Dubravkin put · Cmrok · Remetski kamenjak · Mirogoj · Remete · Maksimir ·
Dotrščina · Miroševečina · Dankovečina · Granešina · Oporovec · Čulinečina

## Project layout

```
index.html   markup + a tiny loader that cache-busts the assets
styles.css   all styling
app.js       game logic (board, marking, bingo detection)
.nojekyll    tells GitHub Pages to serve files as-is (no Jekyll build)
```

No build step, no dependencies — just static files.

## Run locally

From this folder:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open <http://localhost:8080/>. (On Android, this is the only way to view
it in the host browser — `file://` can't reach the userland filesystem.)

## Always-fresh on refresh (cache-busting)

`index.html` loads `styles.css` and `app.js` with a `?v=<timestamp>` query
where the timestamp is `Date.now()` — a new value on **every page load**. So
the browser and the GitHub Pages CDN can never serve a stale asset; a plain
refresh always shows your latest edits.

Trade-off: assets are effectively never cached. When you want normal caching
back (e.g. for a real release), open `index.html` and swap `Date.now()` for a
fixed version string like `"1.0.0"`, bumping it whenever you ship.

## Deploy to GitHub Pages

1. Create an empty repo on GitHub (e.g. `greengo`).
2. From this folder, push the code:
   ```bash
   git remote add origin https://github.com/<you>/greengo.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source:
   "Deploy from a branch"**, pick branch **`main`** and folder **`/ (root)`**, Save.
4. Wait ~30–60s for the build, then visit
   `https://<you>.github.io/greengo/`.

After each `git push`, the Pages build re-runs and the CDN purges old content;
combined with the cache-busting above, your changes appear on the next refresh.

## Data source

The link this started from was a live Google Maps search for *"Park šuma"*
around Zagreb (pins render via JavaScript, so nothing is scrapable from the
static HTML). The park list here comes from Zagreb's authoritative set of
protected park-forests.
