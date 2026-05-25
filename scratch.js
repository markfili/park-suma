// "Where to next?" scratch card. Reuses globals from app.js:
// pickNext, setGoal, isVisited, completesDistrict, fmtDist, haversine,
// gpsActive, userPos, toast.
(function () {
  const scratch  = document.getElementById('scratch');
  const area     = document.getElementById('scArea');
  const reveal   = document.getElementById('scReveal');
  const foil     = document.getElementById('scFoil');
  const hint     = document.getElementById('scHint');
  const acceptBtn = document.getElementById('scAccept');
  const rerollBtn = document.getElementById('scReroll');
  const revealBtn = document.getElementById('scRevealBtn');
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
    hint.textContent = 'Scratch the foil to reveal your next park…';
    renderReveal();
    requestAnimationFrame(() => { sizeFoil(); drawFoil(); });
  }
  function close() { scratch.classList.remove('show'); }

  function renderAllVisited() {
    foil.style.display = 'none';
    [acceptBtn, rerollBtn, revealBtn].forEach(el => el.style.display = 'none');
    nav.style.display = 'none';
    hint.textContent = '';
    reveal.innerHTML = '<div class="rv-name">🏆 All parks visited!</div>' +
                       '<div class="rv-meta">You’re a Forest Champion.</div>';
  }

  function renderReveal() {
    const p = pick;
    let meta = p.district;
    if (typeof gpsActive !== 'undefined' && gpsActive && userPos)
      meta += ' · ' + fmtDist(haversine(userPos.lat, userPos.lon, p.lat, p.lon)) + ' away';
    const badge = (typeof completesDistrict === 'function' && completesDistrict(p.name))
      ? '<div class="rv-badge">✅ completes ' + p.district + '!</div>' : '';
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
    ctx.fillText('🎟  SCRATCH HERE', w / 2, h / 2);
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
    hint.textContent = 'Accept to set this as your 🎯 goal, or re-roll.';
  }
  function setRevealedUI(on) { acceptBtn.disabled = !on; nav.style.display = on ? '' : 'none'; }

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
      if (typeof toast === 'function') toast('🎯 Goal set: ' + pick.name);
    }
    close();
  });
  document.getElementById('scClose').addEventListener('click', close);
  scratch.addEventListener('click', e => { if (e.target === scratch) close(); });
  document.getElementById('whereNext').addEventListener('click', open);
})();
