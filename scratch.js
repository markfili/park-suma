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
  const ctx = foil.getContext('2d', { willReadFrequently: true });

  let pick = null, revealed = false, drawing = false, moves = 0;

  function open() {
    pick = (typeof pickNext === 'function') ? pickNext() : null;
    scratch.classList.add('show');
    if (!pick) { renderAllVisited(); return; }
    [foil, acceptBtn, rerollBtn, revealBtn].forEach(el => el.style.display = '');
    revealed = false; moves = 0;
    setRevealedUI(false);
    hint.textContent = tr('scratch.hintStart');
    renderReveal();
    requestAnimationFrame(() => { sizeFoil(); drawFoil(); });
  }
  function close() { scratch.classList.remove('show'); }

  function renderAllVisited() {
    foil.style.display = 'none';
    [acceptBtn, rerollBtn, revealBtn, shareBtn].forEach(el => el.style.display = 'none');
    nav.style.display = 'none';
    hint.textContent = '';
    reveal.innerHTML = '<div class="rv-name">' + tr('scratch.allTitle') + '</div>' +
                       '<div class="rv-meta">' + tr('scratch.allMeta') + '</div>';
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
    const w = area.clientWidth, h = area.clientHeight;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(0, 0, w, h);
    setRevealedUI(true);
    hint.textContent = tr('scratch.hintReveal');
  }
  function setRevealedUI(on) {
    acceptBtn.disabled = !on;
    nav.style.display = on ? '' : 'none';
    shareBtn.style.display = on ? '' : 'none';
  }

  // ---- share (text + PNG, mirrors share.js fallback ladder) ----
  function shareUrl() { return location.origin + location.pathname; }
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
  rerollBtn.addEventListener('click', open);
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
    hint.textContent = revealed ? tr('scratch.hintReveal') : tr('scratch.hintStart');
    renderReveal();
    if (!revealed) drawFoil();
  };
})();
