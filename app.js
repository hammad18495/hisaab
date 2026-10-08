/* Hisaab 2.0 — UI */
(function () {
'use strict';
var DB = window.HisaabDB;
var ICONS = window.HISAAB_ICONS.ui, CAT_ICONS = window.HISAAB_ICONS.cats;
var APP_VERSION = '2.0';
var MONTHS = DB.MONTHS;

/* ================= small utils ================= */
var $ = function (id) { return document.getElementById(id); };
function store(k, v) {
  try {
    if (v === undefined) { var s = localStorage.getItem('hisaab.' + k); return s ? JSON.parse(s) : null; }
    if (v === null) localStorage.removeItem('hisaab.' + k); else localStorage.setItem('hisaab.' + k, JSON.stringify(v));
  } catch (e) { return null; }
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function money(n) { n = Number(n) || 0; var neg = n < 0; var s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (neg ? '−' : '') + 'Rs ' + s; }
function pad2(n) { return ('0' + n).slice(-2); }
function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function today() { return iso(new Date()); }
function nowKey() { var d = new Date(); return d.getFullYear() * 100 + d.getMonth() + 1; }
function keyName(key) { return MONTHS[key % 100 - 1] + " '" + String(Math.floor(key / 100)).slice(-2); }
function niceDate(s, long) {
  var p = String(s).split('-'); if (p.length !== 3) return s || 'No date';
  var d = new Date(+p[0], +p[1] - 1, +p[2]); var y = new Date(); y.setDate(y.getDate() - 1);
  var lbl = d.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' });
  if (s === today()) return 'Today' + (long ? ', ' + lbl : '');
  if (s === iso(y)) return 'Yesterday' + (long ? ', ' + lbl : '');
  return lbl;
}
function ago(ms) { if (!ms) return ''; var m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; }
function sum(arr) { return arr.reduce(function (a, q) { return a + Number(q.amount); }, 0); }
function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?'; }
function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || n; }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function ic(name, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24"><path d="' + (ICONS[name] || CAT_ICONS[name] || CAT_ICONS.tag) + '"/></svg>'; }
function cic(name, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24"><path d="' + (CAT_ICONS[name] || CAT_ICONS.tag) + '"/></svg>'; }
function hydrateIcons(root) {
  Array.prototype.forEach.call((root || document).querySelectorAll('svg[data-i]'), function (s) {
    var k = s.getAttribute('data-i'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = '<path d="' + (ICONS[k] || CAT_ICONS[k] || '') + '"/>'; s.removeAttribute('data-i');
  });
}
var LOGO = $('logoTpl').innerHTML;
hydrateIcons();
var GOOGLE_G = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
var native = window.AndroidBridge || null;
function haptic() { try { if (native && native.haptic) native.haptic(); else if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }

/* ================= theme ================= */
function applyTheme() {
  var t = store('theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  var dark = isDark();
  var meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', dark ? '#111412' : '#f8faf6');
}
function isDark() { var t = store('theme'); return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }

/* ================= state ================= */
var S = {
  user: null,
  sheets: store('sheets') || [],          // [{id, name, ownerName, ownerEmail, ownerPhoto, role:'owner'|'edit'|'view'}]
  activeId: store('active'),
  t: null, months: {}, cats: [],          // for the active sheet
  loading: false, error: null, sort: store('sort') || 'sheet',
  requests: [], suggestions: null
};
var queue = store('queue') || [];          // {id, sheetId, tab, category, amount, comment, date}
var recent = [];
function active() { return S.sheets.filter(function (s) { return s.id === S.activeId; })[0] || null; }
function canEdit() { var a = active(); return !!a && a.role !== 'view'; }
function isOwner() { var a = active(); return !!a && a.role === 'owner'; }
function saveSheets() { store('sheets', S.sheets); store('active', S.activeId); }
function cacheKey() { return 'cache.' + S.activeId; }
function saveCache() {
  if (!S.activeId) return;
  var names = Object.keys(S.months).sort(function (a, b) { return (S.months[b].viewedAt || 0) - (S.months[a].viewedAt || 0); });
  var keep = {}; names.forEach(function (n, i) { if (i < 5 || (S.t && n === S.t.current)) keep[n] = S.months[n]; });
  S.months = keep;
  store(cacheKey(), { t: S.t ? { months: S.t.months, summaries: S.t.summaries, current: S.t.current, meta: S.t.meta } : null, months: keep, cats: S.cats });
}
function loadCache() {
  var c = S.activeId ? store(cacheKey()) : null;
  S.t = c && c.t; S.months = (c && c.months) || {}; S.cats = (c && c.cats) || [];
}
function currentName() { return S.t && S.t.current; }
function tabInfo(name) { if (!S.t) return null; return S.t.months.concat(S.t.summaries).filter(function (m) { return m.name === name; })[0] || null; }
function catIcon(name) { var c = S.cats.filter(function (x) { return x.name === name; })[0]; return c ? c.icon : DB.guessIcon(name); }
function categoryNames(tab) {
  var base = S.cats.length ? S.cats.map(function (c) { return c.name; }) : [];
  var d = S.months[tab] || S.months[currentName()];
  if (!base.length && d) base = d.categories.map(function (c) { return c.label; });
  if (!base.length) base = DB.DEFAULT_CATEGORIES.map(function (c) { return c.name; });
  return base;
}
function pendingFor(name) { return queue.concat(recent).filter(function (q) { return q.sheetId === S.activeId && q.tab === name; }); }
function figures(name) {
  var d = S.months[name], info = tabInfo(name) || {};
  var pick = function (re) { return d ? (d.summary || []).filter(function (s) { return re.test(s.label); })[0] : null; };
  var inc = pick(/income/i), exp = pick(/expense/i), hand = pick(/hand|balance/i);
  var pend = sum(pendingFor(name));
  var income = inc ? inc.value : info.income, expenses = (exp ? exp.value : (info.expenses || 0)) + pend;
  var inHand = hand ? hand.value - pend : (info.inHand != null ? info.inHand - pend : (income != null ? income - expenses : null));
  return { income: income, incomeLabel: inc ? inc.label : 'Income', expenses: expenses, inHand: inHand, inHandLabel: hand ? hand.label : 'In hand' };
}

/* ================= ripple / snackbar ================= */
document.addEventListener('pointerdown', function (e) {
  var el = e.target.closest && e.target.closest('.rp'); if (!el || el.disabled) return;
  var r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
  var s = document.createElement('span'); s.className = 'ripple';
  s.style.width = s.style.height = size + 'px'; s.style.left = (e.clientX - r.left - size / 2) + 'px'; s.style.top = (e.clientY - r.top - size / 2) + 'px';
  el.appendChild(s); setTimeout(function () { s.remove(); }, 520);
}, { passive: true });
var snackT;
function snack(msg, action, onAction) {
  clearTimeout(snackT);
  var host = $('snackHost');
  host.innerHTML = '<div class="snack page-level" role="status"><div class="body-m">' + esc(msg) + '</div>' + (action ? '<button id="snackAct">' + esc(action) + '</button>' : '') + '</div>';
  if (action) $('snackAct').onclick = function () { host.innerHTML = ''; if (onAction) onAction(); };
  snackT = setTimeout(function () { host.innerHTML = ''; }, action ? 6000 : 3200);
}

/* ================= auth-aware calls ================= */
function guard(p) {
  return p.catch(function (e) {
    if (e && e.auth) { reauth(); throw e; }
    throw e;
  });
}
function reauth() {
  var last = store('silentAt') || 0;
  if (Date.now() - last < 60000) { showLogin('Please sign in again.'); return; }
  store('silentAt', Date.now());
  DB.login({ silent: true });
}

/* ================= navigation ================= */
var pageStack = [];
function pushPage(html, opts) {
  opts = opts || {};
  var el = document.createElement('section');
  el.className = 'page' + (opts.up ? ' up' : '');
  el.innerHTML = html;
  hydrateIcons(el);
  $('pages').appendChild(el);
  pageStack.push({ el: el, name: opts.name, onClose: opts.onClose });
  $('snackHost').innerHTML = '';
  Array.prototype.forEach.call(el.querySelectorAll('[data-back]'), function (b) { b.onclick = popPage; });
  Array.prototype.forEach.call(el.querySelectorAll('.scroller'), function (sc) {
    var bar = el.querySelector('.appbar');
    if (bar) sc.addEventListener('scroll', function () { bar.classList.toggle('lifted', sc.scrollTop > 4); }, { passive: true });
  });
  return el;
}
function popPage() {
  var p = pageStack.pop(); if (!p) return;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  p.el.classList.add('out');
  setTimeout(function () { p.el.remove(); }, 200);
  if (p.onClose) p.onClose();
}
function popAll() { while (pageStack.length) { var p = pageStack.pop(); p.el.remove(); } }
function findPage(name) { for (var i = pageStack.length - 1; i >= 0; i--) if (pageStack[i].name === name) return pageStack[i]; return null; }
function closeOverlay() {
  var o = $('overlay');
  var live = Array.prototype.filter.call(o.children, function (n) { return !n.classList.contains('out') && n.style.pointerEvents !== 'none'; });
  if (!live.length) return false;
  var d = o.querySelector('.drawer');
  if (d) {
    var sc = o.querySelector('.drawer-scrim'), nodes = [d, sc];
    d.classList.add('out'); sc.style.transition = 'opacity .18s'; sc.style.opacity = 0; sc.style.pointerEvents = 'none'; d.style.pointerEvents = 'none';
    setTimeout(function () { nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); }, 190);
  } else o.innerHTML = '';
  return true;
}
window.__onBack = function () {
  if (closeOverlay()) return true;
  if (pageStack.length) { popPage(); return true; }
  return false;
};
window.addEventListener('keydown', function (e) { if (e.key === 'Escape') window.__onBack(); });
// Browser/Android back button for the installed web app
history.replaceState({ root: true }, '');
history.pushState({ app: true }, '');
window.addEventListener('popstate', function () {
  if (window.__onBack()) history.pushState({ app: true }, '');
});
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && S.user && S.activeId) {
    var d = S.months[currentName()];
    if (!S.loading && (!d || Date.now() - (d.fetchedAt || 0) > 60000)) loadActive(); else flushQueue();
  }
});

/* pull to refresh */
function pullToRefresh(sc, ptr, action) {
  var startY = null, dist = 0, busy = false;
  sc.addEventListener('touchstart', function (e) { if (sc.scrollTop <= 0 && !busy) { startY = e.touches[0].clientY; dist = 0; ptr.style.transition = 'none'; } }, { passive: true });
  sc.addEventListener('touchmove', function (e) {
    if (startY == null) return;
    dist = Math.max(0, e.touches[0].clientY - startY);
    if (dist > 0 && sc.scrollTop <= 0) { var d = Math.min(dist * 0.5, 90); ptr.style.transform = 'translateY(' + (d - 60) + 'px) rotate(' + (d * 4) + 'deg)'; ptr.style.opacity = Math.min(1, d / 50); }
  }, { passive: true });
  sc.addEventListener('touchend', function () {
    if (startY == null) return; startY = null;
    ptr.style.transition = 'transform .2s, opacity .2s';
    if (dist * 0.5 > 60) {
      busy = true; haptic(); ptr.classList.add('spin'); ptr.style.transform = 'translateY(12px)';
      Promise.resolve(action()).catch(function () {}).then(function () { busy = false; ptr.classList.remove('spin'); ptr.style.transform = 'translateY(-60px)'; ptr.style.opacity = 0; });
    } else { ptr.style.transform = 'translateY(-60px)'; ptr.style.opacity = 0; }
  });
}

/* ================= boot: splash → intro → login → app ================= */
var splashShownAt = Date.now();
function hideSplash() {
  var left = Math.max(0, 1100 - (Date.now() - splashShownAt));
  return wait(left).then(function () { $('splash').classList.add('gone'); });
}
function boot() {
  applyTheme();
  var r = DB.handleRedirect();
  var auth = DB.getAuth();
  if (r && r.error) {
    var silentFail = /interaction_required|login_required|consent_required|account_selection_required/.test(r.error);
    hideSplash(); showLogin(silentFail ? '' : 'Sign-in was cancelled or failed (' + r.error + ').'); return;
  }
  if (r && r.ok) { store('silentAt', null); if (r.missingScopes.length) { hideSplash(); showLogin('Hisaab needs access to Google Sheets and Drive to keep your expenses. Please allow both.', true); return; } }
  if (!store('introDone') && !(auth && auth.token)) { hideSplash(); showIntro(); return; }
  if (!auth || !auth.token) { hideSplash(); showLogin(); return; }
  if (!DB.tokenValid()) {
    if (!navigator.onLine) { startApp(true); return; }
    if (Date.now() - (store('silentAt') || 0) < 60000) { hideSplash(); showLogin(); return; }
    store('silentAt', Date.now()); DB.login({ silent: true }); return;
  }
  startApp();
}

function showIntro() {
  var slides = [
    { img: null, title: 'Welcome to Hisaab', text: 'Your household expenses, kept simple. Every rupee you record goes straight into your own Google Sheet.' },
    { img: 'img/intro-home.jpg', title: 'Your month at a glance', text: 'See what’s in hand, what you’ve spent and your latest entries the moment you open the app.' },
    { img: 'img/intro-add.jpg', title: 'Add an expense in seconds', text: 'Pick a category, type the amount, add a note. Works offline too and syncs when you’re back online.' },
    { img: 'img/intro-month.jpg', title: 'Every month, every category', text: 'Browse any month’s daily expenses and category review, start a new month with one tap.' },
    { img: 'img/intro-share.jpg', title: 'Share with family', text: 'Give your partner or a relative view or edit access. You both see the same expenses on your own phones.' }
  ];
  var el = document.createElement('section'); el.className = 'flow'; el.id = 'intro';
  el.innerHTML = '<div class="intro-top"><button class="textbtn rp label-l" id="introSkip">Skip intro</button></div>' +
    '<div class="slides" id="slides">' + slides.map(function (s) {
      return '<div class="slide"><div class="shot">' + (s.img ? '<img src="' + s.img + '" alt="">' : '<div class="logo">' + LOGO + '</div>') + '</div><h2>' + esc(s.title) + '</h2><p>' + esc(s.text) + '</p></div>';
    }).join('') + '</div>' +
    '<div class="intro-foot"><div class="pager" id="pager">' + slides.map(function (s, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div>' +
    '<button class="btn filled rp" id="introNext">Next ' + ic('arrowR') + '</button></div>';
  document.body.appendChild(el);
  var sl = $('slides'), idx = 0;
  function sync() {
    idx = Math.round(sl.scrollLeft / sl.clientWidth);
    Array.prototype.forEach.call($('pager').children, function (d, i) { d.classList.toggle('on', i === idx); });
    $('introNext').innerHTML = idx === slides.length - 1 ? 'Get started' : 'Next ' + ic('arrowR');
  }
  sl.addEventListener('scroll', function () { clearTimeout(sl._t); sl._t = setTimeout(sync, 60); }, { passive: true });
  function done() { store('introDone', true); el.remove(); showLogin(); }
  $('introSkip').onclick = done;
  $('introNext').onclick = function () { if (idx >= slides.length - 1) return done(); sl.scrollTo({ left: (idx + 1) * sl.clientWidth, behavior: 'smooth' }); };
}

function showLogin(msg, consent) {
  var old = $('loginFlow'); if (old) old.remove();
  var el = document.createElement('section'); el.className = 'flow'; el.id = 'loginFlow';
  el.innerHTML = '<div class="login"><div class="logo">' + LOGO + '</div><h1>Hisaab</h1>' +
    '<p>Sign in with Google. Hisaab keeps your expenses in a Google Sheet in <b>your own</b> Google Drive — only you and the people you share with can see it.</p>' +
    '<button class="gbtn rp" id="gSignIn">' + GOOGLE_G + 'Continue with Google</button>' +
    (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
    '<div class="fine">Google may show “Google hasn’t verified this app”. Hisaab is a personal app, so tap <b>Advanced → Go to Hisaab</b>, then allow access to Sheets and Drive.<br><br><a href="privacy.html" style="color:inherit">Privacy</a></div></div>';
  document.body.appendChild(el);
  $('gSignIn').onclick = function () { haptic(); DB.login({ consent: !!consent }); };
}

function startApp(offline) {
  var a = DB.getAuth() || {};
  S.user = { email: a.email, name: a.name, picture: a.picture };
  loadCache();
  hideSplash();
  renderHome();
  if (offline) { S.error = 'You’re offline — showing saved data.'; renderHome(); return; }
  var who = a.email ? Promise.resolve(S.user) : guard(DB.me());
  who.then(function (u) {
    S.user = u;
    if (S.activeId) return null;
    return guard(DB.findOwnSheet()).then(function (f) {
      if (f) { addSheetFromFile(f, 'owner'); S.activeId = f.id; saveSheets(); loadCache(); }
    });
  }).then(function () {
    renderHome();
    if (S.activeId) loadActive(); else { loadSuggestions(); }
    checkRequests();
    refreshOwnerInfo();
  }).catch(function (e) { if (!e.auth) { S.error = e.message; renderHome(); } });
}
function addSheetFromFile(f, role) {
  var o = (f.owners || [])[0] || {};
  var rec = { id: f.id, name: f.name, ownerName: o.displayName || o.emailAddress || 'Unknown', ownerEmail: o.emailAddress || '', ownerPhoto: o.photoLink || '', role: role };
  var i = S.sheets.map(function (s) { return s.id; }).indexOf(f.id);
  if (i >= 0) S.sheets[i] = Object.assign(S.sheets[i], rec); else S.sheets.push(rec);
  saveSheets();
  return rec;
}
function refreshOwnerInfo() {
  var a = active(); if (!a) return;
  guard(DB.fileInfo(a.id)).then(function (f) {
    var role = (f.owners || []).some(function (o) { return o.me; }) ? 'owner' : (f.capabilities && f.capabilities.canEdit ? 'edit' : 'view');
    addSheetFromFile(f, role); renderHome();
  }).catch(function (e) {
    if (e.status === 404 || e.status === 403) { snack('You no longer have access to “' + a.name + '”.'); removeSheet(a.id); }
  });
}
function removeSheet(id) {
  S.sheets = S.sheets.filter(function (s) { return s.id !== id; });
  store('cache.' + id, null);
  if (S.activeId === id) { var own = S.sheets.filter(function (s) { return s.role === 'owner'; })[0] || S.sheets[0]; S.activeId = own ? own.id : null; }
  saveSheets(); loadCache(); renderHome(); if (S.activeId) loadActive();
}

/* ================= data loading ================= */
function acceptMonth(d) {
  recent = recent.filter(function (r) {
    if (r.sheetId !== S.activeId || r.tab !== d.tab) return true;
    return Date.now() - r.sentAt < 180000 && !(d.entries || []).some(function (e) { return e.category === r.category && Number(e.amount) === Number(r.amount) && e.date === r.date; });
  });
  d.viewedAt = Date.now();
  S.months[d.tab] = d;
}
var loadSeq = 0;
function loadActive() {
  if (!S.activeId) { renderHome(); return Promise.resolve(); }
  var id = S.activeId, seq = ++loadSeq;
  S.loading = true; S.error = null; renderHome();
  return guard(DB.tabs(id)).then(function (t) {
    if (seq !== loadSeq || id !== S.activeId) return;
    S.t = t;
    var cur = tabInfo(t.current);
    return Promise.all([
      cur ? guard(DB.month(id, cur)).then(acceptMonth) : null,
      guard(DB.getCategories(id, t)).then(function (c) { S.cats = c; })
    ]);
  }).then(function () {
    if (seq !== loadSeq) return;
    S.loading = false; saveCache(); renderHome(); refreshOpenPages();
    flushQueue();
  }).catch(function (e) {
    if (seq !== loadSeq) return;
    S.loading = false; if (!e.auth) S.error = e.message; renderHome();
  });
}
var monthLoads = {};
function loadMonth(name) {
  var id = S.activeId, k = id + '|' + name;
  if (monthLoads[k]) return monthLoads[k];
  var info = tabInfo(name); if (!info) return Promise.resolve();
  var p = guard(DB.month(id, info)).then(function (d) { delete monthLoads[k]; if (id !== S.activeId) return; acceptMonth(d); saveCache(); refreshOpenMonth(name); if (name === currentName()) renderHome(); })
    .catch(function (e) { delete monthLoads[k]; refreshOpenMonth(name, e.auth ? null : e.message); });
  monthLoads[k] = p; return p;
}
function loadSuggestions() {
  if (S.suggestions) return;
  guard(DB.suggestExisting()).then(function (f) { S.suggestions = f; renderHome(); }).catch(function () { S.suggestions = []; });
}
function checkRequests() {
  return guard(DB.sharedWithMe()).then(function (files) {
    S.requests = files; renderHome();
    var p = findPage('requests'); if (p) renderRequests(p.el);
  }).catch(function () {});
}
function newRequestCount() {
  var seen = store('seenRequests') || [];
  return S.requests.filter(function (f) { return !S.sheets.some(function (s) { return s.id === f.id; }) && seen.indexOf(f.id) < 0; }).length;
}

var flushing = false;
function flushQueue(manual) {
  var mine = queue.filter(function (q) { return q.sheetId === S.activeId; });
  if (flushing || !mine.length || !S.t) return Promise.resolve();
  flushing = true;
  var item = mine[0], info = tabInfo(item.tab);
  if (!info) { flushing = false; queue = queue.filter(function (q) { return q !== item; }); store('queue', queue); return Promise.resolve(); }
  return guard(DB.addEntry(S.activeId, info, item)).then(function (res) {
    queue = queue.filter(function (q) { return q.id !== item.id; }); store('queue', queue);
    recent.push(Object.assign({}, item, { row: res.row, sentAt: Date.now() }));
    flushing = false;
    if (queue.some(function (q) { return q.sheetId === S.activeId; })) return flushQueue(manual);
    renderHome(); refreshOpenMonth(item.tab);
    setTimeout(function () { loadMonth(item.tab); }, 1500);
  }).catch(function (e) {
    flushing = false; renderHome();
    if (!e.auth && (manual || !e.offline)) snack('Not synced yet: ' + e.message, 'Retry', function () { flushQueue(true); });
  });
}

/* ================= HOME ================= */
pullToRefresh($('homeScroll'), $('ptr-home'), function () { return Promise.all([loadActive(), checkRequests()]); });
$('homeScroll').addEventListener('scroll', function () { $('homeBar').classList.toggle('lifted', $('homeScroll').scrollTop > 4); }, { passive: true });
$('homeRefresh').onclick = function () { loadActive(); checkRequests(); };
$('homeMenu').onclick = openDrawer;

function ownerLine() {
  var a = active(), u = S.user || {};
  if (!a) return '<div class="ownerline"><div class="pic">' + (u.picture ? '<img src="' + esc(u.picture) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(u.name))) + '</div><div class="txt"><div class="title-s">' + esc(firstName(u.name) || 'Your') + '’s expenses</div><div class="body-s muted">' + esc(u.email || '') + '</div></div><span class="rolechip">' + ic('star') + 'New</span></div>';
  var mine = a.role === 'owner';
  var role = mine ? '<span class="rolechip">' + ic('account') + 'Owner</span>' : a.role === 'edit' ? '<span class="rolechip">' + ic('edit') + 'Can edit</span>' : '<span class="rolechip view">' + ic('eye') + 'View only</span>';
  var pic = a.ownerPhoto ? '<img src="' + esc(a.ownerPhoto) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(a.ownerName));
  return '<button class="ownerline rp" id="ownerLine" style="width:calc(100% - 32px);text-align:left"><div class="pic">' + pic + '</div><div class="txt"><div class="title-s">' + esc(firstName(a.ownerName)) + '’s expenses</div>' +
    '<div class="body-s muted">Owner: ' + esc(a.ownerName) + (mine ? ' (you)' : '') + '</div></div>' + role + '</button>';
}

function renderHome() {
  $('homeLoading').classList.toggle('hidden', !S.loading);
  var body = $('homeBody'); if (!body) return;
  var a = active(), cur = currentName(), d = cur && S.months[cur];
  var hr = new Date().getHours(), html = '';
  html += '<div class="greet"><div class="body-l muted">' + (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (S.user && S.user.name ? ', ' + esc(firstName(S.user.name)) : '') + '</div></div>';
  html += ownerLine();
  if (S.error) html += '<div class="banner err" style="margin-top:0;margin-bottom:12px">' + ic('cloudOff') + '<div class="body-m">' + esc(S.error) + '</div><button class="textbtn rp" id="retryBtn" style="color:inherit">Retry</button></div>';
  var pend = queue.filter(function (q) { return q.sheetId === S.activeId; }).length;
  if (pend) html += '<div class="banner" style="margin-top:0;margin-bottom:12px">' + ic('sync') + '<div class="body-m">' + pend + ' entr' + (pend > 1 ? 'ies' : 'y') + ' waiting to sync</div><button class="textbtn rp" id="syncBtn" style="color:inherit">Sync now</button></div>';

  var hasMonth = !!(a && S.t && S.t.months.length);
  if (a && !S.t && S.loading) {
    body.innerHTML = html + '<div style="padding:0 16px"><div class="skeleton" style="height:200px;border-radius:28px"></div>' + [1, 2, 3].map(function () { return '<div class="skeleton" style="height:84px;border-radius:20px;margin-top:12px"></div>'; }).join('') + '</div>';
    bindHome(); return;
  }
  if (hasMonth && d) {
    var f = figures(cur), neg = f.inHand != null && f.inHand < 0, ratio = f.income ? Math.min(f.expenses / f.income, 1) : 0;
    html += '<button class="mcard rp' + (neg ? ' neg' : '') + '" id="curCard">' +
      '<div class="top"><span class="chipish label-l">' + ic('cal') + esc(cur) + '</span><span class="label-m" style="opacity:.8">This month</span></div>' +
      '<div class="label-l" style="margin-top:16px;opacity:.85">' + esc(f.inHandLabel) + '</div>' +
      '<div class="display-s num">' + money(f.inHand != null ? f.inHand : f.expenses) + '</div>' +
      (f.income ? '<div class="progress" style="background:rgba(127,127,127,.25);margin-top:12px"><i style="width:' + (ratio * 100).toFixed(1) + '%;background:' + (neg ? 'var(--error)' : 'var(--on-primary-container)') + '"></i></div>' : '') +
      '<div class="split"><div><div class="label-m">' + esc(f.incomeLabel) + '</div><div class="title-m num">' + (f.income != null ? money(f.income) : '—') + '</div></div>' +
      '<div><div class="label-m">Spent</div><div class="title-m num">' + money(f.expenses) + '</div></div></div></button>';
  } else if (hasMonth) {
    html += '<div style="padding:0 16px"><div class="skeleton" style="height:200px;border-radius:28px"></div></div>';
  } else {
    html += '<div class="mcard"><div class="top"><span class="chipish label-l">' + ic('cal') + esc(keyName(nowKey())) + '</span></div>' +
      '<div class="title-m" style="margin-top:16px">No month sheet yet</div><div class="body-m" style="opacity:.85;margin-top:4px">' + (a && a.role !== 'owner' ? 'The owner hasn’t created a month yet.' : 'Create this month’s sheet to start recording expenses.') + '</div>' +
      '<div class="display-s num" style="margin-top:12px">Rs 0</div></div>';
  }
  var next = suggestNewMonth();
  if (hasMonth && canEdit() && next.key > ((tabInfo(cur) || {}).key || 0) && next.key <= nowKey()) {
    html += '<div class="banner" style="margin-top:12px">' + ic('info') + '<div class="body-m">It’s ' + MONTHS[nowKey() % 100 - 1] + ' — entries still go to ' + esc(cur) + ' until you create ' + esc(keyName(next.key)) + '.</div></div>';
  }
  if (!a && S.suggestions && S.suggestions.length) {
    var sg = S.suggestions[0];
    html += '<div class="suggest"><div class="row">' + ic('sheet') + '<div class="txt" style="flex:1"><div class="title-s">Already tracking expenses in Google Sheets?</div><div class="body-m muted">We found “' + esc(sg.name) + '” in your Drive.</div></div></div>' +
      '<div class="actions-row" style="padding:12px 0 0"><button class="btn tonal rp" id="useSuggest">' + ic('link') + 'Use this sheet</button></div></div>';
  }
  var addOk = hasMonth && canEdit(), createOk = !a || canEdit();
  html += '<div class="actionlist">' +
    '<button class="action primary rp" id="actAdd"' + (addOk ? '' : ' disabled') + '><div class="aic">' + ic('plus') + '</div><div class="txt"><div class="title-m">Add entry</div>' +
      (addOk ? '<div class="body-m">Category, amount and comments → ' + esc(cur) + '</div>' : '<div class="lockhint">' + ic('lock') + (a && !canEdit() ? 'You have view-only access' : 'Create a sheet for this month first') + '</div>') + '</div>' + ic('chevron', 'chev') + '</button>' +
    '<button class="action tonal rp" id="actView"><div class="aic">' + ic('calDay') + '</div><div class="txt"><div class="title-m">View monthly expenses</div><div class="body-m">' + (hasMonth ? S.t.months.length + ' month' + (S.t.months.length === 1 ? '' : 's') + ' in this sheet' : 'No expenses yet') + '</div></div>' + ic('chevron', 'chev') + '</button>' +
    '<button class="action outline rp" id="actCreate"' + (createOk ? '' : ' disabled') + '><div class="aic">' + ic('newMonth') + '</div><div class="txt"><div class="title-m">Create sheet for new month</div>' +
      (createOk ? '<div class="body-m">Start ' + esc(keyName(next.key)) + (hasMonth ? ' with the same categories' : '') + '</div>' : '<div class="lockhint">' + ic('lock') + 'Only people with edit access can do this</div>') + '</div>' + ic('chevron', 'chev') + '</button>' +
    '</div>';
  var catOk = a && canEdit();
  html += '<div class="section-h"><div class="title-s">Categories</div><div class="body-s muted">' + (S.cats.length ? S.cats.length + ' categories' : '') + '</div></div>' +
    '<div class="catbtns" style="padding-top:0"><button class="btn tonal rp" id="catAdd"' + (catOk ? '' : ' disabled') + '>' + ic('tagPlus') + 'Add category</button>' +
    '<button class="btn outlined rp" id="catRemove"' + (catOk ? '' : ' disabled') + '>' + ic('tagMinus') + 'Remove category</button></div>';
  if (hasMonth && d) {
    var rec = entriesFor(cur).slice(0, 5);
    html += '<div class="section-h"><div class="title-s">Recent in ' + esc(cur) + '</div>' + (rec.length ? '<button class="textbtn rp label-l" id="seeAll">See all</button>' : '') + '</div>';
    html += rec.length ? '<div class="card" style="margin:0 16px">' + rec.map(function (e, i) { return (i ? '<div class="divider"></div>' : '') + entryRow(e, 'r' + i); }).join('') + '</div>'
      : '<div class="card body-m muted" style="margin:0 16px;padding:20px 16px">No entries yet this month.' + (canEdit() ? ' Tap “Add entry” to record your first expense.' : '') + '</div>';
    html += '<div class="body-s muted" style="text-align:center;padding:20px 0 0">Synced ' + ago(d.fetchedAt) + ' · Pull down to refresh</div>';
    body.innerHTML = html;
    rec.forEach(function (e, i) { var b = body.querySelector('[data-e="r' + i + '"]'); if (b) b.onclick = function () { openDetail(e); }; });
  } else body.innerHTML = html;
  bindHome();
  var badge = $('menuBadge'), n = newRequestCount(); if (badge) { badge.textContent = n; badge.classList.toggle('hidden', !n); }
}
function bindHome() {
  var t, cur = currentName();
  if ((t = $('curCard')) && cur) t.onclick = function () { openMonth(cur); };
  if ((t = $('actAdd'))) t.onclick = function () { haptic(); openAdd({ tab: cur }); };
  if ((t = $('actView'))) t.onclick = function () { openPicker(); };
  if ((t = $('actCreate'))) t.onclick = function () { openCreate(); };
  if ((t = $('catAdd'))) t.onclick = function () { openAddCategory(); };
  if ((t = $('catRemove'))) t.onclick = function () { openRemoveCategory(); };
  if ((t = $('seeAll'))) t.onclick = function () { openMonth(cur, 'daily'); };
  if ((t = $('retryBtn'))) t.onclick = function () { S.activeId ? loadActive() : startApp(); };
  if ((t = $('syncBtn'))) t.onclick = function () { flushQueue(true); };
  if ((t = $('useSuggest'))) t.onclick = function () { connectSheet(S.suggestions[0].id); };
  if ((t = $('ownerLine'))) t.onclick = openDrawer;
}
function entriesFor(name) {
  var d = S.months[name] || {};
  var list = (d.entries || []).map(function (e) { return Object.assign({ tab: name }, e); });
  pendingFor(name).forEach(function (q) { list.push(Object.assign({ pending: queue.indexOf(q) >= 0, local: true }, q)); });
  list.sort(function (a, b) { return b.date > a.date ? 1 : b.date < a.date ? -1 : ((b.row || 1e9) - (a.row || 1e9)); });
  return list;
}
function entryRow(e, id) {
  return '<button class="li rp" style="width:100%;text-align:left" data-e="' + id + '"><div class="avatar">' + cic(catIcon(e.category)) + '</div>' +
    '<div class="txt"><div class="body-l">' + esc(e.category) + '</div><div class="body-m muted">' + (e.comment ? esc(e.comment) : '<span style="opacity:.6">No comment</span>') + (id.charAt(0) === 'r' ? ' · ' + esc(niceDate(e.date)) : '') + '</div></div>' +
    '<div class="trail title-m num">' + money(e.amount) + (e.pending ? '<span class="pendingdot">' + ic('sync') + '</span>' : '') + '</div></button>';
}

/* ================= DRAWER ================= */
function openDrawer() {
  var u = S.user || {}, a = active(), n = newRequestCount();
  var pic = u.picture ? '<img src="' + esc(u.picture) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(u.name));
  var sheetsHtml = S.sheets.map(function (s) {
    return '<button class="ditem rp' + (s.id === S.activeId ? ' on' : '') + '" data-sheet="' + esc(s.id) + '">' + ic(s.role === 'owner' ? 'sheet' : 'users') +
      '<span class="lbl">' + esc(s.role === 'owner' ? 'My expenses' : firstName(s.ownerName) + '’s expenses') + '<span class="sub">' + esc(s.role === 'owner' ? 'Owner' : s.role === 'edit' ? 'Shared · can edit' : 'Shared · view only') + '</span></span></button>';
  }).join('');
  $('overlay').innerHTML = '<div class="drawer-scrim" id="dScrimD"></div><nav class="drawer" role="dialog" aria-label="Menu">' +
    '<div class="who"><div class="pic">' + pic + '</div><div class="txt"><div class="title-m">' + esc(u.name || 'Signed in') + '</div><div class="body-s muted">' + esc(u.email || '') + '</div></div></div>' +
    (S.sheets.length ? '<div class="sect title-s">Expense sheets</div>' + sheetsHtml + '<hr>' : '') +
    '<button class="ditem rp" id="dTheme">' + ic(isDark() ? 'moon' : 'sun') + '<span class="lbl">Dark theme</span><span class="switch' + (isDark() ? ' on' : '') + '"></span></button>' +
    '<button class="ditem rp" id="dShare"' + (a && isOwner() ? '' : ' disabled style="opacity:.45"') + '>' + ic('share') + '<span class="lbl">Share your expenses<span class="sub">' + (a && isOwner() ? 'With a friend or relative' : a ? 'Only the owner can share' : 'Create your first month first') + '</span></span></button>' +
    '<button class="ditem rp" id="dRequests">' + ic('inbox') + '<span class="lbl">Sharing requests</span>' + (n ? '<span class="count">' + n + '</span>' : '') + '</button>' +
    '<hr>' +
    (S.sheets.some(function (s) { return s.role === 'owner'; }) ? '' : '<button class="ditem rp" id="dConnect">' + ic('link') + '<span class="lbl">Connect an existing sheet</span></button>') +
    (a ? '<a class="ditem rp" id="dOpenSheet" href="https://docs.google.com/spreadsheets/d/' + esc(a.id) + '/edit" target="_blank" rel="noopener">' + ic('open') + '<span class="lbl">Open in Google Sheets</span></a>' : '') +
    '<button class="ditem rp" id="dAbout">' + ic('info') + '<span class="lbl">About Hisaab</span></button>' +
    '<button class="ditem rp" id="dLogout">' + ic('logout') + '<span class="lbl">Sign out</span></button>' +
    '</nav>';
  hydrateIcons($('overlay'));
  $('dScrimD').onclick = closeOverlay;
  Array.prototype.forEach.call($('overlay').querySelectorAll('[data-sheet]'), function (b) {
    b.onclick = function () { switchSheet(b.getAttribute('data-sheet')); closeOverlay(); };
  });
  $('dTheme').onclick = function () { store('theme', isDark() ? 'light' : 'dark'); applyTheme(); haptic(); openDrawer(); };
  $('dShare').onclick = function () { if (!(a && isOwner())) return; closeOverlay(); openShare(); };
  $('dRequests').onclick = function () { closeOverlay(); openRequests(); };
  var c = $('dConnect'); if (c) c.onclick = function () { closeOverlay(); openConnect(); };
  $('dAbout').onclick = function () { closeOverlay(); dialog('Hisaab ' + APP_VERSION, 'Household expenses, kept simple.<br><br>Your data lives in a Google Sheet in your own Google Drive. Hisaab has no server and never stores your expenses anywhere else.', [{ label: 'OK' }]); };
  $('dLogout').onclick = function () {
    closeOverlay();
    dialog('Sign out?', 'Expenses already synced stay in your Google Sheet.' + (queue.length ? '<br><br><b>' + queue.length + ' unsynced entr' + (queue.length > 1 ? 'ies' : 'y') + ' on this phone will be lost.</b>' : ''),
      [{ label: 'Cancel' }, { label: 'Sign out', danger: true, run: function () {
        DB.logout();
        ['sheets', 'active', 'queue', 'seenRequests', 'silentAt'].forEach(function (k) { store(k, null); });
        S.sheets.forEach(function (s) { store('cache.' + s.id, null); });
        location.reload();
      } }]);
  };
}
function switchSheet(id) {
  if (id === S.activeId) return;
  S.activeId = id; saveSheets(); loadCache(); popAll(); renderHome(); loadActive(); refreshOwnerInfo();
  var s = active(); if (s) snack('Showing ' + (s.role === 'owner' ? 'your expenses' : firstName(s.ownerName) + '’s expenses'));
}

/* ================= SHARE ================= */
function openShare() {
  dialog('Share your expenses', '<div class="body-m" style="margin-bottom:16px">Enter the Gmail address of your friend or relative. They’ll sign in to Hisaab with that account.</div>' +
    '<div class="field" id="shWrap"><input id="shEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off"><label>Email address</label><div class="support" id="shErr"></div></div>',
    [{ label: 'Cancel' }, { label: 'Next', keep: true, run: function () {
      var email = $('shEmail').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('shWrap').classList.add('err'); $('shErr').textContent = 'Enter a valid email'; return; }
      if (S.user && email === String(S.user.email).toLowerCase()) { $('shWrap').classList.add('err'); $('shErr').textContent = 'That’s your own account'; return; }
      closeOverlay(); askAccess(email);
    } }]);
  var i = $('shEmail'); i.oninput = function () { i.parentNode.classList.toggle('filled', !!i.value); $('shWrap').classList.remove('err'); $('shErr').textContent = ''; };
  setTimeout(function () { i.focus(); }, 80);
}
function askAccess(email) {
  var role = 'edit';
  function body() {
    return '<div class="body-m" style="margin-bottom:8px;padding:0 24px">What can <b>' + esc(email) + '</b> do?</div>' +
      '<button class="opt rp' + (role === 'edit' ? ' on' : '') + '" data-r="edit"><span class="radio"></span><span class="txt"><span class="body-l" style="color:var(--on-surface);display:block">Can edit</span><span class="body-s">Add and delete entries, create months, manage categories</span></span></button>' +
      '<button class="opt rp' + (role === 'view' ? ' on' : '') + '" data-r="view"><span class="radio"></span><span class="txt"><span class="body-l" style="color:var(--on-surface);display:block">View only</span><span class="body-s">See your expenses and months, but can’t change anything</span></span></button>';
  }
  dialog('Choose access', body(), [{ label: 'Cancel' }, { label: 'Share', keep: true, run: function () {
    var btn = $('overlay').querySelector('[data-a="1"]'); btn.disabled = true; btn.textContent = 'Sharing…';
    guard(DB.share(S.activeId, email, role, S.user && S.user.name)).then(function () {
      closeOverlay(); haptic();
      snack('Shared with ' + email + ' (' + (role === 'edit' ? 'can edit' : 'view only') + '). They’ll see it under Sharing requests.');
    }).catch(function (e) { closeOverlay(); if (!e.auth) snack('Couldn’t share: ' + e.message); });
  } }], { list: true, noPad: true });
  function bind() {
    Array.prototype.forEach.call($('overlay').querySelectorAll('[data-r]'), function (b) {
      b.onclick = function () { role = b.getAttribute('data-r'); Array.prototype.forEach.call($('overlay').querySelectorAll('[data-r]'), function (x) { x.classList.toggle('on', x === b); }); };
    });
  }
  bind();
}

/* ================= SHARING REQUESTS ================= */
function openRequests() {
  var el = pushPage('<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Back"><svg class="i" data-i="back"></svg></button><div class="title title-l" style="padding-left:4px">Sharing requests</div>' +
    '<button class="iconbtn rp" data-act="refresh" aria-label="Refresh"><svg class="i" data-i="refresh"></svg></button></header><div class="linear" data-loading></div><div class="scroller"><div data-body style="padding-top:8px"></div></div>', { name: 'requests' });
  el.querySelector('[data-act=refresh]').onclick = function () { el.querySelector('[data-loading]').classList.remove('hidden'); checkRequests().then(function () { el.querySelector('[data-loading]').classList.add('hidden'); }); };
  renderRequests(el);
  checkRequests().then(function () { var l = el.querySelector('[data-loading]'); if (l) l.classList.add('hidden'); });
  store('seenRequests', S.requests.map(function (f) { return f.id; }));
}
function renderRequests(el) {
  var body = el.querySelector('[data-body]'); if (!body) return;
  if (!S.requests.length) { body.innerHTML = '<div class="empty">' + ic('inbox') + '<div class="title-m" style="color:var(--on-surface)">No sharing requests</div><div class="body-m" style="margin-top:6px">When someone shares their expenses with ' + esc((S.user && S.user.email) || 'you') + ', it shows up here.</div></div>'; return; }
  body.innerHTML = S.requests.map(function (f, i) {
    var o = (f.owners || [])[0] || {}, by = f.sharingUser || o;
    var opened = S.sheets.some(function (s) { return s.id === f.id; }), isActive = f.id === S.activeId;
    var can = f.capabilities && f.capabilities.canEdit;
    var pic = o.photoLink ? '<img src="' + esc(o.photoLink) + '" alt="" referrerpolicy="no-referrer">' : esc(initials(o.displayName || o.emailAddress));
    return '<div class="req"><div class="pic">' + pic + '</div><div class="txt"><div class="title-s">' + esc(by.displayName || by.emailAddress || 'Someone') + ' shared their expenses with you</div>' +
      '<div class="body-s muted" style="margin-top:2px">' + esc(o.emailAddress || '') + (f.sharedWithMeTime ? ' · ' + esc(new Date(f.sharedWithMeTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) : '') + '</div>' +
      '<div style="margin-top:8px"><span class="rolechip' + (can ? '' : ' view') + '">' + ic(can ? 'edit' : 'eye') + (can ? 'Edit access' : 'Read only') + '</span></div>' +
      '<div class="acts"><button class="btn ' + (isActive ? 'outlined' : 'filled') + ' rp" data-open="' + i + '"' + (isActive ? ' disabled' : '') + '>' + (isActive ? 'Showing now' : opened ? 'Switch to it' : 'Open on home') + '</button></div></div></div>';
  }).join('');
  Array.prototype.forEach.call(body.querySelectorAll('[data-open]'), function (b) {
    b.onclick = function () {
      var f = S.requests[+b.getAttribute('data-open')];
      addSheetFromFile(f, f.capabilities && f.capabilities.canEdit ? 'edit' : 'view');
      haptic(); switchSheet(f.id);
    };
  });
}

/* ================= CONNECT EXISTING SHEET ================= */
function openConnect() {
  dialog('Connect a sheet', '<div class="body-m" style="margin-bottom:16px">Paste the link of a Google Sheet you own that has month tabs (DATE · Category · Expense · Comments).</div>' +
    '<div class="field" id="cnWrap"><input id="cnUrl" autocomplete="off" autocapitalize="off"><label>Sheet link</label><div class="support" id="cnErr"></div></div>',
    [{ label: 'Cancel' }, { label: 'Connect', keep: true, run: function () {
      var m = /\/d\/([A-Za-z0-9_-]{20,})/.exec($('cnUrl').value) || /^([A-Za-z0-9_-]{25,})$/.exec($('cnUrl').value.trim());
      if (!m) { $('cnWrap').classList.add('err'); $('cnErr').textContent = 'That doesn’t look like a Google Sheets link'; return; }
      closeOverlay(); connectSheet(m[1]);
    } }]);
  var i = $('cnUrl'); i.oninput = function () { i.parentNode.classList.toggle('filled', !!i.value); };
  setTimeout(function () { i.focus(); }, 80);
}
function connectSheet(id) {
  snack('Connecting your sheet…');
  guard(DB.fileInfo(id)).then(function (f) {
    if (!(f.owners || []).some(function (o) { return o.me; })) throw new Error('You can only connect a sheet you own. Ask the owner to share it with you instead.');
    return guard(DB.markSheet(id)).then(function () { return guard(DB.tabs(id)); }).then(function (t) {
      return guard(DB.ensureSettings(id, t, S.user)).then(function () {
        addSheetFromFile(f, 'owner'); S.activeId = id; saveSheets(); loadCache();
        snack('Connected “' + f.name + '” · ' + t.months.length + ' months found');
        renderHome(); loadActive();
      });
    });
  }).catch(function (e) { if (!e.auth) snack('Couldn’t connect: ' + e.message); });
}

/* ================= MONTH PICKER ================= */
function openPicker() {
  var el = pushPage('<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Back"><svg class="i" data-i="back"></svg></button><div class="title title-l" style="padding-left:4px">Choose a month</div>' +
    '<button class="iconbtn rp" data-act="refresh" aria-label="Refresh"><svg class="i" data-i="refresh"></svg></button></header>' +
    '<div class="linear hidden" data-loading></div><div class="scroller"><div data-body></div></div>', { name: 'picker' });
  el.querySelector('[data-act=refresh]').onclick = function () { el.querySelector('[data-loading]').classList.remove('hidden'); loadActive().then(function () { el.querySelector('[data-loading]').classList.add('hidden'); renderPicker(el); }); };
  renderPicker(el);
}
function renderPicker(el) {
  var body = el.querySelector('[data-body]'); if (!body) return;
  if (!S.activeId || !S.t || !(S.t.months.length + S.t.summaries.length)) {
    body.innerHTML = '<div class="empty">' + ic('list') + '<div class="title-m" style="color:var(--on-surface)">No expenses found</div><div class="body-m" style="margin:6px 0 20px">Create a sheet for this month to start recording expenses.</div>' +
      (canEdit() || !S.activeId ? '<button class="btn filled rp" data-act="create">' + ic('newMonth') + 'Create sheet for ' + esc(keyName(suggestNewMonth().key)) + '</button>' : '') + '</div>';
    var c = body.querySelector('[data-act=create]'); if (c) c.onclick = function () { popPage(); openCreate(); };
    return;
  }
  var groups = {}, order = [], other = [];
  S.t.months.forEach(function (m) {
    if (!m.key) { other.push(m); return; }
    var y = Math.floor(m.key / 100); if (!groups[y]) { groups[y] = []; order.push(y); } groups[y].push(m);
  });
  var row = function (m) {
    var cur = m.name === S.t.current, short = m.key ? MONTHS[m.key % 100 - 1].slice(0, 3) : '•';
    var sub = m.expenses != null ? 'Spent ' + money(m.expenses) : 'Open to see details';
    var tag = m.inHand != null ? '<span class="tag ' + (m.inHand < 0 ? 'neg' : 'pos') + '">' + (m.inHand < 0 ? '−' : '+') + money(Math.abs(m.inHand)).replace('Rs ', '') + '</span>' : '';
    return '<button class="mrow rp' + (cur ? ' cur' : '') + '" data-m="' + esc(m.name) + '"><div class="mav">' + esc(short) + '</div><div class="txt"><div class="body-l">' + esc(m.name) + (cur ? '<span class="tag cur">Current</span>' : '') + '</div><div class="body-m muted num">' + sub + tag + '</div></div>' + ic('chevron', 'chev') + '</button>';
  };
  var html = '';
  order.forEach(function (y) { html += '<div class="yearhead title-s">' + y + '</div><div class="card" style="margin:0 16px">' + groups[y].map(row).join('<div class="divider"></div>') + '</div>'; });
  if (S.t.summaries.length) html += '<div class="yearhead title-s">Yearly summaries</div><div class="card" style="margin:0 16px">' + S.t.summaries.map(function (m) {
    return '<button class="mrow rp" data-m="' + esc(m.name) + '"><div class="mav">' + ic('chart') + '</div><div class="txt"><div class="body-l">' + esc(m.name) + '</div><div class="body-m muted">Totals by category</div></div>' + ic('chevron', 'chev') + '</button>';
  }).join('<div class="divider"></div>') + '</div>';
  if (other.length) html += '<div class="yearhead title-s">Other tabs</div><div class="card" style="margin:0 16px">' + other.map(row).join('<div class="divider"></div>') + '</div>';
  body.innerHTML = html + '<div style="height:24px"></div>';
  Array.prototype.forEach.call(body.querySelectorAll('[data-m]'), function (b) { b.onclick = function () { openMonth(b.getAttribute('data-m')); }; });
}
function refreshOpenPages() {
  pageStack.forEach(function (p) {
    if (p.name === 'picker') renderPicker(p.el);
    if (p.name === 'month') renderMonth(p.el);
  });
}

/* ================= MONTH VIEW ================= */
function openMonth(name, view) {
  var isSummary = S.t && S.t.summaries.some(function (s) { return s.name === name; });
  var el = pushPage(
    '<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Back"><svg class="i" data-i="back"></svg></button>' +
    '<div class="title title-l" style="padding-left:4px">' + esc(name) + '</div><button class="iconbtn rp" data-act="refresh" aria-label="Refresh"><svg class="i" data-i="refresh"></svg></button></header>' +
    '<div class="linear hidden" data-loading></div>' +
    (isSummary ? '' : '<div class="tabs"><button class="rp title-s" data-view="overview">Overview</button><button class="rp title-s" data-view="daily">Daily expenses</button></div>') +
    '<div class="ptr" style="top:' + (isSummary ? 64 : 112) + 'px"><div class="spinner"></div></div><div class="scroller" data-scroll><div data-body></div></div>' +
    (isSummary || !canEdit() ? '' : '<button class="fab rp mv" data-act="add" aria-label="Add entry"><svg class="i" data-i="plus"></svg><span class="fab-label label-l">Add entry</span></button>'),
    { name: 'month' });
  var st = { name: name, view: view || 'overview', filter: 'All', q: '', isSummary: isSummary, error: null };
  el._st = st;
  Array.prototype.forEach.call(el.querySelectorAll('[data-view]'), function (b) { b.onclick = function () { st.view = b.getAttribute('data-view'); el.querySelector('[data-scroll]').scrollTop = 0; renderMonth(el); }; });
  el.querySelector('[data-act=refresh]').onclick = function () { setLoading(el, true); loadMonth(name); };
  var fab = el.querySelector('[data-act=add]'); if (fab) fab.onclick = function () { haptic(); openAdd({ tab: name }); };
  var sc = el.querySelector('[data-scroll]');
  if (fab) sc.addEventListener('scroll', function () { fab.classList.toggle('small', sc.scrollTop > 40); }, { passive: true });
  pullToRefresh(sc, el.querySelector('.ptr'), function () { return loadMonth(name); });
  renderMonth(el);
  var d = S.months[name];
  if (!d || Date.now() - (d.fetchedAt || 0) > 20000) { setLoading(el, true); loadMonth(name); }
}
function setLoading(el, on) { var l = el.querySelector('[data-loading]'); if (l) l.classList.toggle('hidden', !on); }
function refreshOpenMonth(name, err) {
  pageStack.forEach(function (p) { if (p.name === 'month' && p.el._st.name === name) { p.el._st.error = err || null; setLoading(p.el, false); renderMonth(p.el); if (err) snack(err); } });
}
function renderMonth(el) {
  var st = el._st, d = S.months[st.name], body = el.querySelector('[data-body]');
  Array.prototype.forEach.call(el.querySelectorAll('[data-view]'), function (b) { b.classList.toggle('on', b.getAttribute('data-view') === st.view); });
  if (!d) {
    body.innerHTML = st.error ? '<div class="empty">' + ic('cloudOff') + '<div class="title-m" style="color:var(--on-surface)">Couldn’t open ' + esc(st.name) + '</div><div class="body-m" style="margin-top:6px">' + esc(st.error) + '</div></div>'
      : '<div style="padding:16px"><div class="skeleton" style="height:170px;border-radius:28px"></div><div class="skeleton" style="height:420px;margin-top:16px"></div></div>';
    return;
  }
  if (st.isSummary || d.isSummary) return renderSummary(el, d);
  if (st.view === 'daily') return renderDaily(el, d);
  var f = figures(st.name), neg = f.inHand != null && f.inHand < 0, html = '', ratio = f.income ? Math.min(f.expenses / f.income, 1) : 0;
  html += '<div class="hero' + (neg ? ' neg' : '') + '" style="margin-top:16px"><div class="row"><div class="label-l">' + esc(f.inHandLabel) + '</div>' + (st.name === currentName() ? '<span class="label-m" style="opacity:.8">Current month</span>' : '') + '</div>' +
    '<div class="amt display-s num">' + money(f.inHand != null ? f.inHand : f.expenses) + '</div>' +
    (f.income ? '<div class="progress" style="background:rgba(127,127,127,.25);margin:0 0 12px"><i style="width:' + (ratio * 100).toFixed(1) + '%;background:' + (neg ? 'var(--error)' : 'var(--on-primary-container)') + '"></i></div>' : '') +
    (f.income ? '<span class="assist label-l">' + ic(neg ? 'trendDown' : 'trendUp') + (neg ? 'Over by ' + money(-f.inHand) : Math.round(ratio * 100) + '% of income spent') + '</span>' : '') + '</div>';
  html += '<div class="tiles">' + (f.income != null ? '<button class="tile rp" data-act="income"' + (canEdit() ? '' : ' disabled') + '><div class="label-m">' + esc(f.incomeLabel) + (canEdit() ? ' ' + ic('edit') : '') + '</div><div class="title-l num">' + money(f.income) + '</div></button>' : '') +
    '<button class="tile rp" data-act="spent"><div class="label-m">Spent · ' + entriesFor(st.name).length + ' entries</div><div class="title-l num">' + money(f.expenses) + '</div></button></div>';
  var pend = pendingFor(st.name);
  var cats = (d.categories || []).map(function (c) { return { label: c.label, value: c.value + sum(pend.filter(function (q) { return q.category === c.label; })) }; });
  if (cats.length) {
    var total = cats.reduce(function (a, c) { return a + c.value; }, 0), max = Math.max.apply(null, cats.map(function (c) { return c.value; }).concat([1]));
    if (S.sort === 'amount') cats.sort(function (a, b) { return b.value - a.value; });
    html += '<div class="section-h"><div class="title-s">Category expenses review</div><div class="seg"><button class="rp label-l' + (S.sort === 'sheet' ? ' on' : '') + '" data-sort="sheet">' + (S.sort === 'sheet' ? ic('check') : '') + 'Sheet</button><button class="rp label-l' + (S.sort === 'amount' ? ' on' : '') + '" data-sort="amount">' + (S.sort === 'amount' ? ic('check') : '') + 'Top</button></div></div>';
    html += '<div class="card" style="margin:0 16px">' + cats.map(function (c, i) {
      var pct = total ? Math.round(c.value / total * 100) : 0;
      return (i ? '<div class="divider"></div>' : '') + '<button class="li rp" style="width:100%;text-align:left" data-cat="' + esc(c.label) + '"><div class="avatar">' + cic(catIcon(c.label)) + '</div>' +
        '<div class="txt"><div class="body-l">' + esc(c.label) + '</div><div class="progress"><i style="width:' + (c.value / max * 100).toFixed(1) + '%"></i></div></div>' +
        '<div class="trail"><div class="title-s num"' + (c.value ? '' : ' style="color:var(--on-surface-variant);font-weight:400"') + '>' + money(c.value) + '</div><div class="body-s muted num">' + (c.value ? pct + '%' : '—') + '</div></div></button>';
    }).join('') + '</div>';
  }
  (d.sections || []).forEach(function (s) {
    html += '<div class="section-h"><div class="title-s">' + esc(s.title) + '</div><div class="title-s num">' + (s.total != null ? money(s.total) : '') + '</div></div>' +
      '<div class="card" style="margin:0 16px">' + (s.items.length ? s.items.map(function (it, i) {
        return (i ? '<div class="divider"></div>' : '') + '<div class="li two"><div class="avatar" style="background:var(--tertiary-container);color:var(--on-tertiary-container)">' + cic(DB.guessIcon(it.label)) + '</div><div class="txt"><div class="body-l" style="text-transform:capitalize">' + esc(it.label) + '</div></div><div class="trail title-s num">' + money(it.value) + '</div></div>';
      }).join('') : '<div class="li two muted body-m">No claims this month</div>') + '</div>';
  });
  html += '<div class="body-s muted" style="text-align:center;padding:20px 0 0">Synced ' + ago(d.fetchedAt) + '</div>';
  body.innerHTML = html;
  var t;
  if ((t = body.querySelector('[data-act=income]')) && canEdit()) t.onclick = function () { openIncome(st.name, f); };
  body.querySelector('[data-act=spent]').onclick = function () { st.view = 'daily'; st.filter = 'All'; renderMonth(el); };
  Array.prototype.forEach.call(body.querySelectorAll('[data-sort]'), function (b) { b.onclick = function () { S.sort = b.getAttribute('data-sort'); store('sort', S.sort); renderMonth(el); }; });
  Array.prototype.forEach.call(body.querySelectorAll('[data-cat]'), function (b) { b.onclick = function () { st.view = 'daily'; st.filter = b.getAttribute('data-cat'); el.querySelector('[data-scroll]').scrollTop = 0; renderMonth(el); }; });
}
function renderDaily(el, d) {
  var st = el._st, body = el.querySelector('[data-body]'), entries = entriesFor(st.name);
  var present = []; entries.forEach(function (e) { if (present.indexOf(e.category) < 0) present.push(e.category); });
  var order = categoryNames(st.name); present.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
  var chips = ['All'].concat(present); if (chips.indexOf(st.filter) < 0) chips.splice(1, 0, st.filter);
  var q = st.q.trim().toLowerCase();
  var rows = entries.filter(function (e) { return (st.filter === 'All' || e.category === st.filter) && (!q || (e.comment + ' ' + e.category).toLowerCase().indexOf(q) >= 0); });
  var html = '<div class="searchinline">' + ic('search') + '<input type="search" data-search placeholder="Search comments" value="' + esc(st.q) + '" autocomplete="off">' + (st.q ? '<button class="iconbtn rp" data-clear style="width:40px;height:40px">' + ic('close') + '</button>' : '') + '</div>' +
    '<div class="chips" data-chips>' + chips.map(function (c) { return '<button class="chip rp label-l' + (c === st.filter ? ' on' : '') + '" data-f="' + esc(c) + '">' + (c === st.filter ? ic('check') : '') + esc(c) + '</button>'; }).join('') + '</div>';
  if (!rows.length) html += '<div class="empty">' + ic(q ? 'search' : 'list') + '<div class="title-m" style="color:var(--on-surface)">' + (entries.length ? 'No expenses match' : 'No expenses found') + '</div>' + (entries.length ? '' : '<div class="body-m" style="margin-top:6px">Nothing recorded in ' + esc(st.name) + ' yet.</div>') + '</div>';
  else {
    var groups = [], byDay = {};
    rows.forEach(function (e) { var k = e.date || ''; if (!byDay[k]) { byDay[k] = []; groups.push(k); } byDay[k].push(e); });
    html += '<div class="summary-strip"><div class="body-m muted">' + rows.length + ' entr' + (rows.length === 1 ? 'y' : 'ies') + (st.filter !== 'All' ? ' · ' + esc(st.filter) : '') + '</div><div class="title-m num">' + money(sum(rows)) + '</div></div>';
    html += groups.map(function (day) {
      return '<div class="dayhead"><div class="title-s">' + esc(niceDate(day)) + '</div><div class="title-s num">' + money(sum(byDay[day])) + '</div></div>' + byDay[day].map(function (e) { return entryRow(e, 'd' + rows.indexOf(e)); }).join('');
    }).join('');
  }
  body.innerHTML = html;
  var input = body.querySelector('[data-search]');
  input.oninput = function () { st.q = input.value; var pos = input.selectionStart; renderMonth(el); var ni = el.querySelector('[data-search]'); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} };
  var clr = body.querySelector('[data-clear]'); if (clr) clr.onclick = function () { st.q = ''; renderMonth(el); };
  Array.prototype.forEach.call(body.querySelectorAll('[data-f]'), function (b) { b.onclick = function () { st.filter = b.getAttribute('data-f'); renderMonth(el); }; });
  var on = body.querySelector('[data-chips] .on'); if (on) body.querySelector('[data-chips]').scrollLeft = on.offsetLeft - 16;
  Array.prototype.forEach.call(body.querySelectorAll('[data-e]'), function (b) { b.onclick = function () { openDetail(rows[+b.getAttribute('data-e').slice(1)]); }; });
}
function renderSummary(el, y) {
  var body = el.querySelector('[data-body]'), tot = {};
  (y.totals || []).forEach(function (t) { tot[t.label.toLowerCase()] = t.value; });
  var cats = (y.categories || []).slice().sort(function (a, b) { return b.value - a.value; });
  var total = tot['total'] != null ? tot['total'] : cats.reduce(function (a, c) { return a + c.value; }, 0), inc = tot['total ot income'], diff = tot['difference'];
  var max = Math.max.apply(null, cats.map(function (c) { return c.value; }).concat([1]));
  var html = '<div class="hero' + (diff < 0 ? ' neg' : '') + '" style="margin-top:16px"><div class="label-l">Total spent</div><div class="amt display-s num">' + money(total) + '</div>' +
    (diff != null ? '<span class="assist label-l">' + ic(diff < 0 ? 'trendDown' : 'trendUp') + (diff < 0 ? 'Over income by ' + money(-diff) : 'Saved ' + money(diff)) + '</span>' : '') + '</div>';
  if (inc != null) html += '<div class="tiles"><div class="tile"><div class="label-m">Total income</div><div class="title-l num">' + money(inc) + '</div></div><div class="tile"><div class="label-m">Difference</div><div class="title-l num" style="' + (diff < 0 ? 'color:var(--error)' : '') + '">' + money(diff) + '</div></div></div>';
  html += '<div class="section-h"><div class="title-s">By category · highest first</div></div><div class="card" style="margin:0 16px">' + cats.map(function (c, i) {
    return (i ? '<div class="divider"></div>' : '') + '<div class="li"><div class="avatar">' + cic(catIcon(c.label)) + '</div><div class="txt"><div class="body-l">' + esc(c.label) + '</div><div class="progress"><i style="width:' + (c.value / max * 100).toFixed(1) + '%"></i></div></div>' +
      '<div class="trail"><div class="title-s num">' + money(c.value) + '</div><div class="body-s muted num">' + (total ? Math.round(c.value / total * 100) : 0) + '%</div></div></div>';
  }).join('') + '</div>';
  body.innerHTML = html;
}

/* ================= DIALOG ================= */
function dialog(title, bodyHtml, acts, opts) {
  opts = opts || {};
  $('overlay').innerHTML = '<div class="scrim" id="dScrim"><div class="dialog" role="dialog">' + (title ? '<h2>' + esc(title) + '</h2>' : '') +
    '<div class="body' + (opts.list ? ' list' : '') + ' body-m"' + (opts.noPad ? ' style="padding:0"' : '') + '>' + bodyHtml + '</div>' +
    '<div class="acts">' + acts.map(function (a, i) { return '<button class="textbtn rp label-l" data-a="' + i + '"' + (a.danger ? ' style="color:var(--error)"' : '') + '>' + esc(a.label) + '</button>'; }).join('') + '</div></div></div>';
  hydrateIcons($('overlay'));
  $('dScrim').onclick = function (e) { if (e.target.id === 'dScrim' && !opts.modal) closeOverlay(); };
  Array.prototype.forEach.call($('overlay').querySelectorAll('[data-a]'), function (b) { b.onclick = function () { var a = acts[+b.getAttribute('data-a')]; if (!a.keep) closeOverlay(); if (a.run) a.run(); }; });
}
function openIncome(name, f) {
  dialog('Edit ' + f.incomeLabel, '<div class="body-m" style="margin-bottom:20px">Updates the income for “' + esc(name) + '”.</div>' +
    '<div class="field prefix filled" style="margin:0"><span class="pre">Rs</span><input id="iVal" inputmode="numeric" value="' + Math.round(f.income || 0) + '"><label>Amount</label><div class="support" id="iErr"></div></div>',
    [{ label: 'Cancel' }, { label: 'Save', keep: true, run: function () {
      var v = Number($('iVal').value.replace(/[^0-9.\-]/g, ''));
      if (!$('iVal').value.trim() || isNaN(v)) { $('iErr').textContent = 'Enter a number'; return; }
      closeOverlay();
      guard(DB.setIncome(S.activeId, tabInfo(name), v)).then(function () { snack('Income updated'); loadMonth(name); loadActive(); }).catch(function (e) { if (!e.auth) snack(e.message); });
    } }]);
  setTimeout(function () { var i = $('iVal'); i.focus(); i.select(); }, 60);
}

/* ================= ADD ENTRY ================= */
function defaultDateFor(name) {
  var info = tabInfo(name), k = info && info.key;
  if (!k || k === nowKey()) return today();
  var y = Math.floor(k / 100), m = k % 100;
  if (k > nowKey()) return y + '-' + pad2(m) + '-01';
  return iso(new Date(y, m, 0));
}
function openAdd(opts) {
  opts = opts || {};
  var target = opts.tab || currentName();
  if (!target || !canEdit()) return;
  var cats = categoryNames(target), chosen = opts.category || '';
  var el = pushPage(
    '<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Close"><svg class="i" data-i="close"></svg></button>' +
    '<div class="title title-l" style="padding-left:4px">Add entry</div><button class="textbtn rp label-l" id="aSaveTop">Save</button></header>' +
    '<div class="scroller">' +
      '<button class="selectfield" id="fTab" style="margin-top:12px"><span class="flabel">Month sheet</span>' + ic('cal') + '<span class="val" id="fTabName">' + esc(target) + '</span>' + ic('down') + '</button>' +
      '<div class="field big prefix filled" id="fAmtWrap"><span class="pre">Rs</span><input id="fAmt" class="num" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0"><label>Amount</label><div class="support" id="fAmtErr"></div></div>' +
      '<div class="section-h" style="padding-top:4px"><div class="title-s">Category</div><div class="body-s muted" id="fCatName">' + (chosen ? esc(chosen) : 'Pick one') + '</div></div>' +
      '<div class="catgrid" id="fCats">' + cats.map(function (c) {
        return '<button class="cattile rp' + (c === chosen ? ' on' : '') + '" data-c="' + esc(c) + '"><div class="ic">' + cic(catIcon(c)) + '</div><div class="label-m">' + esc(c) + '</div></button>';
      }).join('') + '</div><div class="cat-err" id="fCatErr"></div>' +
      '<div class="field" id="fComWrap" style="margin-top:20px"><input id="fCom" autocomplete="off" enterkeyhint="done"><label>Comments (optional)</label><svg class="i trail-i" data-i="comment"></svg></div>' +
      '<div class="field filled"><input id="fDate" type="date" value="' + defaultDateFor(target) + '"><label>Date</label><svg class="i trail-i" data-i="calDay"></svg><div class="support" id="fDateTxt"></div></div>' +
    '</div><div class="page-foot"><button class="btn filled block rp" id="aSave">' + ic('check') + 'Save entry</button></div>', { up: true, name: 'add' });
  var amt = el.querySelector('#fAmt'), com = el.querySelector('#fCom'), date = el.querySelector('#fDate');
  function syncDate() { el.querySelector('#fDateTxt').textContent = niceDate(date.value || today(), true); }
  syncDate(); date.onchange = syncDate;
  el.querySelector('#fTab').onclick = function () {
    var list = S.t.months.filter(function (m) { return m.key; }).slice(0, 12);
    dialog('Add to which month?', list.map(function (m) { return '<button class="radio-li rp body-l' + (m.name === target ? ' on' : '') + '" data-m="' + esc(m.name) + '"><span class="radio"></span><span>' + esc(m.name) + '</span>' + (m.name === currentName() ? '<span class="label-m" style="margin-left:auto;color:var(--primary)">Current</span>' : '') + '</button>'; }).join(''), [{ label: 'Cancel' }], { list: true });
    Array.prototype.forEach.call($('overlay').querySelectorAll('[data-m]'), function (b) {
      b.onclick = function () { closeOverlay(); target = b.getAttribute('data-m'); el.querySelector('#fTabName').textContent = target; date.value = defaultDateFor(target); syncDate(); };
    });
  };
  com.oninput = function () { el.querySelector('#fComWrap').classList.toggle('filled', !!com.value); };
  com.onkeydown = function (e) { if (e.key === 'Enter') com.blur(); };
  amt.oninput = function () { var raw = amt.value.replace(/[^0-9]/g, ''); amt.value = raw ? Number(raw).toLocaleString('en-US') : ''; el.querySelector('#fAmtWrap').classList.remove('err'); el.querySelector('#fAmtErr').textContent = ''; };
  Array.prototype.forEach.call(el.querySelectorAll('#fCats .cattile'), function (b) {
    b.onclick = function () {
      haptic(); chosen = b.getAttribute('data-c');
      Array.prototype.forEach.call(el.querySelectorAll('#fCats .cattile'), function (x) { x.classList.toggle('on', x === b); });
      el.querySelector('#fCatName').textContent = chosen; el.querySelector('#fCatErr').textContent = '';
    };
  });
  setTimeout(function () { amt.focus(); }, 280);
  function save() {
    var a = Number(amt.value.replace(/[^0-9]/g, ''));
    if (!a) { el.querySelector('#fAmtWrap').classList.add('err'); el.querySelector('#fAmtErr').textContent = 'Enter an amount'; amt.focus(); return; }
    if (!chosen) { el.querySelector('#fCatErr').textContent = 'Choose a category'; el.querySelector('#fCats').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    haptic();
    var entry = { id: 'q' + Date.now(), sheetId: S.activeId, tab: target, category: chosen, amount: a, comment: com.value.trim(), date: date.value || today() };
    queue.push(entry); store('queue', queue);
    popPage(); renderHome(); refreshOpenMonth(target);
    snack(money(a) + ' added to ' + target + ' · ' + chosen);
    flushQueue();
  }
  el.querySelector('#aSave').onclick = save; el.querySelector('#aSaveTop').onclick = save;
}

/* ================= CREATE MONTH ================= */
function suggestNewMonth() {
  var keys = (S.t ? S.t.months : []).map(function (m) { return m.key || 0; });
  var now = nowKey();
  if (keys.indexOf(now) < 0) return { key: now };
  var newest = Math.max.apply(null, keys.concat([now]));
  var y = Math.floor(newest / 100), m = newest % 100 + 1; if (m > 12) { m = 1; y++; }
  return { key: y * 100 + m };
}
function openCreate() {
  if (S.activeId && !canEdit()) return;
  var sug = suggestNewMonth().key, st = { year: Math.floor(sug / 100), month: sug % 100, hide: true };
  var tpl = currentName(), f = tpl ? figures(tpl) : { income: null, incomeLabel: 'Income' }, fresh = !tpl;
  var exists = function (y, m) { return S.t && S.t.months.some(function (t) { return t.key === y * 100 + m; }); };
  var el = pushPage('<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Close"><svg class="i" data-i="close"></svg></button><div class="title title-l" style="padding-left:4px">New month sheet</div></header>' +
    '<div class="scroller"><div data-body></div></div><div class="page-foot"><button class="btn filled block rp" data-create></button></div>', { up: true, name: 'create' });
  var catsCount = S.cats.length || (S.months[tpl] && S.months[tpl].categories.length) || DB.DEFAULT_CATEGORIES.length;
  var incVal = f.income != null ? String(Math.round(f.income)) : '';
  function render() {
    var name = MONTHS[st.month - 1] + " '" + String(st.year).slice(-2);
    var html = '<div class="yearsel"><button class="iconbtn rp on-surface" data-y="-1" aria-label="Previous year">' + ic('back') + '</button><div class="headline-s num">' + st.year + '</div><button class="iconbtn rp on-surface" data-y="1" aria-label="Next year" style="transform:scaleX(-1)">' + ic('back') + '</button></div>' +
      '<div class="mgrid">' + MONTHS.map(function (m, i) { var ex = exists(st.year, i + 1); return '<button class="mchip rp label-l' + (st.month === i + 1 && !ex ? ' on' : '') + '" data-mo="' + (i + 1) + '"' + (ex ? ' disabled' : '') + '>' + (ex ? ic('check') : '') + m.slice(0, 3) + '</button>'; }).join('') + '</div>' +
      (S.t && S.t.months.length ? '<div class="body-s muted" style="padding:0 16px">Months with ✓ already have a sheet.</div>' : '') +
      '<div class="field prefix' + (incVal ? ' filled' : '') + '" style="margin-top:24px"><span class="pre">Rs</span><input id="cInc" inputmode="numeric" value="' + esc(incVal) + '"><label>' + esc(f.incomeLabel) + ' for ' + esc(name) + '</label><div class="support">' + (tpl ? 'Copied from ' + esc(tpl) + ' — change it if needed' : 'Optional — your monthly income or budget') + '</div></div>' +
      '<div class="preview">' + ic('info') + '<div class="body-m">' + (fresh
        ? (S.activeId ? 'Adds a tab <b>' + esc(name) + '</b> to your sheet' : 'Creates your own Google Sheet “Hisaab – ' + esc((S.user && S.user.name) || 'My') + ' expenses” in your Drive with a tab <b>' + esc(name) + '</b>') + ' and ' + catsCount + ' starter categories. Only you can see it until you share it.'
        : 'Creates a new tab <b>' + esc(name) + '</b> with the same ' + catsCount + ' categories, formulas and expense claims as <b>' + esc(tpl) + '</b>. Daily expenses start empty.') + '</div></div>' +
      (tpl ? '<button class="switchrow rp" data-hide><div class="txt"><div class="body-l">Hide ' + esc(tpl) + ' in the sheet</div><div class="body-m muted">It stays in the app under “View monthly expenses”</div></div><span class="switch' + (st.hide ? ' on' : '') + '"></span></button>' : '');
    el.querySelector('[data-body]').innerHTML = html;
    var dup = exists(st.year, st.month), btn = el.querySelector('[data-create]');
    btn.disabled = dup; btn.innerHTML = ic('newMonth') + (dup ? esc(name) + ' already exists' : 'Create ' + esc(name));
    Array.prototype.forEach.call(el.querySelectorAll('[data-y]'), function (b) { b.onclick = function () { st.year += +b.getAttribute('data-y'); render(); }; });
    Array.prototype.forEach.call(el.querySelectorAll('[data-mo]'), function (b) { b.onclick = function () { haptic(); st.month = +b.getAttribute('data-mo'); render(); }; });
    var h = el.querySelector('[data-hide]'); if (h) h.onclick = function () { st.hide = !st.hide; render(); };
    var inc = el.querySelector('#cInc'); inc.oninput = function () { incVal = inc.value.replace(/[^0-9]/g, ''); inc.parentNode.classList.toggle('filled', !!incVal); };
  }
  render();
  el.querySelector('[data-create]').onclick = function () {
    var name = MONTHS[st.month - 1] + " '" + String(st.year).slice(-2), btn = el.querySelector('[data-create]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner spin" style="width:18px;height:18px;border-width:2px;border-color:var(--on-primary);border-right-color:transparent"></span> Creating ' + esc(name) + '…';
    var p = S.activeId ? Promise.resolve(S.activeId) : guard(DB.createSpreadsheet(S.user)).then(function (id) {
      return guard(DB.fileInfo(id)).then(function (fi) { addSheetFromFile(fi, 'owner'); S.activeId = id; saveSheets(); return id; });
    });
    p.then(function (id) { return guard(DB.createMonth(id, { year: st.year, month: st.month, income: incVal, hidePrevious: st.hide })); })
      .then(function (r) { haptic(); popPage(); snack(r.created + ' is ready', 'Open', function () { openMonth(r.created); }); S.t = null; return loadActive(); })
      .catch(function (e) { btn.disabled = false; render(); if (!e.auth) snack('Couldn’t create: ' + e.message); });
  };
}

/* ================= CATEGORIES ================= */
function openAddCategory() {
  if (!canEdit() || !S.activeId) return;
  var icons = Object.keys(CAT_ICONS), chosen = 'tag', name = '';
  var el = pushPage('<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Close"><svg class="i" data-i="close"></svg></button><div class="title title-l" style="padding-left:4px">Add category</div></header>' +
    '<div class="scroller"><div class="field" id="cnWrap2" style="margin-top:16px"><input id="cName" autocomplete="off" maxlength="40"><label>Category name</label><div class="support" id="cnErr2">e.g. School fees, Internet, Charity</div></div>' +
    '<div class="catpreview"><div class="avatar" id="cPrevIc">' + cic(chosen) + '</div><div class="body-l" id="cPrevName" style="color:var(--on-surface-variant)">Preview</div></div>' +
    '<div class="section-h"><div class="title-s">Choose an icon</div></div><div class="iconpick" id="iconPick">' +
    icons.map(function (k) { return '<button class="rp' + (k === chosen ? ' on' : '') + '" data-ic="' + k + '" aria-label="' + k + '">' + cic(k) + '</button>'; }).join('') + '</div></div>' +
    '<div class="page-foot"><button class="btn filled block rp" id="cSave">' + ic('tagPlus') + 'Add category</button></div>', { up: true, name: 'addcat' });
  var inp = el.querySelector('#cName');
  inp.oninput = function () { name = inp.value.trim(); inp.parentNode.classList.toggle('filled', !!inp.value); el.querySelector('#cPrevName').textContent = name || 'Preview'; el.querySelector('#cPrevName').style.color = name ? 'var(--on-surface)' : 'var(--on-surface-variant)'; el.querySelector('#cnWrap2').classList.remove('err'); el.querySelector('#cnErr2').textContent = 'e.g. School fees, Internet, Charity'; };
  Array.prototype.forEach.call(el.querySelectorAll('[data-ic]'), function (b) {
    b.onclick = function () { haptic(); chosen = b.getAttribute('data-ic'); Array.prototype.forEach.call(el.querySelectorAll('[data-ic]'), function (x) { x.classList.toggle('on', x === b); }); el.querySelector('#cPrevIc').innerHTML = cic(chosen); };
  });
  setTimeout(function () { inp.focus(); }, 280);
  el.querySelector('#cSave').onclick = function () {
    if (!name) { el.querySelector('#cnWrap2').classList.add('err'); el.querySelector('#cnErr2').textContent = 'Enter a name'; inp.focus(); return; }
    if (categoryNames(currentName()).some(function (c) { return c.toLowerCase() === name.toLowerCase(); })) { el.querySelector('#cnWrap2').classList.add('err'); el.querySelector('#cnErr2').textContent = '“' + name + '” already exists'; return; }
    var b = el.querySelector('#cSave'); b.disabled = true; b.textContent = 'Adding…';
    guard(DB.addCategory(S.activeId, S.t, { name: name, icon: chosen }, S.user)).then(function () {
      haptic(); popPage(); snack('Added “' + name + '”'); return loadActive();
    }).catch(function (e) { b.disabled = false; b.innerHTML = ic('tagPlus') + 'Add category'; if (!e.auth) snack('Couldn’t add: ' + e.message); });
  };
}
function openRemoveCategory() {
  if (!canEdit() || !S.activeId) return;
  var names = categoryNames(currentName());
  var el = pushPage('<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Close"><svg class="i" data-i="close"></svg></button><div class="title title-l" style="padding-left:4px">Remove category</div></header>' +
    '<div class="scroller"><div class="body-m muted" style="padding:8px 16px 12px">Select the category you want to remove.</div><div class="card" style="margin:0 16px">' +
    names.map(function (n, i) { return (i ? '<div class="divider"></div>' : '') + '<button class="pickrow rp" data-n="' + esc(n) + '"><div class="avatar">' + cic(catIcon(n)) + '</div><div class="txt body-l">' + esc(n) + '</div>' + ic('del') + '</button>'; }).join('') +
    '</div><div style="height:24px"></div></div>', { up: true, name: 'rmcat' });
  Array.prototype.forEach.call(el.querySelectorAll('[data-n]'), function (b) { b.onclick = function () { confirmRemove(b.getAttribute('data-n')); }; });
}
function confirmRemove(name) {
  dialog('Remove “' + name + '”?', 'It will no longer appear when adding entries or in new months.', [{ label: 'Cancel' }, { label: 'Remove', danger: true, keep: true, run: function () {
    $('overlay').querySelector('.dialog .body').innerHTML = '<div style="display:flex;gap:12px;align-items:center"><span class="spinner spin"></span>Checking existing entries…</div>';
    Array.prototype.forEach.call($('overlay').querySelectorAll('[data-a]'), function (b) { b.disabled = true; });
    guard(DB.categoryUsage(S.activeId, S.t, name)).then(function (u) {
      if (!u.count) { closeOverlay(); doRemove(name, null, false); return; }
      askMapping(name, u);
    }).catch(function (e) { closeOverlay(); if (!e.auth) snack(e.message); });
  } }]);
}
function askMapping(name, usage) {
  var others = categoryNames(currentName()).filter(function (n) { return n !== name; }), pick = null;
  var monthsTxt = usage.months.slice(0, 3).map(function (m) { return m.name; }).join(', ') + (usage.months.length > 3 ? ' and ' + (usage.months.length - 3) + ' more' : '');
  var body = '<div class="body-m" style="padding:0 24px 12px"><b>' + usage.count + ' entr' + (usage.count === 1 ? 'y uses' : 'ies use') + ' “' + esc(name) + '”</b> (' + esc(monthsTxt) + '). Move them to another category so your totals stay right:</div>' +
    others.map(function (n) { return '<button class="opt rp" data-to="' + esc(n) + '"><span class="radio"></span><span class="txt body-l" style="color:var(--on-surface)">' + esc(n) + '</span></button>'; }).join('') +
    '<button class="opt rp" data-to=""><span class="radio"></span><span class="txt"><span class="body-l" style="color:var(--on-surface);display:block">Keep old entries as they are</span><span class="body-s">Past months keep “' + esc(name) + '”; it’s removed from this month on</span></span></button>';
  dialog('Move existing entries', body, [{ label: 'Cancel' }, { label: 'Move & remove', danger: true, keep: true, run: function () {
    if (pick === null) { snack('Choose where the entries should go, or Cancel'); return; }
    closeOverlay(); doRemove(name, pick || null, !pick);
  } }], { list: true, noPad: true });
  Array.prototype.forEach.call($('overlay').querySelectorAll('[data-to]'), function (b) {
    b.onclick = function () { pick = b.getAttribute('data-to'); Array.prototype.forEach.call($('overlay').querySelectorAll('[data-to]'), function (x) { x.classList.toggle('on', x === b); }); };
  });
}
function doRemove(name, mapTo, keepHistory) {
  snack('Removing “' + name + '”' + (mapTo ? ' and moving entries to “' + mapTo + '”' : '') + '…');
  guard(DB.removeCategory(S.activeId, S.t, name, mapTo, keepHistory, S.user)).then(function () {
    haptic(); var p = findPage('rmcat'); if (p) popPage();
    snack('Removed “' + name + '”' + (mapTo ? ' · entries moved to “' + mapTo + '”' : ''));
    S.months = {}; return loadActive();
  }).catch(function (e) { if (!e.auth) snack('Couldn’t remove: ' + e.message); });
}

/* ================= DETAIL ================= */
function openDetail(e) {
  var edit = canEdit();
  var el = pushPage('<header class="appbar"><button class="iconbtn rp on-surface" data-back aria-label="Back"><svg class="i" data-i="back"></svg></button><div class="title title-l" style="padding-left:4px">Entry</div>' +
    (edit ? '<button class="iconbtn rp" id="dDelTop" aria-label="Delete"><svg class="i" data-i="del"></svg></button>' : '') + '</header>' +
    '<div class="scroller"><div class="detail-head"><div class="avatar lg">' + cic(catIcon(e.category)) + '</div><div class="display-s num" style="margin-top:8px">' + money(e.amount) + '</div><div class="title-m muted">' + esc(e.category) + '</div></div>' +
    '<div class="card" style="margin:0 16px">' +
      '<div class="set-li">' + ic('calDay') + '<div class="txt"><div class="label-m muted">Date</div><div class="body-l">' + esc(niceDate(e.date, true)) + '</div></div></div><div class="divider"></div>' +
      '<div class="set-li">' + ic('comment') + '<div class="txt"><div class="label-m muted">Comments</div><div class="body-l" style="word-break:break-word">' + (e.comment ? esc(e.comment) : '<span class="muted">No comment</span>') + '</div></div></div><div class="divider"></div>' +
      '<div class="set-li">' + ic(e.pending ? 'sync' : 'check') + '<div class="txt"><div class="label-m muted">Month sheet</div><div class="body-l">' + esc(e.tab) + (e.pending ? ' · waiting to sync' : '') + '</div></div></div>' +
    '</div>' + (edit ? '<div class="actions-row" style="margin-top:16px"><button class="btn tonal rp" id="dDup">' + ic('copy') + 'Add similar</button><button class="btn danger rp" id="dDel">' + ic('del') + 'Delete</button></div>' : '') + '</div>', { name: 'detail' });
  if (!edit) return;
  el.querySelector('#dDup').onclick = function () { popPage(); setTimeout(function () { openAdd({ tab: e.tab, category: e.category }); }, 120); };
  var ask = function () {
    dialog('Delete entry?', money(e.amount) + ' · ' + esc(e.category) + (e.comment ? ' · ' + esc(e.comment) : '') + '<br><br>' + (e.pending ? 'It hasn’t been synced yet.' : 'This removes it from the ' + esc(e.tab) + ' sheet.'),
      [{ label: 'Cancel' }, { label: 'Delete', danger: true, run: function () { doDelete(e); } }]);
  };
  el.querySelector('#dDel').onclick = ask; el.querySelector('#dDelTop').onclick = ask;
}
function doDelete(e) {
  if (e.pending) { queue = queue.filter(function (q) { return q.id !== e.id; }); store('queue', queue); popPage(); renderHome(); refreshOpenMonth(e.tab); snack('Entry removed'); return; }
  if (e.local && !e.row) { snack('Still syncing — try again in a moment'); return; }
  popPage(); snack('Deleting…');
  guard(DB.deleteEntry(S.activeId, tabInfo(e.tab), e)).then(function () {
    recent = recent.filter(function (r) { return r.id !== e.id; });
    var d = S.months[e.tab]; if (d) d.entries = d.entries.filter(function (x) { return !(x.row === e.row && x.amount === e.amount && x.category === e.category); });
    renderHome(); refreshOpenMonth(e.tab); snack('Entry deleted'); loadMonth(e.tab);
  }).catch(function (err) { if (!err.auth) snack('Couldn’t delete: ' + err.message); loadMonth(e.tab); });
}

window.addEventListener('online', function () { flushQueue(); });
window.HisaabApp = { boot: boot, S: S };
boot();
})();
