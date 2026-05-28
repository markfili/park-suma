// "Where to next?" scratch card. Reuses app.js globals + tr() (i18n.js).
(function () {
  const scratch  = document.getElementById('scratch');
  const area     = document.getElementById('scArea');
  const reveal   = document.getElementById('scReveal');
  const foil     = document.getElementById('scFoil');
  const hint     = document.getElementById('scHint');
  const acceptBtn = document.getElementById('scAccept');
  const rerollBtn = document.getElementById('scReroll');
  const revealBtn = document.getElementById('scRevealBtn');
  const shareBtn  = document.getElementById('scShare');
  const nav      = document.getElementById('scNav');
  const mapEl    = document.getElementById('scMap');
  const slot     = document.getElementById('scSlot');
  const reels    = slot ? slot.querySelectorAll('.reel') : [];
  const spinBtn  = document.getElementById('scSpinBtn');
  const pickerEl = document.getElementById('scPicker');
  const ctx = foil.getContext('2d', { willReadFrequently: true });

  let pick = null, revealed = false, drawing = false, moves = 0;
  let scMap = null, scMarker = null;
  let spinning = false;

  // ---- picker mode (Scratch vs Slot), persisted ----
  const PICKER_KEY = 'parkSumaBingo:pickerMode';
  let pickerMode = 'scratch';
  try {
    const v = localStorage.getItem(PICKER_KEY);
    if (v === 'scratch' || v === 'slot') pickerMode = v;
  } catch (e) {}
  function savePicker() { try { localStorage.setItem(PICKER_KEY, pickerMode); } catch (e) {} }

  // ---- slot tuning (kept near the top so it's easy to tweak feel) ----
  const SLOT_DURATIONS = [1000, 1500, 2000]; // ms, staggered stops per reel
  const SLOT_STRIP_LEN = 30;                 // cells in each strip
  const SLOT_WINNER_AT = 25;                 // winner index inside the strip
  const SLOT_CELL_H = 44;                    // must match .reel .cell height in CSS
  const SLOT_HOLD_MS = 500;                  // beat to admire the jackpot before reveal
  // Diacritic-fold + first-3 uppercase. Two parks share each of MIR / REM, so
  // filler tiles are pooled by abbreviation: anything with the winner's abbr
  // is excluded so no other reel cell can read like the winner.
  function abbr3(name) {
    const folded = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return folded.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  }

  function open() {
    pick = (typeof pickNext === 'function') ? pickNext() : null;
    scratch.classList.add('show');
    syncPickerUI();
    if (!pick) { renderAllVisited(); return; }
    [acceptBtn, rerollBtn].forEach(el => el.style.display = '');
    revealed = false; moves = 0;
    setRevealedUI(false);
    hideMap();
    hint.textContent = tr(pickerMode === 'slot' ? 'slot.hintStart' : 'scratch.hintStart');
    renderReveal();
    setOverlayForMode();
    if (pickerMode === 'scratch') {
      requestAnimationFrame(() => { sizeFoil(); drawFoil(); });
    } else {
      resetSlot();
    }
  }
  function close() { scratch.classList.remove('show'); hideMap(); }

  function renderAllVisited() {
    foil.style.display = 'none';
    slot.hidden = true;
    [acceptBtn, rerollBtn, revealBtn, spinBtn, shareBtn].forEach(el => el.style.display = el === shareBtn ? 'none' : 'none');
    nav.style.display = 'none';
    hideMap();
    hint.textContent = '';
    reveal.innerHTML = '<div class="rv-name">' + tr('scratch.allTitle') + '</div>' +
                       '<div class="rv-meta">' + tr('scratch.allMeta') + '</div>';
  }

  // ---- mode-aware overlay swap ----
  // Both the canvas foil and the slot live inside .scratch-area as siblings
  // above .reveal. Only one is mounted per mode; the other is fully hidden.
  function setOverlayForMode() {
    if (pickerMode === 'slot') {
      foil.style.display = 'none';
      slot.hidden = false;
      slot.classList.remove('fade');
      revealBtn.hidden = true;
      spinBtn.hidden = false;
      spinBtn.disabled = false;
    } else {
      slot.hidden = true;
      foil.style.display = '';
      revealBtn.hidden = false;
      spinBtn.hidden = true;
    }
  }
  function syncPickerUI() {
    pickerEl.querySelectorAll('button[data-picker]').forEach(b => {
      b.classList.toggle('active', b.dataset.picker === pickerMode);
    });
  }

  // Small read-only Leaflet preview that appears below the foil on reveal.
  // Marker uses the same gold/amber palette as app.js's goal pin so the
  // visual language carries over to the main map once Accept is tapped.
  function showMap(p) {
    if (typeof L === 'undefined') return;
    if (!scMap) {
      scMap = L.map(mapEl, {
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, boxZoom: false, keyboard: false,
        tap: false, trackResize: false
      }).setView([p.lat, p.lon], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19 }).addTo(scMap);
    } else {
      scMap.setView([p.lat, p.lon], 14);
    }
    if (scMarker) { scMarker.remove(); scMarker = null; }
    scMarker = L.circleMarker([p.lat, p.lon],
      { radius: 11, weight: 3, color: '#ffd56b', fillColor: '#caa23a', fillOpacity: 0.95 }
    ).addTo(scMap);
    mapEl.classList.add('show');
    mapEl.setAttribute('aria-hidden', 'false');
    // Container is 0×0 until the .show transition starts; let layout settle
    // before Leaflet asks tiles for the real size.
    setTimeout(() => { if (scMap) scMap.invalidateSize(); }, 360);
  }
  function hideMap() {
    mapEl.classList.remove('show');
    mapEl.setAttribute('aria-hidden', 'true');
  }

  function renderReveal() {
    const p = pick;
    let meta = p.district;
    if (typeof gpsActive !== 'undefined' && gpsActive && userPos)
      meta += ' · ' + tr('scratch.away', { d: fmtDist(haversine(userPos.lat, userPos.lon, p.lat, p.lon)) });
    const badge = (typeof completesDistrict === 'function' && completesDistrict(p.name))
      ? '<div class="rv-badge">' + tr('scratch.completes', { d: p.district }) + '</div>' : '';
    reveal.innerHTML = '<div class="rv-name">' + p.name + '</div>' +
                       '<div class="rv-meta">' + meta + '</div>' + badge;
    nav.href = 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lon;
  }

  // ---- canvas foil ----
  function sizeFoil() {
    const dpr = window.devicePixelRatio || 1;
    const w = area.clientWidth, h = area.clientHeight;
    foil.width = w * dpr; foil.height = h * dpr;
    foil.style.width = w + 'px'; foil.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawFoil() {
    const w = area.clientWidth, h = area.clientHeight;
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1c6a4f'); g.addColorStop(.5, '#2fae6f'); g.addColorStop(1, '#1c6a4f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(234,255,243,.9)';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tr('scratch.here'), w / 2, h / 2);
  }
  function erase(x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
  }
  function scratchedPct() {
    const d = ctx.getImageData(0, 0, foil.width, foil.height).data;
    let clear = 0, total = 0;
    for (let i = 3; i < d.length; i += 4 * 16) { total++; if (d[i] === 0) clear++; }
    return total ? clear / total : 0;
  }
  function pos(e) {
    const r = foil.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  function start(e) { if (revealed) return; drawing = true; const p = pos(e); erase(p.x, p.y); e.preventDefault(); }
  function move(e) {
    if (!drawing || revealed) return;
    const p = pos(e); erase(p.x, p.y);
    if ((++moves % 6) === 0 && scratchedPct() > 0.55) doReveal();
    e.preventDefault();
  }
  function end() { drawing = false; if (!revealed && scratchedPct() > 0.4) doReveal(); }

  function doReveal() {
    revealed = true;
    // Scratch overlay: erase whatever foil is left so the reveal is instant
    // even if the user hit "Otkrij" before scratching.
    const w = area.clientWidth, h = area.clientHeight;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(0, 0, w, h);
    // Slot overlay: fade the reels out over the reveal underneath.
    if (pickerMode === 'slot') slot.classList.add('fade');
    setRevealedUI(true);
    hint.textContent = tr('scratch.hintReveal');
    if (pick) showMap(pick);
  }
  function setRevealedUI(on) {
    acceptBtn.disabled = !on;
    nav.style.display = on ? '' : 'none';
    shareBtn.style.display = on ? '' : 'none';
    if (pickerMode === 'slot') { spinBtn.hidden = on; rerollBtn.style.display = on ? '' : ''; }
  }

  // ---- slot reels ----------------------------------------------------------
  // Three reels each get an independently-shuffled strip of SLOT_STRIP_LEN
  // park tiles, with the same winning pick injected at SLOT_WINNER_AT. They
  // start spinning together but stop at staggered durations, with the third
  // reel's final tile triggering a gold jackpot pulse before the reveal fade.
  function cellHtml(name) {
    return '<div class="cell"><span class="emoji">🌲</span><span class="abbr">'
         + abbr3(name) + '</span></div>';
  }
  // Build all three reel strips at once so the cross-reel constraint can be
  // enforced: the *only* row where all three reels share an abbreviation is
  // SLOT_WINNER_AT. Off-payline rows show at most two reels with the same
  // abbr; vertical column visibility (3 visible rows per reel) can never
  // produce a 3-of-a-kind because row 24/26 are pooled away from winnerAbbr
  // and the middle row is the winner.
  function buildAllStrips(winnerName) {
    const winnerAbbr = abbr3(winnerName);
    const pool = (typeof PARKS !== 'undefined' ? PARKS : [])
      .filter(p => abbr3(p.name) !== winnerAbbr)
      .map(p => p.name);
    if (!pool.length) return null;
    const rand = () => pool[Math.floor(Math.random() * pool.length)];
    const strips = [[], [], []];
    for (let row = 0; row < SLOT_STRIP_LEN; row++) {
      if (row === SLOT_WINNER_AT) {
        strips.forEach(s => s.push(winnerName));
        continue;
      }
      const a = rand(), b = rand();
      let c;
      // Guarantee: if a and b share an abbr, c must differ — so no off-payline
      // row ever shows three matching tiles across reels.
      do { c = rand(); } while (abbr3(a) === abbr3(b) && abbr3(c) === abbr3(a));
      strips[0].push(a); strips[1].push(b); strips[2].push(c);
    }
    return strips;
  }
  function buildStrip(reel, names) {
    const strip = reel.querySelector('.strip');
    let html = '';
    for (let i = 0; i < names.length; i++) html += cellHtml(names[i]);
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.innerHTML = html;
    // Force a layout flush so the next transition assignment animates.
    void strip.offsetHeight;
  }
  function resetSlot() {
    if (!pick) return;
    const all = buildAllStrips(pick.name);
    if (!all) return;
    reels.forEach((r, i) => { r.classList.remove('win'); buildStrip(r, all[i]); });
    slot.classList.remove('fade');
  }
  function spinReel(reel, durMs) {
    const strip = reel.querySelector('.strip');
    // Center the winner inside a 3-cell visible window:
    //   visible window holds rows 0..2 (cell height SLOT_CELL_H each).
    //   winner sits at strip index SLOT_WINNER_AT; pull it to row 1 (center).
    const targetY = -((SLOT_WINNER_AT - 1) * SLOT_CELL_H);
    return new Promise(resolve => {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(' + targetY + 'px)';
        setTimeout(resolve, 120);
        return;
      }
      strip.style.transition = 'transform ' + durMs + 'ms cubic-bezier(.16,.84,.3,1)';
      strip.style.transform = 'translateY(' + targetY + 'px)';
      let done = false;
      const onEnd = () => {
        if (done) return; done = true;
        strip.removeEventListener('transitionend', onEnd);
        resolve();
      };
      strip.addEventListener('transitionend', onEnd);
      // Safety net in case transitionend never fires (interrupted, tab hidden).
      setTimeout(onEnd, durMs + 200);
    });
  }
  async function runSlot() {
    if (!pick || spinning || revealed) return;
    spinning = true;
    pickerEl.setAttribute('aria-disabled', 'true');
    spinBtn.disabled = true; rerollBtn.disabled = true;
    resetSlot();
    // Build promises before kicking off so all three start in the same tick.
    const spins = [];
    reels.forEach((r, i) => spins.push(
      spinReel(r, SLOT_DURATIONS[i]).then(() => { if (i === reels.length - 1) r.classList.add('win'); })
    ));
    await Promise.all(spins);
    await new Promise(r => setTimeout(r, SLOT_HOLD_MS));
    spinning = false;
    pickerEl.removeAttribute('aria-disabled');
    rerollBtn.disabled = false;
    doReveal();
  }

  // ---- share (text + PNG, mirrors share.js fallback ladder) ----
  // Hash carries who's sharing (u=name) + which park they're heading for
  // (g=index into NAMES). share.js parses this at boot and pops the going-next
  // modal so the recipient can adopt the same park as their own goal in one tap.
  function shareUrl() {
    const name = encodeURIComponent((state.name || '').trim());
    const idx = pick ? NAMES.indexOf(pick.name) : -1;
    const base = location.origin + location.pathname;
    return idx >= 0 ? base + '#u=' + name + '&g=' + idx : base;
  }
  function shareName() { return (state.name || '').trim() || tr('share.aForester'); }
  function shareText() {
    return tr('scratch.shareText', { name: shareName(), park: pick.name, district: pick.district })
      + ' ' + shareUrl();
  }
  // One-park hero card; same 600×315 @2× layout grammar as share.js drawCard.
  function drawShareCard(canvas) {
    const scale = 2, W = 600, H = 315;
    canvas.width = W * scale; canvas.height = H * scale;
    const x = canvas.getContext('2d');
    x.setTransform(scale, 0, 0, scale, 0, 0);
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b3d2e'); g.addColorStop(1, '#0a2c22');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.textAlign = 'center';
    x.fillStyle = '#7fcfa3'; x.font = 'bold 18px system-ui, sans-serif';
    x.fillText('🎟  ' + tr('scratch.imgTitle'), W / 2, 44);
    x.fillStyle = '#ffd56b'; x.font = 'bold 54px system-ui, sans-serif';
    x.fillText(pick.name, W / 2, 130);
    x.fillStyle = '#b8f5d0'; x.font = '20px system-ui, sans-serif';
    x.fillText(pick.district, W / 2, 168);
    x.fillStyle = '#7fcfa3'; x.font = '20px system-ui, sans-serif';
    x.fillText('✨ ' + tr('scratch.imgFor', { name: shareName() }), W / 2, 210);
    if (typeof completesDistrict === 'function' && completesDistrict(pick.name)) {
      x.fillStyle = '#2fae6f'; x.font = 'bold 16px system-ui, sans-serif';
      x.fillText(tr('scratch.completes', { d: pick.district }), W / 2, 246);
    }
    x.fillStyle = '#4e7a66'; x.font = '14px system-ui, sans-serif';
    x.fillText('markfili.github.io/park-suma · v' + APP_VERSION, W / 2, H - 16);
  }

  shareBtn.addEventListener('click', () => {
    if (!pick) return;
    const canvas = document.createElement('canvas');
    drawShareCard(canvas);
    const text = shareText();
    canvas.toBlob(blob => {
      if (!blob) { return; }
      const file = new File([blob], 'park-suma-next.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Park-Šuma Bingo', text }).catch(() => {});
      } else if (navigator.share) {
        navigator.share({ title: 'Park-Šuma Bingo', text }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'park-suma-next.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
        toast(tr('share.imgSaved'));
      }
    }, 'image/png');
  });

  // ---- events ----
  foil.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  foil.addEventListener('touchstart', start, { passive: false });
  foil.addEventListener('touchmove', move, { passive: false });
  foil.addEventListener('touchend', end);

  revealBtn.addEventListener('click', () => { if (!revealed) doReveal(); });
  spinBtn.addEventListener('click', () => { if (!revealed && !spinning) runSlot(); });
  rerollBtn.addEventListener('click', () => { if (!spinning) open(); });
  pickerEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-picker]'); if (!b || spinning) return;
    const next = b.dataset.picker;
    if (next === pickerMode) return;
    pickerMode = next; savePicker();
    // Re-open in the new mode keeps the *same* pick if not yet revealed; if
    // already revealed, open() will roll a fresh pick (parity with reroll).
    if (revealed) open();
    else { syncPickerUI(); setOverlayForMode(); hint.textContent = tr(pickerMode === 'slot' ? 'slot.hintStart' : 'scratch.hintStart');
           if (pickerMode === 'slot') resetSlot();
           else requestAnimationFrame(() => { sizeFoil(); drawFoil(); }); }
  });
  acceptBtn.addEventListener('click', () => {
    if (pick && typeof setGoal === 'function') {
      setGoal(pick.name);
      if (typeof toast === 'function') toast(tr('toast.goalSet', { name: pick.name }));
    }
    close();
  });
  document.getElementById('scClose').addEventListener('click', close);
  scratch.addEventListener('click', e => { if (e.target === scratch) close(); });
  document.getElementById('whereNext').addEventListener('click', open);

  // re-render in the new language if the card is open
  window.scratchRelabel = function () {
    if (!scratch.classList.contains('show')) return;
    if (!pick) { renderAllVisited(); return; }
    hint.textContent = revealed
      ? tr('scratch.hintReveal')
      : tr(pickerMode === 'slot' ? 'slot.hintStart' : 'scratch.hintStart');
    renderReveal();
    if (!revealed && pickerMode === 'scratch') drawFoil();
  };
})();
