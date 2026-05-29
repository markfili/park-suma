---
name: deploy
description: Commit and deploy the Zagreb Park-Šuma Bingo (greengo) app to GitHub Pages. Use when asked to commit, push, ship, release, or deploy this project. Bumps the version across all spots, verifies locally, commits with the project's Co-Authored-By trailer, pushes to main, and polls the live site until the new version is served.
---

# Ship park-suma (commit + deploy to GitHub Pages)

Repo `~/greengo` → `git@github.com:markfili/park-suma.git`, deployed via **GitHub
Pages (branch `main` / root)**. No build step — **pushing to `main` is the deploy**.
Run the steps in order. Only run this when the user asks to commit / push / ship /
deploy.

## 1. Is this a versioned release?

- **Feature / user-visible change → bump the version** (step 2).
- **Pure data/cosmetic fix** (marker tweak, typo, refactor) → **skip the bump** — a
  bump auto-opens the "What's new" popup for everyone. Go to step 3.

## 2. Bump the version — 5 spots, keep in sync

Choose the next `MAJOR.MINOR.PATCH`, then update **all five**:

1. `app.js` — `const APP_VERSION = "X.Y.Z";`
2. `app.js` — prepend `"X.Y.Z"` to the `CHANGELOG_VERSIONS` array
3. `index.html` — `<span id="appVer">vX.Y.Z</span>`
4. `i18n.js` — add a `"X.Y.Z"` entry under `changelog` in **both** `hr` **and** `en`
5. `version.json` — `{ "version": "X.Y.Z" }`  (drives the in-app update nudge — update.js)

(This mirrors the release checklist in `CLAUDE.md`.)

## 3. Verify locally (no linter available here)

Ensure the dev server is up — in `~/greengo`: `python3 -m http.server 8080 --bind 127.0.0.1`
(or the `serve` bash function). Then:

```bash
cd ~/greengo
# (a) every asset serves 200
for f in "" app.js i18n.js styles.css version.json badges.js together.js sync.js update.js scratch.js share.js bikes.js; do
  curl -s -o /dev/null -w "/$f %{http_code}\n" "http://localhost:8080/$f?v=$(date +%s%N)"; done
# (b) brackets balanced in every JS file
for j in *.js; do python3 -c "s=open('$j').read();print('$j', all(s.count(a)==s.count(b) for a,b in [('(',')'),('{','}'),('[',']')]))"; done
# (c) every tr()/data-i18n key defined in BOTH hr & en (tier./badge. are runtime-built prefixes)
python3 - <<'PY'
import re, glob
refs=set()
for f in glob.glob('*.js')+glob.glob('*.html'):
    s=open(f, encoding='utf-8').read()
    for m in re.finditer(r"""tr\(\s*['"]([^'"]+)['"]""", s): refs.add(m.group(1))
    for m in re.finditer(r"""data-i18n(?:-title|-ph|-aria)?\s*=\s*["']([^"']+)["']""", s): refs.add(m.group(1))
src=open('i18n.js', encoding='utf-8').read(); b=re.search(r"\n  en:\s*\{", src).start()
hr=set(re.findall(r'"([^"]+)"\s*:', src[:b])); en=set(re.findall(r'"([^"]+)"\s*:', src[b:]))
dyn=('tier.','badge.')
print("missing HR:", sorted(k for k in refs if k not in hr and k not in dyn) or "none")
print("missing EN:", sorted(k for k in refs if k not in en and k not in dyn) or "none")
PY
```

Expect: all assets `200`, every file `True`, missing HR/EN = `none`. (If you bumped
the version, also confirm `grep -c "X.Y.Z" app.js index.html i18n.js version.json`.)

## 4. Commit (one commit per version)

```bash
cd ~/greengo
git status -s            # sanity-check the diff
git add -A
git commit -q -F - <<'MSG'
vX.Y.Z: <one-line summary>

<body — what changed and why.>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
MSG
```

Every commit message ends with that Co-Authored-By trailer.

## 5. Push — this is the deploy

```bash
cd ~/greengo && git push origin main
```

SSH remote (ed25519 key at `~/.ssh/id_ed25519`, no passphrase) — no token needed.

## 6. Verify the live deploy

Pages rebuilds in ~30–60 s. Poll until the live `appVer` matches (run in the
background so it doesn't block):

```bash
BASE="https://markfili.github.io/park-suma"
for i in $(seq 1 18); do
  V=$(curl -sL "$BASE/?cb=$(date +%s%N)" | grep -o 'id="appVer">v[0-9.]*' | grep -o 'v[0-9.]*')
  [ "$V" = "vX.Y.Z" ] && { echo "LIVE: $V after ~$((i*10))s"; \
    curl -sL -o /dev/null -w "version.json: %{http_code}\n" "$BASE/version.json?cb=$(date +%s%N)"; exit 0; }
  sleep 10
done
echo "TIMED OUT — last seen: '$V' (Pages may still be building)"
```

Report the live version + that changed assets return 200.

## Notes

- The app cache-busts assets with `?v=Date.now()`, so a refresh always pulls fresh
  files — there is no CDN cache to clear and a plain reload always lands the latest.
- Releases land on `main` (that's what Pages serves). If somehow not on `main`,
  branch/PR is wrong for this repo — deploy = `main`.
- After a release, returning visitors get the "What's new" popup, and tabs still
  open on the previous version get the 🌱 update nudge (update.js / version.json).
