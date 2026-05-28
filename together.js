// together.js — P2P "Play together": a live shared leaderboard over WebRTC.
//
// PeerJS is lazy-loaded from a CDN only when the user opens the modal and
// creates/joins a room, so the base game stays dependency-free and works
// offline. Topology is a *star*: the room host registers a Peer whose id encodes
// the room code; everyone else connects to it, and the host relays one
// authoritative roster to all peers. Friends' check-ins surface as toasts,
// derived by diffing the 24-bit visited masks the roster carries (no separate
// event messages). Names are remote-supplied, so they're only ever written via
// textContent — never innerHTML.
//
// Reuses app.js globals (NAMES, isVisited, state, save, BY_NAME, tierFor, toast)
// and tr() (i18n.js). Wrapped in an IIFE so its locals don't clash with app.js's
// global `$`, `state`, etc.
(function () {
  const PEERJS = [
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
  ];
  // Both CDNs serve byte-identical 1.5.4, so one SRI hash pins either source.
  const PEERJS_SRI = 'sha256-rV2IcNHjiZFPnLqNNb4xPEMnxp7goiHkgum/diETb+U=';
  const PREFIX = 'psbingo-';                  // namespace inside the public broker
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  // no I/O/0/1/L lookalikes
  const CODE_LEN = 4;
  const PROTO = 1;                            // wire-format version

  let peer = null, isHost = false, roomCode = null, myId = null, seeded = false;
  const conns = new Map();        // host: remotePeerId -> DataConnection
  let hostConn = null;            // joiner: the single connection to the host
  const roster = new Map();       // id -> { name, mask:[3 bytes], proto }
  const prevMasks = new Map();    // id -> last-seen mask, for check-in diffing
  let pjPromise = null;           // lazy PeerJS loader (resolves once)

  // ---- visited mask (24 parks → 3 bytes) ----
  function myMask() {
    const b = [0, 0, 0];
    NAMES.forEach((n, i) => { if (isVisited(n)) b[i >> 3] |= (1 << (i & 7)); });
    return b;
  }
  function maskHas(m, i) { return !!((m[i >> 3] || 0) & (1 << (i & 7))); }
  function maskCount(m) { let c = 0; for (let i = 0; i < NAMES.length; i++) if (maskHas(m, i)) c++; return c; }
  function myName() { return (state.name || '').trim() || tr('share.aForester'); }
  function sanitizeName(n) { return ((typeof n === 'string' ? n : '').slice(0, 24)) || tr('share.aForester'); }
  function sanitizeMask(m) { return Array.isArray(m) ? [m[0] | 0, m[1] | 0, m[2] | 0] : [0, 0, 0]; }

  // ---- lazy PeerJS loader (SRI-pinned, CDN fallback) ----
  function loadPeerJS() {
    if (window.Peer) return Promise.resolve();
    if (pjPromise) return pjPromise;
    pjPromise = new Promise((resolve, reject) => {
      let i = 0;
      (function tryNext() {
        if (window.Peer) return resolve();
        if (i >= PEERJS.length) return reject(new Error('peerjs load failed'));
        const s = document.createElement('script');
        s.src = PEERJS[i++]; s.integrity = PEERJS_SRI; s.crossOrigin = 'anonymous';
        s.onload = () => resolve();
        s.onerror = () => { s.remove(); tryNext(); };
        document.head.appendChild(s);
      })();
    });
    return pjPromise;
  }

  function randomCode() {
    const a = new Uint8Array(CODE_LEN);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < CODE_LEN; i++) a[i] = (Math.random() * 256) | 0;
    let c = '';
    for (let i = 0; i < CODE_LEN; i++) c += ALPHABET[a[i] % ALPHABET.length];
    return c;
  }

  // ---- DOM ----
  const $ = id => document.getElementById(id);
  const el = {
    modal: $('together'), lobby: $('tgLobby'), room: $('tgRoom'),
    name: $('tgName'), create: $('tgCreate'), code: $('tgCode'), join: $('tgJoin'),
    status: $('tgStatus'), codeChip: $('tgCodeChip'), roster: $('tgRoster'), leave: $('tgLeave'),
  };

  function setStatus(msg, kind) {
    el.status.textContent = msg || '';
    el.status.className = 'together-status' + (kind ? ' ' + kind : '');
  }
  function busy(on) { el.create.disabled = on; el.join.disabled = on; el.code.disabled = on; }
  function showLobby() {
    el.lobby.hidden = false; el.room.hidden = true;
    el.name.value = state.name || ''; busy(false); setStatus('');
  }
  function showRoom() {
    el.lobby.hidden = true; el.room.hidden = false;
    el.codeChip.textContent = roomCode || '····';
    renderRoster();
  }

  // ---- roster rendering ----
  function hueOf(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360; return h; }
  function colorOf(id) { return 'hsl(' + hueOf(id) + ',58%,55%)'; }
  function rosterList() {
    return [...roster.entries()].map(([id, p]) => ({ id, name: p.name, mask: p.mask, proto: p.proto }));
  }
  function renderRoster() {
    // Always keep my own row present and perfectly live, regardless of round-trips.
    if (myId) {
      const me = roster.get(myId) || { proto: PROTO };
      me.name = myName(); me.mask = myMask(); me.proto = PROTO;
      roster.set(myId, me);
    }
    const rows = [...roster.entries()].sort((a, b) => maskCount(b[1].mask) - maskCount(a[1].mask));
    el.roster.innerHTML = '';
    rows.forEach(([id, p]) => {
      const count = maskCount(p.mask), tier = tierFor(count);
      const row = document.createElement('div');
      row.className = 'tg-player' + (id === myId ? ' me' : '');
      row.innerHTML =
        '<span class="tg-dot"></span>' +
        '<span class="tg-name"></span>' +
        '<span class="tg-bar"><span class="tg-bar-fill"></span></span>' +
        '<span class="tg-count"></span>';
      row.querySelector('.tg-dot').style.background = colorOf(id);
      row.querySelector('.tg-name').textContent = p.name + (id === myId ? ' ' + tr('together.you') : '');
      row.querySelector('.tg-bar-fill').style.width = (count / 24 * 100) + '%';
      row.querySelector('.tg-count').textContent = count + '/24 ' + tier.emoji;
      el.roster.appendChild(row);
    });
    if (rows.length <= 1) {
      const note = document.createElement('div');
      note.className = 'together-status'; note.textContent = tr('together.alone');
      el.roster.appendChild(note);
    }
    if (roster.size >= 2 && window.evaluateBadges) window.evaluateBadges({ event: 'together', players: roster.size });
  }

  // Toast every park that flipped on for a given peer (never for myself).
  function toastGains(id, oldMask, newMask, name) {
    if (id === myId) return;
    const om = oldMask || [0, 0, 0];
    for (let i = 0; i < NAMES.length; i++)
      if (maskHas(newMask, i) && !maskHas(om, i))
        toast(tr('together.visited', { name: name || tr('share.aForester'), park: NAMES[i] }));
  }

  // ---- host: relay roster to everyone ----
  function broadcast(msg) {
    conns.forEach(c => { if (c.open) { try { c.send(msg); } catch (e) {} } });
  }
  function hostSyncRoster() {
    if (myId) renderRoster();   // refreshes my own entry first
    broadcast({ t: 'roster', list: rosterList() });
    if (!el.room.hidden) renderRoster();
  }
  function onPeerUpdate(remoteId, data) {
    const known = roster.has(remoteId);
    const old = known ? roster.get(remoteId).mask : null;
    const mask = sanitizeMask(data.mask), name = sanitizeName(data.name);
    roster.set(remoteId, { name, mask, proto: data.proto || 1 });
    if (known) toastGains(remoteId, old, mask, name);
    else toast(tr('together.peerJoined', { name }));
    hostSyncRoster();
  }
  function removePeer(id) {
    const p = roster.get(id);
    conns.delete(id); roster.delete(id); prevMasks.delete(id);
    if (p) toast(tr('together.peerLeft', { name: p.name }));
    if (peer) hostSyncRoster();
  }
  function setupHostConn(conn) {
    conn.on('open', () => {
      conns.set(conn.peer, conn);
      try { conn.send({ t: 'roster', list: rosterList() }); } catch (e) {}  // newcomer sees everyone
    });
    conn.on('data', d => { if (d && d.t === 'update') onPeerUpdate(conn.peer, d); });
    conn.on('close', () => removePeer(conn.peer));
    conn.on('error', () => removePeer(conn.peer));
  }

  // ---- joiner: ingest the host's roster ----
  function ingestRoster(list) {
    if (!Array.isArray(list)) return;
    const next = new Map();
    list.forEach(p => {
      if (p && typeof p.id === 'string')
        next.set(p.id, { name: sanitizeName(p.name), mask: sanitizeMask(p.mask), proto: p.proto || 1 });
    });
    if (seeded) next.forEach((p, id) => { if (id !== myId) toastGains(id, prevMasks.get(id), p.mask, p.name); });
    roster.clear(); next.forEach((v, k) => roster.set(k, v));
    prevMasks.clear(); roster.forEach((v, k) => prevMasks.set(k, v.mask.slice()));
    seeded = true;
    renderRoster();
  }

  // ---- send my own state outward ----
  function pushUpdate() {
    if (isHost) { hostSyncRoster(); return; }
    if (hostConn && hostConn.open) {
      try { hostConn.send({ t: 'update', proto: PROTO, name: myName(), mask: myMask() }); } catch (e) {}
    }
  }

  // ---- lifecycle ----
  function teardownPeer() { if (peer) { try { peer.destroy(); } catch (e) {} peer = null; } }
  function leave() {
    teardownPeer();
    conns.clear(); roster.clear(); prevMasks.clear();
    hostConn = null; isHost = false; roomCode = null; myId = null; seeded = false;
    showLobby();
  }

  function host() {
    busy(true); setStatus(tr('together.loadingLib'));
    loadPeerJS().then(() => startHost(0)).catch(() => { busy(false); setStatus(tr('together.libFail'), 'err'); });
  }
  function startHost(attempt) {
    if (attempt > 4) { busy(false); setStatus(tr('together.netErr'), 'err'); return; }
    roomCode = randomCode(); isHost = true;
    setStatus(tr('together.connecting'));
    peer = new Peer(PREFIX + roomCode);
    peer.on('open', id => {
      myId = id; seeded = true;
      roster.set(myId, { name: myName(), mask: myMask(), proto: PROTO });
      prevMasks.set(myId, myMask());
      showRoom(); setStatus(''); toast(tr('together.hosting'));
    });
    peer.on('connection', setupHostConn);
    peer.on('error', err => {
      if (err && err.type === 'unavailable-id') { teardownPeer(); startHost(attempt + 1); return; }
      busy(false); setStatus(tr('together.netErr'), 'err');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }

  function join(raw) {
    const code = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
    if (code.length < CODE_LEN) { setStatus(tr('together.badCode'), 'err'); return; }
    busy(true); setStatus(tr('together.loadingLib'));
    loadPeerJS().then(() => startJoin(code)).catch(() => { busy(false); setStatus(tr('together.libFail'), 'err'); });
  }
  function startJoin(code) {
    roomCode = code; isHost = false; seeded = false;
    setStatus(tr('together.connecting'));
    peer = new Peer();
    peer.on('open', id => {
      myId = id;
      const conn = peer.connect(PREFIX + code, { reliable: true });
      hostConn = conn;
      conn.on('open', () => { showRoom(); setStatus(''); toast(tr('together.joined')); pushUpdate(); });
      conn.on('data', d => { if (d && d.t === 'roster') ingestRoster(d.list); });
      conn.on('close', () => { leave(); setStatus(tr('together.hostLeft'), 'err'); });
      conn.on('error', () => { busy(false); setStatus(tr('together.netErr'), 'err'); });
    });
    peer.on('error', err => {
      busy(false);
      setStatus(err && err.type === 'peer-unavailable' ? tr('together.notFound') : tr('together.netErr'), 'err');
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  }

  // ---- public hooks (called from app.js / i18n.js) ----
  window.togetherSync = function () {            // a local check-in / name change happened
    if (!peer) return;
    if (!el.room.hidden) renderRoster();
    pushUpdate();
  };
  window.togetherRelabel = function () {         // language switched
    if (el.modal.classList.contains('show') && !el.room.hidden) renderRoster();
  };

  // ---- wire up ----
  el.create.addEventListener('click', host);
  el.join.addEventListener('click', () => join(el.code.value));
  el.code.addEventListener('input', () => { el.code.value = el.code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN); });
  el.code.addEventListener('keydown', e => { if (e.key === 'Enter') join(el.code.value); });
  el.name.addEventListener('input', () => { state.name = el.name.value.slice(0, 24); save(); if (peer) pushUpdate(); });
  el.leave.addEventListener('click', leave);
  el.codeChip.addEventListener('click', () => {
    const code = roomCode || '';
    (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
      .then(() => toast(tr('together.codeCopied'))).catch(() => prompt(tr('together.copyCode'), code));
  });
  $('togetherBtn').addEventListener('click', () => { (peer ? showRoom() : showLobby()); el.modal.classList.add('show'); });
  $('tgX').addEventListener('click', () => el.modal.classList.remove('show'));
  el.modal.addEventListener('click', e => { if (e.target === el.modal) el.modal.classList.remove('show'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.modal.classList.contains('show')) el.modal.classList.remove('show'); });
})();
