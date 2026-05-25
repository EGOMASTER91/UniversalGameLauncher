// GameHub Launcher — frontend controller. Fetches all data from /api and renders it.
(() => {
  const API = '/api';

  const state = {
    games: [],
    launchers: [],
    activity: [],
    stats: null,
    storage: null,
    backupStatus: null,
    filter: 'all',
    sort: 'last_played',
    recentFilter: 'all',
    search: '',
  };

  const LAUNCHER_META = {
    steam:   { color: '#66c0f4', class: 'launcher-steam',  pill: 'launcher-pill-steam' },
    epic:    { color: '#ffffff', class: 'launcher-epic',   pill: 'launcher-pill-epic' },
    gog:     { color: '#c4a3ff', class: 'launcher-gog',    pill: 'launcher-pill-gog' },
    ubisoft: { color: '#4ec5ff', class: 'launcher-ubi',    pill: 'launcher-pill-ubi' },
    ea:      { color: '#ff5252', class: 'launcher-ea',     pill: 'launcher-pill-ea' },
    bnet:    { color: '#00aeff', class: 'launcher-bnet',   pill: 'launcher-pill-bnet' },
    xbox:    { color: '#4ade80', class: 'launcher-xbox',   pill: 'launcher-pill-xbox' },
    riot:    { color: '#d13639', class: 'launcher-riot',   pill: 'launcher-pill-riot' },
  };

  const LAUNCHER_ICONS = {
    steam: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 4.5 3 8.3 7.1 9.5l1.3-2c-.6-.2-1.2-.4-1.7-.7-.5-.4-.7-.9-.7-1.4 0-.3.1-.5.2-.8L8 16.4c.2.5.6 1 1.1 1.3.5.3 1.1.5 1.7.5 1 0 1.8-.3 2.5-1 .6-.7 1-1.5 1-2.5 0-.5-.1-1-.3-1.5l4.5-3.2c.4-.3.7-.6.9-1.1.2-.4.3-.9.3-1.4 0-1-.4-1.9-1.1-2.6S17 4 16 4c-1 0-1.9.3-2.5 1-.7.7-1 1.5-1 2.5L9 10c-.4-.1-.7-.2-1.1-.2-.5 0-1 .1-1.5.4l-2.6-1.3C4.6 5.3 8 2.5 12 2z"/></svg>',
    epic:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16v14l-2 2h-3l-1 2h-4l-1-2H6l-2-2V3zm2 2v10l1 1h10l1-1V5H6z"/></svg>',
    gog:   '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="#1A1A1F"/></svg>',
    ubisoft: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10c0-1.4-.3-2.7-.8-4l-1.8.9c.4 1 .6 2 .6 3.1a8 8 0 1 1-8-8c1.1 0 2.1.2 3.1.6L16 2.8C14.7 2.3 13.4 2 12 2zm-1 5v10h2V7h-2z"/></svg>',
    ea:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6l3 12h2.5L6 6H3zm6 0L7 18h9l1-2H10l.7-3H17l1-2h-7l.6-3H19l1-2H9z"/></svg>',
    bnet:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 6v6c0 5 3.5 9.3 8 10 4.5-.7 8-5 8-10V6l-8-4zm0 5l5 2.5v3c0 3.5-2.3 6.5-5 7-2.7-.5-5-3.5-5-7v-3L12 7z"/></svg>',
    xbox:  '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M7 7c2 1 3.5 2.5 5 4.5 1.5-2 3-3.5 5-4.5M7 17c2-1 3.5-2.5 5-4.5 1.5 2 3 3.5 5 4.5" stroke="#1A1A1F" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    riot:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4l3 14h12l3-14-5 4-4-6-4 6-5-4zm3 16h12v2H6v-2z"/></svg>',
  };

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function fmtBytes(b) {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0; let v = b;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
  }

  function fmtPlaytime(min) {
    if (!min) return '0h';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function fmtRelative(ts) {
    if (!ts) return 'Never';
    const now = Date.now() / 1000;
    const diff = now - ts;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)}w ago`;
    return new Date(ts * 1000).toLocaleDateString();
  }

  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', headers: {} };
    if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API + path, init);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function toast(msg, kind = 'info') {
    const stack = $('#toast-stack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = msg;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-in'));
    setTimeout(() => {
      el.classList.remove('toast-in');
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  // ---------- renderers ----------
  function renderLaunchers() {
    const host = $('#launchers-list');
    if (!host) return;
    if (!state.launchers.length) {
      host.innerHTML = '<div class="empty-mini">No launchers configured.</div>';
      return;
    }
    host.innerHTML = state.launchers.map(l => {
      const meta = LAUNCHER_META[l.id] || {};
      return `
        <div class="launcher-item ${l.detected ? '' : 'launcher-dim'}" data-launcher="${l.id}">
          <div class="launcher-ic ${meta.class || ''}">${LAUNCHER_ICONS[l.id] || ''}</div>
          <div class="launcher-meta">
            <div class="launcher-name">${escapeHTML(l.name)}</div>
            <div class="launcher-count">${l.detected ? `${l.game_count} game${l.game_count === 1 ? '' : 's'}` : 'Not detected'}</div>
          </div>
          <span class="launcher-status ${l.detected ? 'online' : 'offline'}"></span>
        </div>`;
    }).join('');
  }

  function gameCover(game, gradientFallback) {
    if (game.cover_url) {
      return `<img src="${escapeHTML(game.cover_url)}" alt="${escapeHTML(game.name)}" loading="lazy" onerror="this.style.display='none'"/>`;
    }
    return '';
  }

  function genGradient(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const h1 = h % 360;
    const h2 = (h1 + 60 + (h >> 8) % 90) % 360;
    return `linear-gradient(135deg, hsl(${h1} 60% 22%), hsl(${h2} 50% 10%))`;
  }

  function renderRecent() {
    const host = $('#recent-carousel');
    if (!host) return;
    const items = filteredRecent();
    if (!items.length) {
      host.innerHTML = '<div class="empty-state">No recently played games yet.</div>';
      return;
    }
    host.innerHTML = items.map(g => {
      const meta = LAUNCHER_META[g.launcher] || {};
      const launcherName = (state.launchers.find(l => l.id === g.launcher) || {}).name || g.launcher;
      const progressPct = Math.min(100, Math.max(0, Math.round((g.playtime_minutes || 0) / 200 * 100)));
      return `
        <article class="card card-tall" data-game-id="${escapeHTML(g.id)}">
          <div class="card-art" style="background:${genGradient(g.name)}">
            ${gameCover(g)}
            <div class="card-overlay"></div>
            <button class="card-fav ${g.favorite ? 'active' : ''}" data-fav="${escapeHTML(g.id)}" title="Favorite">
              <svg viewBox="0 0 24 24" fill="${g.favorite ? 'currentColor' : 'none'}"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" stroke="currentColor" stroke-width="1.7"/></svg>
            </button>
            <div class="card-launcher launcher-pill ${meta.pill || ''}">${escapeHTML(launcherName)}</div>
            <button class="card-play" data-launch="${escapeHTML(g.id)}" title="Launch">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7L7 5z"/></svg>
            </button>
            <div class="card-progress"><div class="card-progress-fill" style="width:${progressPct}%"></div></div>
          </div>
          <div class="card-info">
            <div class="card-title-row">
              <h3 class="card-title">${escapeHTML(g.name)}</h3>
              <span class="card-status ${g.installed ? 'installed' : ''}">●</span>
            </div>
            <div class="card-meta">
              <span>${fmtPlaytime(g.playtime_minutes)}</span>
              <span class="card-meta-dot">·</span>
              <span>${fmtRelative(g.last_played_ts)}</span>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function renderAllGames() {
    const host = $('#all-grid');
    if (!host) return;
    const items = filteredAll();
    const sub = $('#all-sub');
    if (sub) {
      const lc = new Set(state.games.map(g => g.launcher)).size;
      sub.textContent = `${state.games.length} games across ${lc} launcher${lc === 1 ? '' : 's'}`;
    }
    if (!items.length) {
      host.innerHTML = '<div class="empty-state">No games match the current filter. Connect a launcher to populate your library.</div>';
      return;
    }
    host.innerHTML = items.map(g => {
      const meta = LAUNCHER_META[g.launcher] || {};
      const launcherName = (state.launchers.find(l => l.id === g.launcher) || {}).name || g.launcher;
      return `
        <article class="card-sm" data-game-id="${escapeHTML(g.id)}">
          <div class="card-sm-art" style="background:${genGradient(g.name)}">
            ${gameCover(g)}
            <span class="card-sm-launcher launcher-pill ${meta.pill || ''}">${escapeHTML(launcherName)}</span>
            <span class="card-sm-installed" title="${g.installed ? 'Installed' : 'Cloud'}" style="color:${g.installed ? '#34D399' : '#a3a5b8'}">${g.installed ? '●' : '○'}</span>
          </div>
          <div class="card-sm-info">
            <div class="card-sm-title">${escapeHTML(g.name)}</div>
            <div class="card-sm-meta">${fmtPlaytime(g.playtime_minutes)} ${g.installed ? '· ' + fmtBytes(g.size_bytes) : '· Not installed'}</div>
          </div>
        </article>`;
    }).join('');
  }

  function renderHero() {
    const featured = state.games.slice().sort((a,b)=>(b.last_played_ts||0)-(a.last_played_ts||0))[0];
    const art = $('#hero-art');
    const title = $('#hero-title');
    const subtitle = $('#hero-subtitle');
    const stats = $('#hero-stats');
    const tag = $('#hero-tag');
    const actions = $('#hero-actions');
    const side = $('#hero-side');
    const heroEl = $('#hero');

    if (!featured) {
      if (art) { art.removeAttribute('src'); art.style.display='none'; }
      if (title) title.textContent = 'Welcome to GameHub';
      if (subtitle) subtitle.textContent = 'Connect a launcher to populate your library';
      if (stats) stats.innerHTML = '';
      if (tag) tag.textContent = 'No featured game';
      if (side) side.innerHTML = '';
      return;
    }

    if (heroEl) heroEl.style.background = genGradient(featured.name);
    if (art) {
      if (featured.cover_url) {
        art.src = featured.cover_url.replace('library_600x900_2x.jpg', 'library_hero.jpg');
        art.style.display = '';
        art.onerror = () => { art.style.display = 'none'; };
      } else {
        art.removeAttribute('src');
        art.style.display = 'none';
      }
    }
    const launcherName = (state.launchers.find(l => l.id === featured.launcher) || {}).name || featured.launcher;
    if (tag) tag.textContent = `${launcherName} · ${featured.installed ? 'Continue Playing' : 'Cloud'}`;
    if (title) title.textContent = featured.name;
    if (subtitle) subtitle.textContent = featured.installed ? (featured.install_dir || 'Installed') : 'Not installed';

    const backedUp = state.backupStatus && state.backupStatus.history_count > 0;
    if (stats) {
      stats.innerHTML = `
        <div class="hero-stat">
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          <span>${fmtPlaytime(featured.playtime_minutes)} played</span>
        </div>
        <div class="hero-stat">
          <svg viewBox="0 0 24 24" fill="none"><path d="M3 13l5-9 4 6 3-4 6 11H3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          <span>Last played ${fmtRelative(featured.last_played_ts)}</span>
        </div>
        ${backedUp ? `<div class="hero-stat hero-stat-good">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Save backed up</span>
        </div>` : ''}`;
    }
    if (actions) {
      actions.innerHTML = `
        <button class="btn btn-primary" data-launch="${escapeHTML(featured.id)}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7L7 5z"/></svg>
          <span>Play</span>
        </button>
        <button class="btn btn-secondary" data-backup-game="${escapeHTML(featured.name)}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span>Backup Save</span>
        </button>`;
    }
    if (side) {
      side.innerHTML = `
        <div class="hero-tags">
          <span class="tag">${escapeHTML(launcherName)}</span>
          ${featured.installed ? `<span class="tag">${fmtBytes(featured.size_bytes)}</span>` : ''}
          ${featured.favorite ? '<span class="tag">Favorite</span>' : ''}
        </div>`;
    }
  }

  function renderActivity() {
    const host = $('#activity-list');
    if (!host) return;
    if (!state.activity.length) {
      host.innerHTML = '<div class="empty-state">No activity yet. Launch a game or run a backup to populate.</div>';
      return;
    }
    const iconMap = {
      launch: {cls: 'activity-ic-launch', svg: '<path d="M7 5v14l12-7L7 5z" fill="currentColor"/>'},
      launch_failed: {cls: 'activity-ic-achievement', svg: '<path d="M12 8v5M12 16h.01M3 21h18L12 3 3 21z" stroke="currentColor" stroke-width="1.7" fill="none"/>'},
      backup: {cls: 'activity-ic-backup', svg: '<path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/><path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>'},
      backup_failed: {cls: 'activity-ic-achievement', svg: '<path d="M12 8v5M12 16h.01M3 21h18L12 3 3 21z" stroke="currentColor" stroke-width="1.7" fill="none"/>'},
      friend: {cls: 'activity-ic-friend', svg: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>'},
      achievement: {cls: 'activity-ic-achievement', svg: '<path d="M8 21h8M12 17v4M5 4h14l-1 11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3L5 4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" fill="none"/>'},
    };
    host.innerHTML = state.activity.slice(0, 6).map(a => {
      const ic = iconMap[a.kind] || iconMap.launch;
      return `
        <div class="activity-item">
          <div class="activity-ic ${ic.cls}">
            <svg viewBox="0 0 24 24">${ic.svg}</svg>
          </div>
          <div class="activity-body">
            <div class="activity-title">${escapeHTML(a.title)}</div>
            <div class="activity-time">${fmtRelative(a.ts)}${a.subtitle ? ' · ' + escapeHTML(a.subtitle) : ''}</div>
          </div>
        </div>`;
    }).join('');
  }

  function renderStats() {
    const s = state.stats;
    if (!s) return;
    const set = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };

    set('[data-stat="total"]', s.total_games);
    set('[data-stat="installed"]', s.installed);
    set('[data-stat="playtime"]', fmtPlaytime(s.total_playtime_minutes));
    set('[data-count="total"]', s.total_games);
    set('[data-count="installed"]', s.installed);
    set('[data-count="favorites"]', s.favorites);

    const trend = $('[data-stat="trend"]');
    if (trend && s.weekly) {
      const delta = s.weekly.delta_minutes || 0;
      const sign = delta >= 0 ? 'up' : 'down';
      trend.textContent = `${delta >= 0 ? '▲' : '▼'} ${fmtPlaytime(Math.abs(delta))} vs last week`;
      trend.className = `stat-trend stat-trend-${sign}`;
    }
    set('[data-stat="weekly-total"]', fmtPlaytime((s.weekly && s.weekly.week_total_minutes) || 0));

    const bars = $('#chart-bars');
    if (bars && s.weekly) {
      const max = Math.max(1, ...s.weekly.days.map(d => d.minutes));
      bars.innerHTML = s.weekly.days.map(d => {
        const pct = Math.max(6, Math.round(d.minutes / max * 100));
        return `<div class="chart-bar-wrap">
          <div class="chart-bar ${d.active ? 'chart-bar-active' : ''}" style="height:${pct}%" title="${d.minutes}m"></div>
          <span>${d.day}</span>
        </div>`;
      }).join('');
    }
  }

  function renderBackup() {
    const b = state.backupStatus;
    if (!b) return;
    $('#backup-percent').textContent = `${b.percent}%`;
    const circle = $('#backup-ring-circle');
    if (circle) {
      const off = 314 - (314 * b.percent / 100);
      circle.style.strokeDashoffset = off;
    }
    $('#backup-last').textContent = fmtRelative(b.last_run_ts);
    $('#backup-protected').textContent = `${b.protected_count} / ${b.eligible_count}`;
    $('#backup-size').textContent = fmtBytes(b.cloud_size_bytes);
    const badge = $('#backup-health');
    if (badge) {
      const labels = { good: 'Healthy', warn: 'Needs attention', bad: 'Action needed' };
      badge.textContent = b.eligible_count ? labels[b.health] : 'No saves';
      badge.className = `badge badge-${b.health}`;
    }
  }

  function renderStorage() {
    const s = state.storage;
    if (!s) return;
    const total = s.total_bytes;
    const used = s.used_bytes;
    const pct = total ? Math.round(used / total * 100) : 0;
    $('#storage-mini-value').textContent = `${fmtBytes(used)} / ${fmtBytes(total)}`;
    $('#storage-mini-fill').style.width = `${pct}%`;

    const usedParts = fmtBytes(used).split(' ');
    $('#storage-used').textContent = usedParts[0];
    $('#storage-used-unit').textContent = usedParts[1];
    $('#storage-total').textContent = `of ${fmtBytes(total)} used`;
    const root = $('#storage-root');
    if (root) root.textContent = s.root;

    const segHost = $('#storage-bar-lg');
    const legend = $('#storage-legend');
    if (segHost) {
      const segs = [
        { key: 'games', label: 'Games', color: 'linear-gradient(90deg,#8B5CF6,#A78BFA)', flat: '#8B5CF6' },
        { key: 'saves', label: 'Saves', color: 'linear-gradient(90deg,#3B82F6,#60A5FA)', flat: '#3B82F6' },
        { key: 'mods',  label: 'Mods',  color: 'linear-gradient(90deg,#06B6D4,#22D3EE)', flat: '#06B6D4' },
        { key: 'other', label: 'Other', color: 'linear-gradient(90deg,#4b5563,#6b7280)', flat: '#6b7280' },
      ];
      segHost.innerHTML = segs.map(s2 => {
        const bytes = (s.segments || {})[s2.key] || 0;
        const w = total ? Math.max(0.5, bytes / total * 100) : 0;
        if (!bytes) return '';
        return `<div class="storage-seg" style="width:${w}%; background:${s2.color}" title="${s2.label}: ${fmtBytes(bytes)}"></div>`;
      }).join('');
      legend.innerHTML = segs.filter(s2 => (s.segments || {})[s2.key]).map(s2 => {
        const bytes = s.segments[s2.key] || 0;
        return `<span><i style="background:${s2.flat}"></i>${s2.label} · ${fmtBytes(bytes)}</span>`;
      }).join('');
    }

    const cloud = $('#cloud-sync');
    if (cloud) cloud.style.display = s.cloud_synced ? '' : 'none';
  }

  // ---------- filtering ----------
  function filteredRecent() {
    const now = Date.now() / 1000;
    let arr = state.games.filter(g => g.last_played_ts);
    if (state.recentFilter === 'week') arr = arr.filter(g => (now - g.last_played_ts) < 86400 * 7);
    if (state.recentFilter === 'month') arr = arr.filter(g => (now - g.last_played_ts) < 86400 * 30);
    arr.sort((a, b) => (b.last_played_ts || 0) - (a.last_played_ts || 0));
    return arr.slice(0, 20);
  }

  function filteredAll() {
    let arr = state.games.slice();
    if (state.filter === 'installed') arr = arr.filter(g => g.installed);
    if (state.filter === 'favorites') arr = arr.filter(g => g.favorite);
    if (state.search) {
      const q = state.search.toLowerCase();
      arr = arr.filter(g => g.name.toLowerCase().includes(q));
    }
    if (state.sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === 'playtime') arr.sort((a, b) => (b.playtime_minutes || 0) - (a.playtime_minutes || 0));
    else arr.sort((a, b) => (b.last_played_ts || 0) - (a.last_played_ts || 0));
    return arr;
  }

  // ---------- data loaders ----------
  async function loadAll() {
    try {
      const [h, launchers, games, stats, storage, backupStatus, activity] = await Promise.all([
        api('/health'),
        api('/launchers'),
        api('/games'),
        api('/stats'),
        api('/storage'),
        api('/backups/status'),
        api('/activity'),
      ]);
      $('#server-status').textContent = `Online · ${h.service} v${h.version}`;
      $('#server-dot').style.background = 'var(--good)';
      state.launchers = launchers.launchers;
      state.games = games.games;
      state.stats = stats;
      state.storage = storage;
      state.backupStatus = backupStatus;
      state.activity = activity.items;
      renderAll();
    } catch (e) {
      $('#server-status').textContent = 'Backend offline';
      $('#server-dot').style.background = 'var(--bad)';
      console.error(e);
    }
  }

  function renderAll() {
    renderLaunchers();
    renderRecent();
    renderAllGames();
    renderHero();
    renderActivity();
    renderStats();
    renderBackup();
    renderStorage();
  }

  // ---------- event wiring ----------
  function wire() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        const view = item.dataset.view;
        if (view === 'installed') state.filter = 'installed';
        else if (view === 'favorites') state.filter = 'favorites';
        else state.filter = 'all';
        $$('[data-filter]').forEach(c => c.classList.toggle('chip-active', c.dataset.filter === state.filter));
        renderAllGames();
      });
    });

    $$('.toggle-btn').forEach(b => {
      b.addEventListener('click', () => {
        $$('.toggle-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

    $$('[data-filter]').forEach(c => {
      c.addEventListener('click', () => {
        state.filter = c.dataset.filter;
        $$('[data-filter]').forEach(x => x.classList.toggle('chip-active', x === c));
        renderAllGames();
      });
    });

    $$('[data-recent-filter]').forEach(c => {
      c.addEventListener('click', () => {
        state.recentFilter = c.dataset.recentFilter;
        $$('[data-recent-filter]').forEach(x => x.classList.toggle('chip-active', x === c));
        renderRecent();
      });
    });

    const sortSelect = $('#sort-select');
    if (sortSelect) sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      renderAllGames();
    });

    const search = $('#search-input');
    if (search) {
      let t;
      search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.search = search.value.trim();
          renderAllGames();
        }, 150);
      });
    }

    document.addEventListener('click', async e => {
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) {
        e.stopPropagation();
        const gid = favBtn.dataset.fav;
        const isFav = favBtn.classList.contains('active');
        try {
          await api(`/games/${encodeURIComponent(gid)}/favorite`, { method: 'POST', body: { favorite: !isFav } });
          const g = state.games.find(x => x.id === gid);
          if (g) g.favorite = !isFav;
          renderRecent();
          renderAllGames();
          state.stats.favorites += isFav ? -1 : 1;
          renderStats();
        } catch (err) { toast('Could not toggle favorite', 'bad'); }
        return;
      }

      const launchBtn = e.target.closest('[data-launch]');
      if (launchBtn) {
        e.stopPropagation();
        const gid = launchBtn.dataset.launch;
        try {
          const res = await api(`/games/${encodeURIComponent(gid)}/launch`, { method: 'POST', body: {} });
          if (res.ok) toast(`Launching...`, 'good');
          else toast(`Could not launch: ${res.error || 'unknown'}`, 'bad');
          state.activity = (await api('/activity')).items;
          renderActivity();
        } catch (err) { toast('Launch failed', 'bad'); }
        return;
      }

      const backupBtn = e.target.closest('[data-backup-game]');
      if (backupBtn) {
        e.stopPropagation();
        const game = backupBtn.dataset.backupGame;
        backupBtn.disabled = true;
        try {
          const res = await api('/backups/run', { method: 'POST', body: { game } });
          toast(res.ok ? `Backed up ${game}` : `No save path found for ${game}`, res.ok ? 'good' : 'warn');
          await refreshLightweight();
        } catch (err) { toast('Backup failed', 'bad'); }
        backupBtn.disabled = false;
      }
    });

    const runBackup = $('#run-backup-btn');
    if (runBackup) runBackup.addEventListener('click', async () => {
      const orig = runBackup.innerHTML;
      runBackup.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Running...`;
      runBackup.disabled = true;
      try {
        const res = await api('/backups/run', { method: 'POST', body: {} });
        toast(`Backup ran: ${res.ok}/${res.ran} games in ${res.duration_ms}ms`, res.ok ? 'good' : 'warn');
        await refreshLightweight();
      } catch (e) { toast('Backup failed', 'bad'); }
      runBackup.disabled = false;
      runBackup.innerHTML = orig;
    });

    const refreshBtn = $('#refresh-launchers');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = 'Syncing...';
      try {
        await api('/launchers/refresh', { method: 'POST', body: {} });
        await loadAll();
        toast('Launchers re-scanned', 'good');
      } catch (e) { toast('Sync failed', 'bad'); }
      refreshBtn.textContent = 'Sync';
    });

    const heroSync = $('#hero-sync-btn');
    if (heroSync) heroSync.addEventListener('click', () => $('#refresh-launchers').click());

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        $('#search-input').focus();
      }
    });

    const hero = $('#hero');
    if (hero) {
      hero.addEventListener('mousemove', e => {
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * 100;
        const y = (e.clientY - r.top) / r.height * 100;
        const noise = hero.querySelector('.hero-bg-noise');
        if (noise) {
          noise.style.background = `
            radial-gradient(circle at ${x}% ${y}%, rgba(139,92,246,0.5), transparent 50%),
            radial-gradient(circle at ${100-x}% ${100-y}%, rgba(59,130,246,0.35), transparent 50%)`;
        }
      });
    }
  }

  async function refreshLightweight() {
    try {
      const [stats, backupStatus, activity, storage] = await Promise.all([
        api('/stats'), api('/backups/status'), api('/activity'), api('/storage'),
      ]);
      state.stats = stats;
      state.backupStatus = backupStatus;
      state.activity = activity.items;
      state.storage = storage;
      renderStats(); renderBackup(); renderActivity(); renderStorage();
    } catch (e) { /* ignore */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    wire();
    loadAll();
    setInterval(refreshLightweight, 30_000);
  });

  // Inject keyframes used inline
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
})();
