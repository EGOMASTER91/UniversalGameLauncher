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
    backupHistory: [],
    downloads: { items: [], summary: null },
    achievements: null,
    mods: null,
    settings: null,
    notifications: { unseen: 0, latest_ts: 0 },
    seenActivityTs: 0,
    view: 'home',
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

  function genGradient(name) {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const h1 = h % 360;
    const h2 = (h1 + 60 + (h >> 8) % 90) % 360;
    return `linear-gradient(135deg, hsl(${h1} 60% 22%), hsl(${h2} 50% 10%))`;
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

  function gameCover(game) {
    if (game.cover_url) {
      return `<img src="${escapeHTML(game.cover_url)}" alt="${escapeHTML(game.name)}" loading="lazy" onerror="this.style.display='none'"/>`;
    }
    return '';
  }

  function launcherName(id) {
    return (state.launchers.find(l => l.id === id) || {}).name || id || '';
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
      const progressPct = Math.min(100, Math.max(0, Math.round((g.playtime_minutes || 0) / 200 * 100)));
      return `
        <article class="card card-tall" data-game-id="${escapeHTML(g.id)}">
          <div class="card-art" style="background:${genGradient(g.name)}">
            ${gameCover(g)}
            <div class="card-overlay"></div>
            <button class="card-fav ${g.favorite ? 'active' : ''}" data-fav="${escapeHTML(g.id)}" title="Favorite">
              <svg viewBox="0 0 24 24" fill="${g.favorite ? 'currentColor' : 'none'}"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" stroke="currentColor" stroke-width="1.7"/></svg>
            </button>
            <div class="card-launcher launcher-pill ${meta.pill || ''}">${escapeHTML(launcherName(g.launcher))}</div>
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
      return `
        <article class="card-sm" data-game-id="${escapeHTML(g.id)}">
          <div class="card-sm-art" style="background:${genGradient(g.name)}">
            ${gameCover(g)}
            <span class="card-sm-launcher launcher-pill ${meta.pill || ''}">${escapeHTML(launcherName(g.launcher))}</span>
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
    if (tag) tag.textContent = `${launcherName(featured.launcher)} · ${featured.installed ? 'Continue Playing' : 'Cloud'}`;
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
          <span class="tag">${escapeHTML(launcherName(featured.launcher))}</span>
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
      download: {cls: 'activity-ic-launch', svg: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>'},
      mod: {cls: 'activity-ic-friend', svg: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/>'},
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
    const setVal = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };
    setVal('#backup-percent', `${b.percent}%`);
    const circle = $('#backup-ring-circle');
    if (circle) {
      const off = 314 - (314 * b.percent / 100);
      circle.style.strokeDashoffset = off;
    }
    setVal('#backup-last', fmtRelative(b.last_run_ts));
    setVal('#backup-protected', `${b.protected_count} / ${b.eligible_count}`);
    setVal('#backup-size', fmtBytes(b.cloud_size_bytes));
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

  // ---------- view-specific renderers ----------
  function renderDownloads() {
    const summary = state.downloads.summary || {};
    const items = state.downloads.items || [];
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('[data-dl-stat="active"]', summary.active || 0);
    set('[data-dl-stat="queued"]', summary.queued || 0);
    set('[data-dl-stat="speed"]', `${fmtBytes(summary.current_speed_bps || 0)}/s`);
    set('[data-dl-stat="remaining"]', fmtBytes(summary.remaining_bytes || 0));
    set('#downloads-sub', items.length
      ? `${summary.active} active · ${summary.queued} queued · ${summary.completed} completed`
      : 'No downloads queued');

    const host = $('#downloads-list');
    if (host) {
      if (!items.length) {
        host.innerHTML = '<div class="empty-state">No downloads yet. Pick a not-installed game from your library to queue one.</div>';
      } else {
        host.innerHTML = items.map(d => {
          const pct = d.size_bytes ? Math.min(100, Math.round(d.downloaded_bytes / d.size_bytes * 100)) : 0;
          const subParts = [];
          subParts.push(`${fmtBytes(d.downloaded_bytes)} / ${fmtBytes(d.size_bytes)}`);
          subParts.push(`${pct}%`);
          if (d.status === 'downloading') subParts.push(`${fmtBytes(d.speed_bps)}/s`);
          if (d.launcher) subParts.push(launcherName(d.launcher));
          const actions = [];
          if (d.status === 'downloading' || d.status === 'queued') {
            actions.push(`<button class="download-action-btn" data-dl-pause="${escapeHTML(d.id)}" title="Pause"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg></button>`);
          }
          if (d.status === 'paused') {
            actions.push(`<button class="download-action-btn" data-dl-resume="${escapeHTML(d.id)}" title="Resume"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7L7 5z"/></svg></button>`);
          }
          actions.push(`<button class="download-action-btn" data-dl-cancel="${escapeHTML(d.id)}" title="Cancel"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`);
          return `
            <div class="download-row">
              <div class="download-art" style="background:${genGradient(d.name)}">${d.cover_url ? `<img src="${escapeHTML(d.cover_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px;" onerror="this.style.display='none'"/>` : ''}</div>
              <div class="download-meta">
                <div class="download-title">${escapeHTML(d.name)}</div>
                <div class="download-sub">${subParts.map(p => `<span>${escapeHTML(p)}</span>`).join('')}</div>
                <div class="download-progress"><div class="download-progress-fill" style="width:${pct}%"></div></div>
              </div>
              <span class="download-status ${d.status}">${d.status}</span>
              <div class="download-actions">${actions.join('')}</div>
            </div>`;
        }).join('');
      }
    }

    const available = $('#downloads-available');
    if (available) {
      const cloudOnly = state.games.filter(g => !g.installed);
      const queuedIds = new Set(items.filter(d => d.status !== 'completed').map(d => d.game_id));
      const candidates = cloudOnly.filter(g => !queuedIds.has(g.id)).slice(0, 24);
      if (!candidates.length) {
        available.innerHTML = '<div class="empty-state">All games are installed or queued.</div>';
      } else {
        available.innerHTML = candidates.map(g => {
          const meta = LAUNCHER_META[g.launcher] || {};
          return `
            <article class="card-sm" data-game-id="${escapeHTML(g.id)}">
              <div class="card-sm-art" style="background:${genGradient(g.name)}">
                ${gameCover(g)}
                <span class="card-sm-launcher launcher-pill ${meta.pill || ''}">${escapeHTML(launcherName(g.launcher))}</span>
              </div>
              <div class="card-sm-info">
                <div class="card-sm-title">${escapeHTML(g.name)}</div>
                <div class="card-sm-meta">Not installed · ${fmtBytes(g.size_bytes || 12 * 1024 ** 3)}</div>
                <button class="btn btn-primary" style="margin-top:8px; width:100%;" data-download="${escapeHTML(g.id)}">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <span>Install</span>
                </button>
              </div>
            </article>`;
        }).join('');
      }
    }
  }

  function renderBackupsView() {
    const b = state.backupStatus || {};
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('[data-bk-stat="eligible"]', b.eligible_count || 0);
    set('[data-bk-stat="protected"]', b.protected_count || 0);
    set('[data-bk-stat="size"]', fmtBytes(b.cloud_size_bytes || 0));
    set('[data-bk-stat="last"]', fmtRelative(b.last_run_ts));

    const lastByGame = new Map();
    (state.backupHistory || []).forEach(h => {
      if (!lastByGame.has(h.game)) lastByGame.set(h.game, h);
    });

    const gameHost = $('#backups-game-list');
    if (gameHost) {
      const games = state.games.slice().sort((a, b) => a.name.localeCompare(b.name));
      if (!games.length) {
        gameHost.innerHTML = '<div class="empty-state">No games yet.</div>';
      } else {
        gameHost.innerHTML = games.map(g => {
          const last = lastByGame.get(g.name);
          const status = last ? 'protected' : (g.installed ? 'eligible' : 'skipped');
          const statusLabel = status === 'protected' ? `Protected · ${fmtRelative(last.ts)}` : status === 'eligible' ? 'Has save hints' : 'Not installed';
          return `
            <div class="backup-game-row">
              <div class="backup-game-info">
                <div class="backup-game-title">${escapeHTML(g.name)}</div>
                <div class="backup-game-paths">
                  <span>${escapeHTML(launcherName(g.launcher))}${last ? ` · ${fmtBytes(last.size_bytes)}` : ''}</span>
                </div>
              </div>
              <div class="backup-game-actions">
                <span class="backup-game-status ${status}">${escapeHTML(statusLabel)}</span>
                <button class="download-action-btn" data-backup-game="${escapeHTML(g.name)}" title="Backup now">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>`;
        }).join('');
      }
    }

    const histHost = $('#backup-history');
    if (histHost) {
      if (!state.backupHistory.length) {
        histHost.innerHTML = '<div class="empty-state">No backups have run yet.</div>';
      } else {
        histHost.innerHTML = state.backupHistory.map(h => `
          <div class="history-row">
            <div>
              <div class="history-title">${escapeHTML(h.game)}</div>
              <div class="history-sub">${escapeHTML(h.file)} · ${h.file_count} file${h.file_count === 1 ? '' : 's'}</div>
            </div>
            <span class="history-size">${fmtBytes(h.size_bytes)}</span>
            <span class="history-time">${fmtRelative(h.ts)}</span>
          </div>`).join('');
      }
      const sub = $('#backups-history-sub');
      if (sub) sub.textContent = `${state.backupHistory.length} entries`;
    }
  }

  function renderAchievementsView() {
    const a = state.achievements;
    if (!a) return;
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('[data-ach-stat="unlocked"]', a.total_unlocked);
    set('[data-ach-stat="possible"]', a.total_possible);
    set('[data-ach-stat="points"]', a.total_points);
    set('[data-ach-stat="completed"]', a.completed_games);
    set('#achievements-total', `${a.total_unlocked} / ${a.total_possible}`);
    set('#achievements-sub', `${a.tracked_games} games tracked · ${a.overall_percent}% complete`);

    const host = $('#achievement-list');
    if (!host) return;
    if (!a.games.length) {
      host.innerHTML = '<div class="empty-state">Play some games to start earning playtime milestones.</div>';
      return;
    }
    host.innerHTML = a.games.map(g => `
      <div class="ach-game-row" data-ach-game="${escapeHTML(g.game_id)}">
        <div class="ach-game-head">
          <div>
            <div class="ach-game-title">${escapeHTML(g.name)}</div>
            <div class="ach-game-sub">${escapeHTML(launcherName(g.launcher))} · ${g.unlocked_count} / ${g.total_count} unlocked · ${g.points} pts</div>
          </div>
          <span class="badge ${g.completion_percent >= 100 ? 'badge-good' : ''}">${g.completion_percent}%</span>
        </div>
        <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${g.completion_percent}%"></div></div>
        <div class="ach-items">
          ${g.items.map(it => `
            <div class="ach-item ${it.unlocked ? 'unlocked' : 'locked'}">
              <div class="ach-icon">
                <svg viewBox="0 0 24 24" fill="${it.unlocked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7">
                  <path d="M8 21h8M12 17v4M5 4h14l-1 11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3L5 4z" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="ach-info">
                <div class="ach-name">${escapeHTML(it.name)}</div>
                <div class="ach-desc">${escapeHTML(it.description)}</div>
                <div class="ach-points">${it.points} pts${it.unlocked ? ' · ' + fmtRelative(it.unlocked_ts) : ''}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('');
  }

  function renderModsView() {
    const m = state.mods;
    const set = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    set('[data-mod-stat="games"]', m ? m.games_with_mods : 0);
    set('[data-mod-stat="total"]', m ? m.total_mods : 0);
    set('[data-mod-stat="enabled"]', m ? m.total_enabled : 0);
    set('[data-mod-stat="size"]', fmtBytes(m ? m.total_size_bytes : 0));
    set('#mods-total', `${m ? m.total_mods : 0} mod${(m && m.total_mods === 1) ? '' : 's'}`);
    set('#mods-sub', m && m.games_with_mods
      ? `${m.games_with_mods} game${m.games_with_mods === 1 ? '' : 's'} with mods`
      : 'No mods detected. Default folders are scanned for known modding-friendly games.');

    const host = $('#mods-list');
    if (!host) return;
    if (!m || !m.games.length) {
      host.innerHTML = '<div class="empty-state">No mods detected. Mods are auto-detected for Skyrim SE, Stardew Valley, Cyberpunk 2077, BG3, Minecraft and more.</div>';
      return;
    }
    host.innerHTML = m.games.map(g => `
      <div class="mod-game-row" data-mod-game-row="${escapeHTML(g.game_id)}">
        <div class="mod-game-head">
          <div>
            <div class="mod-game-title">${escapeHTML(g.name)}</div>
            <div class="mod-game-sub">${escapeHTML(launcherName(g.launcher))} · ${g.enabled_count} / ${g.count} enabled · ${fmtBytes(g.size_bytes)}</div>
          </div>
          <button class="ach-game-action-btn" data-mod-expand="${escapeHTML(g.game_id)}">Manage</button>
        </div>
        <div class="mod-roots">${g.roots.map(r => `<span>${escapeHTML(r)}</span>`).join('')}</div>
        <div class="mod-items" data-mod-items="${escapeHTML(g.game_id)}" hidden></div>
      </div>`).join('');
  }

  async function renderSettingsView() {
    let cfg = state.settings;
    if (!cfg) {
      try { cfg = await api('/settings'); state.settings = cfg; }
      catch (e) { return; }
    }
    $$('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      const val = cfg[key];
      if (el.type === 'checkbox') el.checked = !!val;
      else if (el.type === 'number') el.value = val == null ? '' : val;
      else el.value = val == null ? '' : String(val);
    });
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
    if (state.filter === 'recent') arr = arr.filter(g => g.last_played_ts);
    if (state.search) {
      const q = state.search.toLowerCase();
      arr = arr.filter(g => g.name.toLowerCase().includes(q));
    }
    if (state.filter === 'recent' || state.sort === 'last_played') {
      arr.sort((a, b) => (b.last_played_ts || 0) - (a.last_played_ts || 0));
    } else if (state.sort === 'name') {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.sort === 'playtime') {
      arr.sort((a, b) => (b.playtime_minutes || 0) - (a.playtime_minutes || 0));
    }
    return arr;
  }

  // ---------- view switching ----------
  function setView(view) {
    state.view = view;
    const reusesHome = ['home', 'library', 'installed', 'favorites', 'recent'];
    const activePane = reusesHome.includes(view) ? 'home' : view;
    $$('.view').forEach(v => { v.hidden = v.dataset.viewPane !== activePane; });
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));

    if (view === 'home') { state.filter = 'all'; }
    else if (view === 'library') { state.filter = 'all'; }
    else if (view === 'installed') { state.filter = 'installed'; }
    else if (view === 'favorites') { state.filter = 'favorites'; }
    else if (view === 'recent') { state.filter = 'recent'; }
    $$('[data-filter]').forEach(c => c.classList.toggle('chip-active', c.dataset.filter === state.filter));

    if (reusesHome.includes(view)) {
      renderAllGames();
      renderRecent();
      renderHero();
    } else if (view === 'downloads') {
      loadDownloads().then(renderDownloads);
    } else if (view === 'backups') {
      loadBackupHistory().then(renderBackupsView);
    } else if (view === 'achievements') {
      loadAchievements().then(renderAchievementsView);
    } else if (view === 'mods') {
      loadMods().then(renderModsView);
    } else if (view === 'settings') {
      renderSettingsView();
    }
  }

  // ---------- data loaders ----------
  async function loadAll() {
    try {
      const [h, launchers, games, stats, storage, backupStatus, activity, notif] = await Promise.all([
        api('/health'),
        api('/launchers'),
        api('/games'),
        api('/stats'),
        api('/storage'),
        api('/backups/status'),
        api('/activity'),
        api('/notifications'),
      ]);
      $('#server-status').textContent = `Online · ${h.service} v${h.version}`;
      $('#server-dot').style.background = 'var(--good)';
      state.launchers = launchers.launchers;
      state.games = games.games;
      state.stats = stats;
      state.storage = storage;
      state.backupStatus = backupStatus;
      state.activity = activity.items;
      state.notifications = notif;
      updateNotificationsDot();
      renderAll();
    } catch (e) {
      $('#server-status').textContent = 'Backend offline';
      $('#server-dot').style.background = 'var(--bad)';
      console.error(e);
    }
  }

  async function loadDownloads() {
    try {
      state.downloads = await api('/downloads');
    } catch (e) { state.downloads = { items: [], summary: null }; }
  }

  async function loadBackupHistory() {
    try {
      const res = await api('/backups?limit=50');
      state.backupHistory = res.history || [];
    } catch (e) { state.backupHistory = []; }
  }

  async function loadAchievements() {
    try { state.achievements = await api('/achievements'); }
    catch (e) { state.achievements = null; }
  }

  async function loadMods() {
    try { state.mods = await api('/mods'); }
    catch (e) { state.mods = null; }
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

  function updateNotificationsDot() {
    const dot = $('#notif-dot');
    if (!dot) return;
    const latest = state.notifications.latest_ts || 0;
    const unseen = latest > state.seenActivityTs;
    dot.hidden = !unseen;
  }

  // ---------- event wiring ----------
  function wire() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view) setView(view);
      });
    });

    $$('.toggle-btn').forEach(b => {
      b.addEventListener('click', () => {
        $$('.toggle-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const mode = b.dataset.viewMode;
        const grid = $('#all-grid');
        if (grid) grid.classList.toggle('grid-list', mode === 'list');
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
          if (state.stats) state.stats.favorites += isFav ? -1 : 1;
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
          if (state.view === 'backups') { await loadBackupHistory(); renderBackupsView(); }
        } catch (err) { toast('Backup failed', 'bad'); }
        backupBtn.disabled = false;
        return;
      }

      const dlBtn = e.target.closest('[data-download]');
      if (dlBtn) {
        e.stopPropagation();
        const gid = dlBtn.dataset.download;
        dlBtn.disabled = true;
        try {
          await api('/downloads', { method: 'POST', body: { game_id: gid } });
          toast('Download queued', 'good');
          if (state.view === 'downloads') { await loadDownloads(); renderDownloads(); }
        } catch (err) { toast('Could not queue download', 'bad'); }
        dlBtn.disabled = false;
        return;
      }

      const dlPause = e.target.closest('[data-dl-pause]');
      if (dlPause) {
        try { await api(`/downloads/${encodeURIComponent(dlPause.dataset.dlPause)}/pause`, { method: 'POST', body: {} }); await loadDownloads(); renderDownloads(); }
        catch (err) { toast('Pause failed', 'bad'); }
        return;
      }
      const dlResume = e.target.closest('[data-dl-resume]');
      if (dlResume) {
        try { await api(`/downloads/${encodeURIComponent(dlResume.dataset.dlResume)}/resume`, { method: 'POST', body: {} }); await loadDownloads(); renderDownloads(); }
        catch (err) { toast('Resume failed', 'bad'); }
        return;
      }
      const dlCancel = e.target.closest('[data-dl-cancel]');
      if (dlCancel) {
        try { await api(`/downloads/${encodeURIComponent(dlCancel.dataset.dlCancel)}`, { method: 'DELETE' }); await loadDownloads(); renderDownloads(); }
        catch (err) { toast('Cancel failed', 'bad'); }
        return;
      }

      const modExpand = e.target.closest('[data-mod-expand]');
      if (modExpand) {
        const gid = modExpand.dataset.modExpand;
        const itemsEl = document.querySelector(`[data-mod-items="${gid}"]`);
        if (!itemsEl) return;
        if (!itemsEl.hidden) {
          itemsEl.hidden = true;
          modExpand.textContent = 'Manage';
          return;
        }
        modExpand.textContent = 'Loading...';
        try {
          const info = await api(`/mods/${encodeURIComponent(gid)}`);
          itemsEl.innerHTML = (info.mods || []).map(m => `
            <div class="mod-item ${m.enabled ? '' : 'disabled'}">
              <div>
                <div class="mod-item-name">${escapeHTML(m.name)}</div>
                <div class="mod-item-sub">${escapeHTML(m.kind)} · ${fmtBytes(m.size_bytes)} · ${fmtRelative(m.modified_ts)}</div>
              </div>
              <label class="switch">
                <input type="checkbox" ${m.enabled ? 'checked' : ''} data-mod-toggle="${escapeHTML(gid)}" data-mod-id="${escapeHTML(m.id)}" />
                <span class="switch-track"></span>
              </label>
            </div>`).join('') || '<div class="empty-state">No mods inside this game\'s mod folder.</div>';
          itemsEl.hidden = false;
          modExpand.textContent = 'Collapse';
        } catch (err) {
          toast('Could not load mods', 'bad');
          modExpand.textContent = 'Manage';
        }
        return;
      }

      const ach = e.target.closest('.ach-item');
      if (ach) {
        const row = e.target.closest('[data-ach-game]');
        if (!row) return;
        const gid = row.dataset.achGame;
        const aitems = $$('.ach-item', row);
        const idx = aitems.indexOf(ach);
        if (idx < 0) return;
        const data = state.achievements.games.find(g => g.game_id === gid);
        if (!data) return;
        const item = data.items[idx];
        try {
          const path = item.unlocked ? 'lock' : 'unlock';
          await api(`/achievements/${encodeURIComponent(gid)}/${path}`, { method: 'POST', body: { achievement_id: item.id, name: item.name, description: item.description, points: item.points } });
          await loadAchievements();
          renderAchievementsView();
        } catch (err) { toast('Could not toggle achievement', 'bad'); }
      }
    });

    document.addEventListener('change', async e => {
      const modToggle = e.target.closest('[data-mod-toggle]');
      if (modToggle) {
        const gid = modToggle.dataset.modToggle;
        const mid = modToggle.dataset.modId;
        const enabled = modToggle.checked;
        try {
          const res = await api(`/mods/${encodeURIComponent(gid)}/toggle`, { method: 'POST', body: { mod_id: mid, enabled } });
          if (!res.ok) {
            toast(res.reason || 'Toggle failed', 'bad');
            modToggle.checked = !enabled;
            return;
          }
          toast(`Mod ${enabled ? 'enabled' : 'disabled'}`, 'good');
          await loadMods();
        } catch (err) {
          toast('Toggle failed', 'bad');
          modToggle.checked = !enabled;
        }
      }
    });

    const runBackup = $('#run-backup-btn');
    if (runBackup) runBackup.addEventListener('click', () => runAllBackups(runBackup));
    const runAll = $('#backups-run-all');
    if (runAll) runAll.addEventListener('click', () => runAllBackups(runAll));

    const clearDl = $('#downloads-clear-btn');
    if (clearDl) clearDl.addEventListener('click', async () => {
      try {
        const res = await api('/downloads/clear', { method: 'POST', body: {} });
        toast(`Cleared ${res.removed} completed`, 'good');
        await loadDownloads(); renderDownloads();
      } catch (e) { toast('Clear failed', 'bad'); }
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

    const settingsSave = $('#settings-save');
    if (settingsSave) settingsSave.addEventListener('click', saveSettings);

    const notifBtn = document.querySelector('.icon-btn .dot-badge')?.closest('.icon-btn');
    if (notifBtn) notifBtn.addEventListener('click', () => {
      state.seenActivityTs = state.notifications.latest_ts || Math.floor(Date.now() / 1000);
      updateNotificationsDot();
    });

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

  async function runAllBackups(btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Running...`;
    btn.disabled = true;
    try {
      const res = await api('/backups/run', { method: 'POST', body: {} });
      toast(`Backup ran: ${res.ok}/${res.ran} games in ${res.duration_ms}ms`, res.ok ? 'good' : 'warn');
      await refreshLightweight();
      if (state.view === 'backups') { await loadBackupHistory(); renderBackupsView(); }
    } catch (e) { toast('Backup failed', 'bad'); }
    btn.disabled = false;
    btn.innerHTML = orig;
  }

  async function saveSettings() {
    const payload = {};
    $$('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (el.type === 'checkbox') payload[key] = el.checked;
      else if (el.type === 'number') payload[key] = Number(el.value) || 0;
      else payload[key] = el.value;
    });
    const status = $('#settings-status');
    try {
      const res = await api('/settings', { method: 'POST', body: payload });
      state.settings = res;
      if (status) { status.textContent = 'Saved'; status.className = 'settings-status ok'; }
      toast('Settings saved', 'good');
    } catch (e) {
      if (status) { status.textContent = 'Save failed'; status.className = 'settings-status err'; }
      toast('Could not save settings', 'bad');
    }
  }

  async function refreshLightweight() {
    try {
      const [stats, backupStatus, activity, storage, notif] = await Promise.all([
        api('/stats'), api('/backups/status'), api('/activity'), api('/storage'), api('/notifications'),
      ]);
      state.stats = stats;
      state.backupStatus = backupStatus;
      state.activity = activity.items;
      state.storage = storage;
      state.notifications = notif;
      updateNotificationsDot();
      renderStats(); renderBackup(); renderActivity(); renderStorage();
      if (state.view === 'downloads') { await loadDownloads(); renderDownloads(); }
    } catch (e) { /* ignore */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    wire();
    loadAll();
    setInterval(refreshLightweight, 15_000);
  });

  // Inject keyframes used inline
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
})();
