// Username + stats sharing — fully static, no backend. Reuses app.js globals
// (NAMES, isVisited, state, save, tierFor, tierName, BY_NAME, DISTRICTS,
// APP_VERSION, toast) and tr() (i18n.js).
(function () {
  function maskBytes(testFn) {
    const b = [0, 0, 0];
    NAMES.forEach((n, i) => { if (testFn(n)) b[i >> 3] |= (1 << (i & 7)); });
    return b;
  }
  function b64url(bytes) {
    let s = ''; bytes.forEach(x => s += String.fromCharCode(x));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '=';
    const s = atob(str), b = []; for (let i = 0; i < s.length; i++) b.push(s.charCodeAt(i));
    return b;
  }
  function decodeSet(s) {
    const b = fromB64url(s), set = new Set();
    NAMES.forEach((n, i) => { if ((b[i >> 3] || 0) & (1 << (i & 7))) set.add(n); });
    return set;
  }
  function shareUrl() {
    const name = (state.name || '').trim();
    return location.origin + location.pathname +
      '#u=' + encodeURIComponent(name) + '&s=' + b64url(maskBytes(isVisited));
  }
  function stats(set) {
    const count = set.size, tier = tierFor(count);
    const swept = DISTRICTS.filter(d => d.parks.every(p => set.has(p))).length;
    const ha = Math.round([...set].reduce((s, n) => s + ((BY_NAME[n] && BY_NAME[n].ha) || 0), 0));
    return { count, tier, swept, ha };
  }
  function statsLine(st) {
    return tr('share.statsLine', { count: st.count, emoji: st.tier.emoji, tier: tierName(st.tier), swept: st.swept, ha: st.ha });
  }

  // ---- stats image (canvas) ----
  function drawCard(canvas, name, set) {
    // Render at 2× (1200×630, the standard social-card size) for a crisp
    // preview and export; layout below is authored in logical 600×315 units.
    const scale = 2, W = 600, H = 315;
    canvas.width = W * scale; canvas.height = H * scale;
    const x = canvas.getContext('2d');
    x.setTransform(scale, 0, 0, scale, 0, 0);
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b3d2e'); g.addColorStop(1, '#0a2c22');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.textAlign = 'center';
    const st = stats(set);
    x.fillStyle = '#b8f5d0'; x.font = 'bold 30px system-ui, sans-serif';
    x.fillText('🌲 Zagreb Park-Šuma Bingo', W / 2, 56);
    x.fillStyle = '#7fcfa3'; x.font = '20px system-ui, sans-serif';
    x.fillText(tr('share.imgSub', { name: name || tr('share.aForester'), emoji: st.tier.emoji, tier: tierName(st.tier) }), W / 2, 92);
    x.fillStyle = '#ffd56b'; x.font = 'bold 72px system-ui, sans-serif';
    x.fillText(st.count + ' / 24', W / 2, 168);
    x.fillStyle = '#7fcfa3'; x.font = '18px system-ui, sans-serif';
    x.fillText(tr('share.imgSwept', { swept: st.swept, ha: st.ha }), W / 2, 200);
    const cols = 12, r = 9, gap = 30, startX = W / 2 - (cols - 1) * gap / 2, startY = 240;
    NAMES.forEach((n, i) => {
      const cx = startX + (i % cols) * gap, cy = startY + Math.floor(i / cols) * gap;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fillStyle = set.has(n) ? '#2fae6f' : '#274d3e'; x.fill();
    });
    x.fillStyle = '#4e7a66'; x.font = '14px system-ui, sans-serif';
    x.fillText('markfili.github.io/park-suma · v' + APP_VERSION, W / 2, H - 16);
  }

  // ---- compose modal ----
  const share = document.getElementById('share');
  const nameInput = document.getElementById('shareName');
  const statsEl = document.getElementById('shareStats');
  const canvas = document.getElementById('shareCanvas');

  function refreshCompose() {
    const set = new Set(NAMES.filter(isVisited));
    statsEl.textContent = statsLine(stats(set));
    drawCard(canvas, (state.name || '').trim(), set);
  }
  function openCompose() { nameInput.value = state.name || ''; refreshCompose(); share.classList.add('show'); }
  function closeCompose() { share.classList.remove('show'); }

  nameInput.addEventListener('input', () => { state.name = nameInput.value.slice(0, 24); save(); refreshCompose(); });
  document.getElementById('shareCopy').addEventListener('click', () => {
    const url = shareUrl();
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast(tr('share.copied')))
      .catch(() => prompt(tr('share.copyPrompt'), url));
  });
  document.getElementById('shareNative').addEventListener('click', () => {
    const url = shareUrl();
    const text = tr('share.nativeText', { n: new Set(NAMES.filter(isVisited)).size });
    if (navigator.share) navigator.share({ title: 'Park-Šuma Bingo', text, url }).catch(() => {});
    else { navigator.clipboard && navigator.clipboard.writeText(url); toast(tr('share.copied')); }
  });
  document.getElementById('shareImg').addEventListener('click', () => {
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'park-suma-stats.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Park-Šuma Bingo' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'park-suma-stats.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast(tr('share.imgSaved'));
      }
    }, 'image/png');
  });
  document.getElementById('shareX').addEventListener('click', closeCompose);
  share.addEventListener('click', e => { if (e.target === share) closeCompose(); });
  document.getElementById('shareBtn').addEventListener('click', openCompose);

  // ---- incoming-link stats view ----
  let viewName = null, viewSet = null;
  function openView(name, set) {
    viewName = name; viewSet = set;
    const st = stats(set);
    document.getElementById('svTitle').textContent = tr('share.svTitle', { name: name || tr('share.aForester') });
    document.getElementById('svStats').textContent = statsLine(st);
    const dots = document.getElementById('svDots');
    dots.innerHTML = '';
    NAMES.forEach(n => { const d = document.createElement('span'); d.className = 'sv-dot' + (set.has(n) ? ' on' : ''); d.title = n; dots.appendChild(d); });
    document.getElementById('shareView').classList.add('show');
  }
  document.getElementById('svPlay').addEventListener('click', () => {
    document.getElementById('shareView').classList.remove('show');
    history.replaceState(null, '', location.pathname + location.search);
  });

  try {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (params.has('s')) openView(params.get('u') || '', decodeSet(params.get('s')));
  } catch (e) { /* ignore malformed link */ }

  // re-render in the new language
  window.shareRelabel = function () {
    if (share.classList.contains('show')) refreshCompose();
    if (document.getElementById('shareView').classList.contains('show') && viewSet) openView(viewName, viewSet);
  };
})();
