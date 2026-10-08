/* Hisaab — Google Sheets / Drive data layer (runs in the browser with the user's OAuth token) */
(function () {
'use strict';

var CFG = window.HISAAB_CONFIG;
var SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
var DRIVE = 'https://www.googleapis.com/drive/v3/files';
var SETTINGS_TAB = '_Hisaab';
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var DEFAULT_CATEGORIES = [
  ['Grocery', 'cart'], ['Bills', 'bills'], ['Medical', 'medical'], ['Fruits and Vegetables', 'fruit'], ['Milk/Yogurt', 'milk'],
  ['Food & Dining', 'food'], ['Kids', 'kids'], ['Clothing & Shopping', 'shirt'], ['Vehicle', 'car'], ['Fuel', 'fuel'],
  ['Rent', 'rent'], ['Loan', 'loan'], ['Miscellaneous', 'misc'], ['Other', 'other']
].map(function (c) { return { name: c[0], icon: c[1] }; });
var ICON_GUESS = [
  [/grocery/i, 'cart'], [/bill/i, 'bills'], [/medic/i, 'medical'], [/fruit|vegetable|chicken/i, 'fruit'],
  [/milk|yog/i, 'milk'], [/breakfast/i, 'breakfast'], [/wife/i, 'wife'], [/kid|aboubakar|haana|child/i, 'kids'],
  [/\(food|food|dining/i, 'food'], [/cloth|shopping/i, 'shirt'], [/petrol|fuel/i, 'fuel'], [/vehicle|bike|car|wash|tuning/i, 'car'],
  [/loan/i, 'loan'], [/misc/i, 'misc'], [/qurbani/i, 'qurbani'], [/other/i, 'other'], [/rent/i, 'rent'], [/internet/i, 'internet'], [/fitness|gym/i, 'fitness']
];
function guessIcon(name) { for (var i = 0; i < ICON_GUESS.length; i++) if (ICON_GUESS[i][0].test(name)) return ICON_GUESS[i][1]; return 'tag'; }

/* ================= auth ================= */
var AUTH_KEY = 'hisaab.auth';
function getAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; } }
function setAuth(a) { try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) {} }
function tokenValid() { var a = getAuth(); return !!(a && a.token && a.exp > Date.now() + 60000); }

function login(opts) {
  opts = opts || {};
  var state = Math.random().toString(36).slice(2);
  try { sessionStorage.setItem('hisaab.oauthState', state); localStorage.setItem('hisaab.oauthState', state); } catch (e) {}
  var a = getAuth() || {};
  var p = {
    client_id: CFG.clientId, redirect_uri: CFG.redirectUri, response_type: 'token',
    scope: CFG.scopes.join(' '), include_granted_scopes: 'true', state: state
  };
  if (opts.silent) { p.prompt = 'none'; if (a.email) p.login_hint = a.email; }
  else p.prompt = opts.consent ? 'consent select_account' : 'select_account';
  var q = Object.keys(p).map(function (k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q);
}
/** Call once on page load. Returns {ok} | {error} | null (no oauth response in URL). */
function handleRedirect() {
  if (!location.hash || location.hash.length < 2) return null;
  var h = {}; location.hash.slice(1).split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) h[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
  if (!h.access_token && !h.error) return null;
  history.replaceState(null, '', location.pathname + location.search);
  var saved = null; try { saved = localStorage.getItem('hisaab.oauthState'); } catch (e) {}
  if (h.state && saved && h.state !== saved) return { error: 'state_mismatch' };
  if (h.error) return { error: h.error };
  var granted = (h.scope || '').split(' ');
  var a = getAuth() || {};
  a.token = h.access_token; a.exp = Date.now() + (Number(h.expires_in) || 3600) * 1000; a.scopes = granted;
  setAuth(a);
  var missing = CFG.scopes.filter(function (s) { return /googleapis/.test(s) && granted.indexOf(s) < 0; });
  return { ok: true, missingScopes: missing };
}
function logout() {
  var a = getAuth();
  if (a && a.token) { try { fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(a.token), { method: 'POST' }); } catch (e) {} }
  setAuth(null);
}

/* ================= HTTP ================= */
function AuthError(msg) { var e = new Error(msg || 'Signed out'); e.auth = true; return e; }
function api(method, url, body, opts) {
  opts = opts || {};
  var a = getAuth();
  if (!a || !a.token) return Promise.reject(AuthError());
  if (a.exp < Date.now() + 30000) return Promise.reject(AuthError('Session expired'));
  var init = { method: method, headers: { Authorization: 'Bearer ' + a.token } };
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  return fetch(url, init).then(function (r) {
    if (r.status === 401) throw AuthError('Session expired');
    return r.text().then(function (t) {
      var data = null; try { data = t ? JSON.parse(t) : {}; } catch (e) { data = { raw: t }; }
      if (!r.ok) {
        var msg = (data && data.error && (data.error.message || data.error)) || ('HTTP ' + r.status);
        var err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)); err.status = r.status; throw err;
      }
      return data;
    });
  }, function () { var e = new Error('No internet connection'); e.offline = true; throw e; });
}
function qs(o) { return Object.keys(o).filter(function (k) { return o[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
function a1(tab) { return "'" + String(tab).replace(/'/g, "''") + "'"; }

/* ================= helpers ================= */
function num(v) { if (typeof v === 'number') return v; var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; }
function pad2(n) { return ('0' + n).slice(-2); }
function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function serialToIso(s) { var d = new Date(Math.round((s - 25569) * 86400000)); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
function monthKey(name) {
  var n = String(name).toLowerCase();
  var names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'ju', 'aug', 'sep', 'oct', 'nov', 'dec'], mon = -1;
  for (var i = 0; i < names.length; i++) {
    if (i === 6) { if (/\bjul|\bjuy/.test(n)) { mon = 6; break; } continue; }
    if (new RegExp('\\b' + names[i]).test(n) || n.indexOf(names[i]) === 0) { mon = i; break; }
  }
  var y = n.match(/(20\d\d)/) ? Number(n.match(/(20\d\d)/)[1]) : (n.match(/(\d\d)\s*$/) ? 2000 + Number(n.match(/(\d\d)\s*$/)[1]) : 0);
  return (mon < 0 || !y) ? 0 : y * 100 + mon + 1;
}
function monthName(year, m) { return MONTHS[m - 1] + " '" + String(year).slice(-2); }
function parseTextDate(s, key) {
  var m = String(s).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) { var iso = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/); return iso ? iso[0] : null; }
  var a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
  var dm = (b >= 1 && b <= 12 && a <= 31) ? [y, b, a] : null, md = (a >= 1 && a <= 12 && b <= 31) ? [y, a, b] : null;
  var pick = dm || md;
  if (dm && md && key) {
    var t = Math.floor(key / 100) * 12 + key % 100;
    if (Math.abs(md[0] * 12 + md[1] - t) < Math.abs(dm[0] * 12 + dm[1] - t)) pick = md;
  }
  return pick ? pick[0] + '-' + pad2(pick[1]) + '-' + pad2(pick[2]) : null;
}
function headerRow(rows) { for (var r = 0; r < Math.min(rows.length, 15); r++) if (String((rows[r] || [])[0] || '').trim().toUpperCase() === 'DATE') return r; return -1; }
function cell(rows, r, c) { return ((rows[r] || [])[c]); }
function str(v) { return v == null ? '' : String(v).trim(); }

/* ================= user & sheet discovery ================= */
function me() {
  return api('GET', 'https://www.googleapis.com/oauth2/v3/userinfo').then(function (u) {
    var a = getAuth() || {}; a.email = u.email; a.name = u.name || u.email; a.picture = u.picture; setAuth(a);
    return { email: u.email, name: u.name || u.email, picture: u.picture };
  });
}
var FILE_FIELDS = 'id,name,owners(displayName,emailAddress,photoLink,me),capabilities(canEdit,canShare),sharingUser(displayName,emailAddress),sharedWithMeTime,modifiedTime,appProperties';
function findOwnSheet() {
  var q = "appProperties has { key='hisaab' and value='sheet' } and 'me' in owners and trashed=false";
  return api('GET', DRIVE + '?' + qs({ q: q, fields: 'files(' + FILE_FIELDS + ')', pageSize: 10, orderBy: 'modifiedTime desc' }))
    .then(function (r) { return (r.files || [])[0] || null; });
}
function suggestExisting() {
  var q = "mimeType='application/vnd.google-apps.spreadsheet' and 'me' in owners and trashed=false and (name contains 'Expense' or name contains 'Expenses' or name contains 'Hisaab' or name contains 'Budget' or name contains 'Kharch')";
  return api('GET', DRIVE + '?' + qs({ q: q, fields: 'files(id,name,modifiedTime)', pageSize: 10, orderBy: 'modifiedTime desc' }))
    .then(function (r) { return (r.files || []).filter(function (f) { return !/^(BACKUP|Copy of)|\(Responses\)/i.test(f.name); }); });
}
function fileInfo(id) { return api('GET', DRIVE + '/' + id + '?' + qs({ fields: FILE_FIELDS, supportsAllDrives: true })); }
function markSheet(id) {
  return api('PATCH', DRIVE + '/' + id + '?' + qs({ fields: 'id' }), { appProperties: { hisaab: 'sheet' }, description: 'Expenses sheet used by the Hisaab app (hisaab-app-sheet).' });
}
function sharedWithMe() {
  var q = "sharedWithMe = true and trashed=false and mimeType='application/vnd.google-apps.spreadsheet' and (appProperties has { key='hisaab' and value='sheet' } or fullText contains 'hisaab-app-sheet')";
  return api('GET', DRIVE + '?' + qs({ q: q, fields: 'files(' + FILE_FIELDS + ')', pageSize: 50, orderBy: 'sharedWithMeTime desc' }))
    .then(function (r) { return r.files || []; });
}
function share(id, email, role, fromName) {
  return api('POST', DRIVE + '/' + id + '/permissions?' + qs({
    sendNotificationEmail: true,
    emailMessage: (fromName || 'Someone') + ' shared their expenses with you on Hisaab. Open the Hisaab app → menu → Sharing requests to see them.'
  }), { type: 'user', role: role === 'edit' ? 'writer' : 'reader', emailAddress: email });
}
function listPermissions(id) {
  return api('GET', DRIVE + '/' + id + '/permissions?' + qs({ fields: 'permissions(id,emailAddress,displayName,role,type)' })).then(function (r) { return r.permissions || []; });
}
function removePermission(id, permId) { return api('DELETE', DRIVE + '/' + id + '/permissions/' + permId); }

/* ================= spreadsheet structure ================= */
function meta(id) {
  return api('GET', SHEETS + '/' + id + '?' + qs({ fields: 'properties(title,timeZone),sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount)))' }));
}
function readSettings(id, m) {
  var has = m.sheets.some(function (s) { return s.properties.title === SETTINGS_TAB; });
  if (!has) return Promise.resolve(null);
  return api('GET', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(SETTINGS_TAB) + '!A1:B40')).then(function (r) {
    var o = {}; (r.values || []).forEach(function (row) { if (row[0]) o[row[0]] = row[1]; });
    try { o.categories = JSON.parse(o.categories || '[]'); } catch (e) { o.categories = []; }
    return o;
  });
}
function writeSettings(id, m, s) {
  var rows = [['key', 'value'], ['app', 'Hisaab'], ['version', '2'], ['owner_name', s.owner_name || ''], ['owner_email', s.owner_email || ''], ['categories', JSON.stringify(s.categories || [])],
    ['note', 'Used by the Hisaab app. Please do not edit.']];
  var has = m.sheets.some(function (x) { return x.properties.title === SETTINGS_TAB; });
  var p = has ? Promise.resolve() : api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: [{ addSheet: { properties: { title: SETTINGS_TAB, hidden: m.sheets.length > 0 } } }] })
    .then(function (r) { m.sheets.push({ properties: r.replies[0].addSheet.properties }); });
  return p.then(function () {
    return api('PUT', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(SETTINGS_TAB) + '!A1:B7') + '?valueInputOption=RAW', { values: rows });
  });
}

/** Lists month tabs (DATE header) and summary tabs, newest month first. */
function tabs(id) {
  return meta(id).then(function (m) {
    var sheets = m.sheets.map(function (s) { return s.properties; }).filter(function (p) { return p.title !== SETTINGS_TAB; });
    if (!sheets.length) return { meta: m, months: [], summaries: [], current: null };
    var ranges = sheets.map(function (p) { return a1(p.title) + '!A1:F15'; });
    return api('GET', SHEETS + '/' + id + '/values:batchGet?' + ranges.map(function (r) { return 'ranges=' + encodeURIComponent(r); }).join('&') + '&valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS')
      .then(function (res) {
        var months = [], summaries = [];
        res.valueRanges.forEach(function (vr, i) {
          var p = sheets[i], rows = vr.values || [];
          var info = { name: p.title, sheetId: p.sheetId, hidden: !!p.hidden, index: p.index, rowCount: p.gridProperties.rowCount };
          var h = headerRow(rows);
          if (h >= 0) {
            info.header = h; info.key = monthKey(p.title);
            for (var r = 0; r < Math.min(4, rows.length); r++) {
              var lab = str(cell(rows, r, 0)).toLowerCase(), v = num(cell(rows, r, 1));
              if (v === null) continue;
              if (/income/.test(lab)) info.income = v; else if (/expense/.test(lab)) info.expenses = v; else if (/hand|balance/.test(lab)) info.inHand = v;
            }
            months.push(info);
          } else if (rows.some(function (row) { return /category expenses review/i.test((row || []).join(' ')); })) summaries.push(info);
        });
        months.sort(function (x, y) { return ((y.key || 0) - (x.key || 0)) || (x.index - y.index); });
        var cur = months.filter(function (t) { return t.key; })[0] || months[0] || null;
        return { meta: m, months: months, summaries: summaries, current: cur ? cur.name : null };
      });
  });
}

/** Full data for one month (or summary) tab. */
function month(id, tab) {
  var range = encodeURIComponent(a1(tab.name) + '!A1:F' + Math.max(tab.rowCount || 200, 20));
  return Promise.all([
    api('GET', SHEETS + '/' + id + '/values/' + range + '?valueRenderOption=UNFORMATTED_VALUE'),
    api('GET', SHEETS + '/' + id + '/values/' + range + '?valueRenderOption=FORMATTED_VALUE')
  ]).then(function (res) {
    var values = res[0].values || [], shown = res[1].values || [];
    var n = Math.max(values.length, shown.length), key = monthKey(tab.name);
    var summary = [];
    for (var r = 0; r < Math.min(4, n); r++) {
      var label = str(cell(shown, r, 0)), v = num(cell(values, r, 1));
      if (label && v !== null) summary.push({ label: label, value: v, row: r + 1 });
    }
    var entries = [], h = headerRow(shown), lastDate = '';
    if (h >= 0) {
      for (r = h + 1; r < n; r++) {
        var d = cell(values, r, 0), amt = num(cell(values, r, 2)), cat = str(cell(values, r, 1));
        if (amt === null && !cat) continue;
        if (/^#(REF|N\/A|ERROR|VALUE)/.test(str(cell(shown, r, 0)))) continue;
        var date = '';
        if (typeof d === 'number' && d > 36000) date = serialToIso(d);
        else if (typeof d === 'string' && d.trim()) date = parseTextDate(d, key) || '';
        if (date) lastDate = date; else date = lastDate;
        entries.push({ row: r + 1, date: date, category: cat, amount: amt || 0, comment: str(cell(values, r, 3)) });
      }
    }
    var categories = [], totals = [], sections = [], catHeader = -1, end = -1;
    for (r = 0; r < n; r++) if (/^category$/i.test(str(cell(shown, r, 4)))) { catHeader = r; break; }
    if (catHeader >= 0) {
      end = catHeader;
      for (r = catHeader + 1; r < n; r++) {
        var lab = str(cell(shown, r, 4));
        if (!lab) break;
        var item = { label: lab, value: num(cell(values, r, 5)) || 0, row: r + 1 };
        if (/^(total|difference)/i.test(lab)) totals.push(item); else categories.push(item);
        end = r;
      }
      for (r = end + 1; r < n; r++) {
        var tl = str(cell(shown, r, 4));
        if (/^(total|difference)/i.test(tl) && !totals.some(function (t) { return t.label === tl; })) totals.push({ label: tl, value: num(cell(values, r, 5)) || 0 });
      }
      for (r = end + 1; r < n; r++) {
        var sl = str(cell(shown, r, 4));
        if (!/claim/i.test(sl)) continue;
        var sec = { title: sl, total: num(cell(values, r, 5)), items: [] };
        if (sec.total === null) sec.total = num(cell(values, r + 1, 5));
        var blanks = 0, k;
        for (k = r + 1; k < n && blanks < 2; k++) {
          var il = str(cell(shown, k, 4));
          if (!il) { blanks++; continue; }
          blanks = 0; sec.items.push({ label: il, value: num(cell(values, k, 5)) || 0 });
        }
        sections.push(sec); r = k;
      }
    }
    return {
      tab: tab.name, key: key, isSummary: h < 0, header: h, catHeader: catHeader, catEnd: end,
      summary: summary, entries: entries, categories: categories, totals: totals, sections: sections, fetchedAt: Date.now()
    };
  });
}

/* ================= writes ================= */
function addEntry(id, tab, e) {
  // Find the first empty row under the last entry in A:D (values.get trims trailing empty rows).
  var first = (tab.header >= 0 ? tab.header : 5) + 2;
  return api('GET', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tab.name) + '!A' + first + ':D') + '?valueRenderOption=UNFORMATTED_VALUE').then(function (r) {
    var rows = r.values || [], row = first + rows.length;
    var grow = row > (tab.rowCount || 1000)
      ? api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: [{ appendDimension: { sheetId: tab.sheetId, dimension: 'ROWS', length: 50 } }] }).then(function () { tab.rowCount = (tab.rowCount || 0) + 50; })
      : Promise.resolve();
    return grow.then(function () {
      return api('PUT', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tab.name) + '!A' + row + ':D' + row) + '?valueInputOption=USER_ENTERED',
        { values: [[e.date, e.category, Number(e.amount), e.comment || '']] });
    }).then(function () { return { row: row }; });
  });
}
function deleteEntry(id, tab, e) {
  return api('GET', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tab.name) + '!A' + e.row + ':D' + e.row) + '?valueRenderOption=UNFORMATTED_VALUE').then(function (r) {
    var v = (r.values || [[]])[0] || [];
    if (str(v[1]) !== str(e.category) || num(v[2]) !== num(e.amount)) throw new Error('This entry changed in the sheet. Refresh and try again.');
    return api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: [{ deleteRange: { range: { sheetId: tab.sheetId, startRowIndex: e.row - 1, endRowIndex: e.row, startColumnIndex: 0, endColumnIndex: 4 }, shiftDimension: 'ROWS' } }] });
  });
}
function setIncome(id, tab, value) {
  return api('PUT', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tab.name) + '!B1') + '?valueInputOption=USER_ENTERED', { values: [[Number(value)]] });
}

/* ---------- month creation ---------- */
var BLACK = { red: 0, green: 0, blue: 0 }, WHITE = { red: 1, green: 1, blue: 1 }, YELLOW = { red: 1, green: 1, blue: 0 }, PINK = { red: 0.96, green: 0.8, blue: 0.8 };
function gr(sheetId, r1, r2, c1, c2) { return { sheetId: sheetId, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 }; }
function fmt(range, f, fields) { return { repeatCell: { range: range, cell: { userEnteredFormat: f }, fields: 'userEnteredFormat(' + fields + ')' } }; }
var BORDER = { style: 'SOLID', color: BLACK };
function borders(range) { return { updateBorders: { range: range, top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, innerHorizontal: BORDER, innerVertical: BORDER } }; }

function freshMonthRequests(sheetId, categories, income) {
  var rows = 200, firstData = 7, catStart = 8;
  var reqs = [];
  var head = { backgroundColor: BLACK, textFormat: { foregroundColor: WHITE, bold: true }, horizontalAlignment: 'CENTER' };
  reqs.push(fmt(gr(sheetId, 0, 3, 0, 1), head, 'backgroundColor,textFormat,horizontalAlignment'));
  reqs.push(fmt(gr(sheetId, 0, 3, 1, 2), { horizontalAlignment: 'CENTER' }, 'horizontalAlignment'));
  reqs.push(borders(gr(sheetId, 0, 3, 0, 2)));
  reqs.push({ mergeCells: { range: gr(sheetId, 4, 5, 0, 4), mergeType: 'MERGE_ALL' } });
  reqs.push(fmt(gr(sheetId, 4, 6, 0, 4), head, 'backgroundColor,textFormat,horizontalAlignment'));
  reqs.push(fmt(gr(sheetId, 6, rows, 0, 3), { horizontalAlignment: 'CENTER' }, 'horizontalAlignment'));
  reqs.push(fmt(gr(sheetId, 6, rows, 0, 1), { numberFormat: { type: 'DATE', pattern: 'm/d/yyyy' } }, 'numberFormat'));
  reqs.push(fmt(gr(sheetId, 5, rows, 3, 4), { backgroundColor: YELLOW, horizontalAlignment: 'CENTER' }, 'backgroundColor,horizontalAlignment'));
  reqs.push(fmt(gr(sheetId, 5, 6, 3, 4), head, 'backgroundColor,textFormat,horizontalAlignment'));
  reqs.push(borders(gr(sheetId, 5, rows, 0, 4)));
  reqs.push({ mergeCells: { range: gr(sheetId, 5, 6, 4, 6), mergeType: 'MERGE_ALL' } });
  reqs.push(fmt(gr(sheetId, 5, 7, 4, 6), head, 'backgroundColor,textFormat,horizontalAlignment'));
  reqs.push(fmt(gr(sheetId, 7, 7 + categories.length, 4, 6), { horizontalAlignment: 'CENTER' }, 'horizontalAlignment'));
  reqs.push(borders(gr(sheetId, 7, 7 + Math.max(categories.length, 1), 4, 6)));
  reqs.push({ updateDimensionProperties: { range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 }, properties: { pixelSize: 150 }, fields: 'pixelSize' } });
  reqs.push({ updateDimensionProperties: { range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 230 }, fields: 'pixelSize' } });
  reqs.push({ updateDimensionProperties: { range: { sheetId: sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 5 }, properties: { pixelSize: 220 }, fields: 'pixelSize' } });
  var data = [
    { range: 'A1:B3', values: [['Income', income || 0], ['Expenses', '=SUM(C' + firstData + ':C)'], ['In hand', '=B1-B2']] },
    { range: 'A5', values: [['Daily expenses review']] },
    { range: 'A6:D6', values: [['DATE', 'Category', 'Expense', 'Comments']] },
    { range: 'E6', values: [['Category expenses review']] },
    { range: 'E7:F7', values: [['Category', 'Expense']] }
  ];
  if (categories.length) data.push({ range: 'E' + catStart + ':F' + (catStart + categories.length - 1), values: categories.map(function (c, i) { return [c.name, '=SUMIF($B$' + firstData + ':$B,E' + (catStart + i) + ',$C$' + firstData + ':$C)']; }) });
  return { requests: reqs, data: data };
}

function createSpreadsheet(user) {
  return api('POST', SHEETS, { properties: { title: 'Hisaab – ' + (user.name || 'My') + ' expenses' }, sheets: [{ properties: { title: SETTINGS_TAB } }] })
    .then(function (s) {
      var id = s.spreadsheetId;
      return markSheet(id).then(function () { return meta(id); }).then(function (m) {
        return writeSettings(id, m, { owner_name: user.name, owner_email: user.email, categories: DEFAULT_CATEGORIES }).then(function () { return id; });
      });
    });
}

/** Create a new month tab. tpl = current month tab info (or null for a brand-new sheet). */
function createMonth(id, opts) {
  var name = monthName(opts.year, opts.month);
  return tabs(id).then(function (t) {
    if (t.months.some(function (m) { return m.key === opts.year * 100 + opts.month; })) throw new Error(name + ' already exists');
    var tpl = t.months.filter(function (m) { return m.name === t.current; })[0];
    if (!tpl) {
      // brand-new sheet: build the layout from the category list
      return getCategories(id, t).then(function (cats) {
        return api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: [{ addSheet: { properties: { title: name, index: 0, gridProperties: { rowCount: 200, columnCount: 8 } } } }] }).then(function (r) {
          var sid = r.replies[0].addSheet.properties.sheetId;
          var f = freshMonthRequests(sid, cats, opts.income);
          var settingsSheet = t.meta.sheets.filter(function (s) { return s.properties.title === SETTINGS_TAB; })[0];
          if (settingsSheet && !settingsSheet.properties.hidden) f.requests.push({ updateSheetProperties: { properties: { sheetId: settingsSheet.properties.sheetId, hidden: true }, fields: 'hidden' } });
          return api('POST', SHEETS + '/' + id + '/values:batchUpdate', { valueInputOption: 'USER_ENTERED', data: f.data.map(function (d) { return { range: a1(name) + '!' + d.range, values: d.values }; }) })
            .then(function () { return api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: f.requests }); })
            .then(function () { return { created: name }; });
        });
      });
    }
    // copy the current month (same categories, formulas, claims) and clear its daily entries
    var first = tpl.header + 2;
    return api('GET', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tpl.name) + '!A' + first) + '?valueRenderOption=FORMULA').then(function (fr) {
      var f = str(((fr.values || [[]])[0] || [])[0]);
      var freeze = /IMPORTRANGE/i.test(f)
        ? api('GET', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tpl.name) + '!A' + first + ':D' + tpl.rowCount) + '?valueRenderOption=UNFORMATTED_VALUE').then(function (vr) {
            var vals = vr.values || [];
            return api('POST', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tpl.name) + '!A' + first + ':D' + tpl.rowCount) + ':clear', {}).then(function () {
              if (!vals.length) return;
              return api('PUT', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(tpl.name) + '!A' + first + ':D' + (first + vals.length - 1)) + '?valueInputOption=RAW', { values: vals });
            });
          })
        : Promise.resolve();
      return freeze.then(function () {
        return api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: [{ duplicateSheet: { sourceSheetId: tpl.sheetId, insertSheetIndex: 0, newSheetName: name } }] });
      }).then(function (r) {
        var sid = r.replies[0].duplicateSheet.properties.sheetId, rc = r.replies[0].duplicateSheet.properties.gridProperties.rowCount;
        var reqs = [{ updateCells: { range: gr(sid, first - 1, rc, 0, 4), fields: 'userEnteredValue' } }];
        if (opts.hidePrevious !== false) reqs.push({ updateSheetProperties: { properties: { sheetId: tpl.sheetId, hidden: true }, fields: 'hidden' } });
        return api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: reqs });
      }).then(function () {
        if (opts.income === '' || opts.income == null) return;
        return api('PUT', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(name) + '!B1') + '?valueInputOption=USER_ENTERED', { values: [[Number(opts.income)]] });
      }).then(function () { return { created: name, from: tpl.name }; });
    });
  });
}

/* ================= categories ================= */
/** Category list (name + icon). Uses the _Hisaab tab, or derives it from the current month for older sheets. */
function getCategories(id, t) {
  return readSettings(id, t.meta).then(function (s) {
    if (s && s.categories && s.categories.length) return s.categories;
    var cur = t.months.filter(function (m) { return m.name === t.current; })[0];
    if (!cur) return DEFAULT_CATEGORIES.slice();
    return month(id, cur).then(function (d) {
      return d.categories.filter(function (c) { return !/claim/i.test(c.label); }).map(function (c) { return { name: c.label, icon: guessIcon(c.label) }; });
    });
  });
}
function saveCategories(id, t, cats, user) {
  return readSettings(id, t.meta).then(function (s) {
    s = s || {};
    return writeSettings(id, t.meta, { owner_name: s.owner_name || (user && user.name) || '', owner_email: s.owner_email || (user && user.email) || '', categories: cats });
  });
}
function ensureSettings(id, t, user) {
  return readSettings(id, t.meta).then(function (s) {
    if (s && s.categories && s.categories.length) return s;
    return getCategories(id, t).then(function (cats) {
      return writeSettings(id, t.meta, { owner_name: (s && s.owner_name) || user.name, owner_email: (s && s.owner_email) || user.email, categories: cats }).then(function () { return readSettings(id, t.meta); });
    });
  });
}

/** Add a category: settings + a new SUMIF row at the end of the current month's category table. */
function addCategory(id, t, cat, user) {
  return getCategories(id, t).then(function (cats) {
    if (cats.some(function (c) { return c.name.toLowerCase() === cat.name.toLowerCase(); })) throw new Error('“' + cat.name + '” already exists');
    cats.push(cat);
    var cur = t.months.filter(function (m) { return m.name === t.current; })[0];
    var p = Promise.resolve();
    if (cur) p = month(id, cur).then(function (d) {
      if (d.catHeader < 0) return;
      var at = d.catEnd + 1; // 0-based row index right after last category
      var first = d.header + 2;
      return api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: [
        { insertRange: { range: gr(cur.sheetId, at, at + 1, 4, 6), shiftDimension: 'ROWS' } },
        { copyPaste: { source: gr(cur.sheetId, at - 1, at, 4, 6), destination: gr(cur.sheetId, at, at + 1, 4, 6), pasteType: 'PASTE_FORMAT' } }
      ] }).then(function () {
        return api('PUT', SHEETS + '/' + id + '/values/' + encodeURIComponent(a1(cur.name) + '!E' + (at + 1) + ':F' + (at + 1)) + '?valueInputOption=USER_ENTERED',
          { values: [[cat.name, '=SUMIF($B$' + first + ':$B,E' + (at + 1) + ',$C$' + first + ':$C)']] });
      });
    });
    return p.then(function () { return saveCategories(id, t, cats, user); });
  });
}

/** How many entries use a category, across all month tabs. */
function categoryUsage(id, t, name) {
  var ms = t.months.filter(function (m) { return m.header >= 0; });
  if (!ms.length) return Promise.resolve({ count: 0, months: [] });
  var ranges = ms.map(function (m) { return a1(m.name) + '!B' + (m.header + 2) + ':B'; });
  return api('GET', SHEETS + '/' + id + '/values:batchGet?' + ranges.map(function (r) { return 'ranges=' + encodeURIComponent(r); }).join('&')).then(function (res) {
    var count = 0, months = [];
    res.valueRanges.forEach(function (vr, i) {
      var c = (vr.values || []).filter(function (row) { return str(row[0]) === name; }).length;
      if (c) { count += c; months.push({ name: ms[i].name, count: c }); }
    });
    return { count: count, months: months };
  });
}

/**
 * Remove a category.
 *  mapTo: category to move existing entries to (null = no entries / keep them)
 *  keepHistory: true = leave past months untouched (only the current month's table row is removed)
 */
function removeCategory(id, t, name, mapTo, keepHistory, user) {
  return getCategories(id, t).then(function (cats) {
    var tabsToScan = keepHistory || !mapTo ? t.months.filter(function (m) { return m.name === t.current; }) : t.months.concat(t.summaries);
    return Promise.all(tabsToScan.map(function (tb) { return month(id, tb).then(function (d) { return { tab: tb, d: d }; }); })).then(function (all) {
      var requests = [];
      all.forEach(function (x) {
        var tb = x.tab, d = x.d;
        if (mapTo && !keepHistory && d.header >= 0) {
          requests.push({ findReplace: { find: name, replacement: mapTo, matchCase: true, matchEntireCell: true, range: gr(tb.sheetId, d.header + 1, tb.rowCount, 1, 2) } });
        }
        var rowX = null, rowY = null;
        d.categories.forEach(function (c) { if (c.label === name) rowX = c.row; if (mapTo && c.label === mapTo) rowY = c.row; });
        if (!rowX) return;
        if (mapTo && !keepHistory && !rowY) {
          requests.push({ updateCells: { range: gr(tb.sheetId, rowX - 1, rowX, 4, 5), rows: [{ values: [{ userEnteredValue: { stringValue: mapTo } }] }], fields: 'userEnteredValue' } });
        } else {
          requests.push({ _delete: true, sheetId: tb.sheetId, row: rowX });
        }
      });
      // row deletions bottom-up per sheet so indexes stay valid
      var dels = requests.filter(function (r) { return r._delete; }).sort(function (a, b) { return b.row - a.row; })
        .map(function (r) { return { deleteRange: { range: gr(r.sheetId, r.row - 1, r.row, 4, 6), shiftDimension: 'ROWS' } }; });
      var rest = requests.filter(function (r) { return !r._delete; });
      var all2 = rest.concat(dels);
      var p = all2.length ? api('POST', SHEETS + '/' + id + ':batchUpdate', { requests: all2 }) : Promise.resolve();
      return p.then(function () {
        var next = cats.filter(function (c) { return c.name !== name; });
        if (mapTo && !next.some(function (c) { return c.name === mapTo; })) next.push({ name: mapTo, icon: guessIcon(mapTo) });
        return saveCategories(id, t, next, user);
      });
    });
  });
}
function updateCategoryIcon(id, t, name, icon, user) {
  return getCategories(id, t).then(function (cats) {
    cats.forEach(function (c) { if (c.name === name) c.icon = icon; });
    return saveCategories(id, t, cats, user);
  });
}

window.HisaabDB = {
  MONTHS: MONTHS, DEFAULT_CATEGORIES: DEFAULT_CATEGORIES, guessIcon: guessIcon, monthKey: monthKey, monthName: monthName,
  login: login, handleRedirect: handleRedirect, logout: logout, getAuth: getAuth, tokenValid: tokenValid, me: me,
  findOwnSheet: findOwnSheet, suggestExisting: suggestExisting, fileInfo: fileInfo, markSheet: markSheet, sharedWithMe: sharedWithMe,
  share: share, listPermissions: listPermissions, removePermission: removePermission,
  tabs: tabs, month: month, addEntry: addEntry, deleteEntry: deleteEntry, setIncome: setIncome,
  createSpreadsheet: createSpreadsheet, createMonth: createMonth, ensureSettings: ensureSettings,
  getCategories: getCategories, addCategory: addCategory, categoryUsage: categoryUsage, removeCategory: removeCategory, updateCategoryIcon: updateCategoryIcon
};
})();
