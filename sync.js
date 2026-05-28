// sync.js — keep multiple tabs of the game (same browser, same origin) live and
// consistent. localStorage is already the shared source of truth across tabs;
// this module fixes two gaps:
//   1. liveness — a tab showing stale UI after another tab changed something;
//   2. save races — each tab holds its own in-memory `state`, so the last save()
//      wins and can clobber a sibling's change.
//
// A monotonic `state._rev` (bumped inside save(), app.js) lets a tab ignore
// stale notifications. We adopt a newer sibling's state by re-reading
// localStorage and reassigning the shared global `state` — crucially WITHOUT
// calling save(), so adopting never bumps _rev and never rebroadcasts (no loop).
//
// Transport: BroadcastChannel where available, else the window `storage` event
// (which fires only in *other* tabs when localStorage changes). Reuses app.js
// globals: state, load, STORAGE_KEY, buildCard, refreshAll, toast — and tr().
(function () {
  const CHANNEL = 'parkSumaBingo:v2';
  let bc = null;
  if ('BroadcastChannel' in window) {
    try { bc = new BroadcastChannel(CHANNEL); } catch (e) { bc = null; }
  }

  function adopt() {
    const incoming = load();                                    // freshly-written localStorage
    if ((incoming._rev || 0) <= (state._rev || 0)) return;      // not newer → ignore
    // A sibling's "New card" reshuffles order; only then rebuild the board DOM.
    const orderChanged = JSON.stringify(incoming.order) !== JSON.stringify(state.order);
    state = incoming;                                           // reassign shared global binding
    if (orderChanged && state.order) buildCard(false);          // valid order ⇒ no reshuffle/save
    refreshAll();
    document.querySelectorAll('#modeToggle .modeseg')
      .forEach(s => s.classList.toggle('active', s.dataset.mode === state.mode));
    if (window.togetherSync) window.togetherSync();             // propagate to P2P peers too
    if (typeof toast === 'function') toast(tr('sync.updated'));
  }

  if (bc) {
    bc.onmessage = ev => { if (ev && ev.data && (ev.data.rev || 0) > (state._rev || 0)) adopt(); };
  } else {
    window.addEventListener('storage', e => { if (e.key === STORAGE_KEY) adopt(); });
  }

  // Debounce: one user action can fire several save() calls (e.g. celebrate()
  // pushing milestones); collapse the burst into a single notification carrying
  // the latest rev. The storage-event path needs no explicit post — setItem
  // already notified other tabs natively.
  let pending = null, lastRev = -1;
  window.syncBroadcast = function (rev) {
    if (!bc) return;
    if (typeof rev === 'number') lastRev = rev;
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      try { bc.postMessage({ rev: lastRev }); } catch (e) {}
    }, 60);
  };
})();
