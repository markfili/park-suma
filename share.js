// Username + stats sharing — fully static, no backend.
// Progress is packed into the URL (24-bit mask -> base64url) and into a
// generated PNG. Reuses app.js globals: NAMES, isVisited, state, save,
// tierFor, DISTRICTS, APP_VERSION, toast.
(function () {
  // ---- encoding ----
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

  // ---- stats image (canvas) ----
  function drawCard(canvas, name, set) {
    const x = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b3d2e'); g.addColorStop(1, '#0a2c22');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.textAlign = 'center';

    const st = stats(set);
    x.fillStyle = '#b8f5d0'; x.font = 'bold 30px system-ui, sans-serif';
    x.fillText('🌲 Zagreb Park-Šuma Bingo', W / 2, 56);
    x.fillStyle = '#7fcfa3'; x.font = '20px system-ui, sans-serif';
    x.fillText((name || 'A forester') + ' · ' + st.tier.emoji + ' ' + st.tier.name, W / 2, 92);

    x.fillStyle = '#ffd56b'; x.font = 'bold 72px system-ui, sans-serif';
    x.fillText(st.count + ' / 24', W / 2, 168);
    x.fillStyle = '#7fcfa3'; x.font = '18px system-ui, sans-serif';
    x.fillText(st.swept + ' districts swept · ' + st.ha + ' ha explored', W / 2, 200);

    // 24 dots (visited = green)
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
    const st = stats(set);
    statsEl.textContent = `${st.count} / 24 · ${st.tier.emoji} ${st.tier.name} · ${st.swept} districts · ${st.ha} ha`;
    drawCard(canvas, (state.name || '').trim(), set);
  }
  function openCompose() {
    nameInput.value = state.name || '';
    refreshCompose();
    share.classList.add('show');
  }
  function closeCompose() { share.classList.remove('show'); }

  nameInput.addEventListener('input', () => {
    state.name = nameInput.value.slice(0, 24); save(); refreshCompose();
  });
  document.getElementById('shareCopy').addEventListener('click', () => {
    const url = shareUrl();
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast('🔗 Link copied'))
      .catch(() => prompt('Copy your stats link:', url));
  });
  document.getElementById('shareNative').addEventListener('click', () => {
    const url = shareUrl();
    const text = `My Zagreb Park-Šuma Bingo: ${new Set(NAMES.filter(isVisited)).size}/24 parks visited`;
    if (navigator.share) navigator.share({ title: 'Park-Šuma Bingo', text, url }).catch(() => {});
    else { navigator.clipboard && navigator.clipboard.writeText(url); toast('🔗 Link copied'); }
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
        toast('🖼 Image saved');
      }
    }, 'image/png');
  });
  document.getElementById('shareX').addEventListener('click', closeCompose);
  share.addEventListener('click', e => { if (e.target === share) closeCompose(); });
  document.getElementById('shareBtn').addEventListener('click', openCompose);

  // ---- incoming-link stats view ----
  function openView(name, set) {
    const st = stats(set), sv = document.getElementById('shareView');
    document.getElementById('svTitle').textContent = '👤 ' + (name || 'A forester') + '’s forest stats';
    document.getElementById('svStats').textContent =
      `${st.count} / 24 · ${st.tier.emoji} ${st.tier.name} · ${st.swept} districts · ${st.ha} ha`;
    const dots = document.getElementById('svDots');
    dots.innerHTML = '';
    NAMES.forEach(n => {
      const d = document.createElement('span');
      d.className = 'sv-dot' + (set.has(n) ? ' on' : '');
      d.title = n;
      dots.appendChild(d);
    });
    sv.classList.add('show');
  }
  document.getElementById('svPlay').addEventListener('click', () => {
    document.getElementById('shareView').classList.remove('show');
    history.replaceState(null, '', location.pathname + location.search);
  });

  // detect a shared link on load
  try {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (params.has('s')) openView(params.get('u') || '', decodeSet(params.get('s')));
  } catch (e) { /* ignore malformed link */ }
})();
