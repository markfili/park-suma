// update.js — nudge a long-open tab to reload when a newer version is deployed.
//
// The app cache-busts every asset with ?v=Date.now(), so a plain reload always
// pulls the fresh bundle — the only gap is a session left open across a deploy,
// which won't notice until it happens to reload. This polls the Pages-served
// `version.json` (which only flips once the new build is actually live) and, when
// it reports a strictly-newer version than the running APP_VERSION, shows a
// sticky "new version available" bar with a Refresh button.
//
// Triggers: on visibilitychange when the tab refocuses (the high-value moment),
// plus a gentle interval, both skipped while hidden/offline. Once the bar shows
// (or is dismissed) we stop polling — no nagging. Reuses app.js's APP_VERSION
// global + tr() (i18n.js).
(function () {
  const POLL_MS = 5 * 60 * 1000;   // 5 min
  const bar = document.getElementById('updateBar');
  if (!bar) return;
  const reloadBtn = document.getElementById('updReload');
  const dismissBtn = document.getElementById('updDismiss');
  let shown = false, timer = null;

  // Numeric dotted-version compare: >0 if a is newer than b.
  function cmpVer(a, b) {
    const pa = String(a).split('.'), pb = String(b).split('.');
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  function showBar() {
    if (shown) return;
    shown = true; stop();
    bar.hidden = false;
    requestAnimationFrame(() => bar.classList.add('show'));
  }

  function check() {
    if (shown || !navigator.onLine) return;
    // Fresh token per poll + no-store so the Pages CDN can't serve it stale.
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (d && typeof d.version === 'string' && cmpVer(d.version, APP_VERSION) > 0) showBar(); })
      .catch(() => {});   // offline / transient — just try again next tick
  }

  function start() { if (!shown && !timer) timer = setInterval(check, POLL_MS); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  reloadBtn.addEventListener('click', () => location.reload());
  dismissBtn.addEventListener('click', () => {
    bar.classList.remove('show');
    setTimeout(() => { bar.hidden = true; }, 250);
    // leave shown=true so we don't nag again this session
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { check(); start(); } else { stop(); }
  });

  start();
})();
