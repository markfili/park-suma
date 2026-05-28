// badges.js — collectible achievements ("bedževi"). Generalizes the existing
// milestone pattern (seenTiers/seenDistricts + celebrate()'s queued banners):
// each badge has a test(ctx) predicate; evaluateBadges() awards the newly-passing
// ones, persists them in state.badges, and pops the celebration banner. State-
// derived badges also award retroactively (silently) at load, so existing saves
// get credit. Reuses app.js globals: state, save, NAMES, BY_NAME, isVisited,
// visitedCount, todayISO, queueBanner, flushBanners — and tr() (i18n.js).
// Wrapped in an IIFE; exposes window.evaluateBadges / renderBadgesHtml /
// onFreeCellTap / badgeEmojisFor.
(function () {
  // Each: { id, emoji, secret?, test(ctx) }. ctx.event ∈ checkin | together | egg | init.
  // Time/honor/together/egg badges self-gate on the event, so they never fire on
  // 'init'; the coverage/count ones can award retroactively from a loaded save.
  const BADGES = [
    { id: 'firstStep', emoji: '🦵', test: () => visitedCount() >= 1 },
    { id: 'earlyBird', emoji: '🌅', test: c => c.event === 'checkin' && new Date().getHours() < 7 },
    { id: 'nightOwl',  emoji: '🦉', test: c => c.event === 'checkin' && new Date().getHours() >= 22 },
    { id: 'sprinter',  emoji: '⚡', test: () => NAMES.filter(n => state.visited[n] === todayISO()).length >= 3 },
    { id: 'giant',     emoji: '🌳', test: () => isVisited('Dotrščina') },   // largest, 311 ha
    { id: 'crumb',     emoji: '🌱', test: () => isVisited('Susedgrad') },   // smallest, 6.9 ha
    { id: 'honor',     emoji: '🤥', test: () => ((state.badgeStats && state.badgeStats.honor) || 0) >= 5 },
    { id: 'together',  emoji: '🤝', test: c => c.event === 'together' && c.players >= 2 },
    { id: 'hedgehog',  emoji: '🦔', secret: true, test: c => c.event === 'egg' },
  ];

  function earnedSet() { return new Set(Array.isArray(state.badges) ? state.badges : []); }

  function evaluateBadges(ctx) {
    ctx = ctx || { event: 'init' };
    if (!Array.isArray(state.badges)) state.badges = [];
    if (!state.badgeStats || typeof state.badgeStats !== 'object') state.badgeStats = {};
    let changed = false, awarded = false;
    // Cumulative counter: honor-mode (GPS off) check-ins, for the 🤥 badge.
    if (ctx.event === 'checkin' && ctx.on !== false && !ctx.gpsActive) {
      state.badgeStats.honor = (state.badgeStats.honor || 0) + 1;
      changed = true;
    }
    const have = earnedSet();
    BADGES.forEach(b => {
      if (have.has(b.id)) return;
      let ok = false; try { ok = !!b.test(ctx); } catch (e) {}
      if (!ok) return;
      state.badges.push(b.id); have.add(b.id); changed = true;
      if (ctx.event !== 'init' && !ctx.silent) {
        awarded = true;
        queueBanner(b.emoji, tr('badge.unlocked', { name: tr('badge.' + b.id + '.name') }), tr('badge.' + b.id + '.desc'));
      }
    });
    if (changed) save();
    if (awarded) flushBanners();
  }

  function renderBadgesHtml() {
    const have = earnedSet();
    const total = BADGES.length, got = BADGES.filter(b => have.has(b.id)).length;
    let html = '<div class="badge-count">' + tr('badge.count', { n: got, t: total }) + '</div><div class="badge-grid">';
    BADGES.forEach(b => {
      const owned = have.has(b.id), hide = b.secret && !owned;
      const emoji = hide ? '❓' : b.emoji;
      const name = hide ? '???' : tr('badge.' + b.id + '.name');
      const desc = hide ? tr('badge.secretHint') : tr('badge.' + b.id + '.desc');
      html += '<div class="badge' + (owned ? '' : ' locked') + '">' +
        '<div class="badge-emoji">' + emoji + '</div>' +
        '<div class="badge-name">' + name + '</div>' +
        '<div class="badge-desc">' + desc + '</div></div>';
    });
    return html + '</div>';
  }

  // 🦔 easter egg: tap the center free cell 7× in quick succession.
  let eggTaps = 0, eggTimer = null;
  function onFreeCellTap(cell) {
    eggTaps++;
    clearTimeout(eggTimer);
    eggTimer = setTimeout(() => { eggTaps = 0; }, 1400);
    if (eggTaps < 7) return;
    eggTaps = 0;
    if (cell) { cell.textContent = '🦔'; setTimeout(() => { cell.textContent = '🟢'; }, 2600); }
    evaluateBadges({ event: 'egg' });
  }

  window.evaluateBadges = evaluateBadges;
  window.renderBadgesHtml = renderBadgesHtml;
  window.onFreeCellTap = onFreeCellTap;
  window.badgeEmojisFor = function (ids) {
    if (!Array.isArray(ids)) return [];
    return BADGES.filter(b => ids.indexOf(b.id) !== -1).map(b => b.emoji);
  };

  // Retroactively credit state-derived badges from an existing save (silent).
  evaluateBadges({ event: 'init', silent: true });
})();
