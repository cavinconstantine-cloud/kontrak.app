// Buku Proyek — server sederhana (Node.js, tanpa dependensi)
// Jalankan: node server.js   → buka http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
// STORAGE_DIR: folder penyimpanan tetap (disk/volume di hosting). Default: folder aplikasi.
const STORE = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : ROOT;
const DATA = path.join(STORE, 'data');
const UPLOADS = path.join(STORE, 'uploads');
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(DATA, 'db.json');
const CFG_FILE = path.join(DATA, 'config.json');

for (const d of [DATA, UPLOADS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

// ---------- konfigurasi & password ----------
const hash = (pw, salt) => crypto.createHash('sha256').update(salt + ':' + pw).digest('hex');
function loadConfig() {
  if (!fs.existsSync(CFG_FILE)) {
    const salt = crypto.randomBytes(8).toString('hex');
    const cfg = {
      salt,
      // Password awal — GANTI setelah dipasang:  node setpass.js owner PasswordBaru
      users: {
        owner: { name: 'Pak Budi', hash: hash('owner123', salt) },
        admin: { name: 'Rina', hash: hash('admin123', salt) },
        mandor: { name: 'Pak Joko', hash: hash('mandor123', salt) }
      },
      approvalLimit: 10000000, // di atas ini nota harus disetujui Owner
      siteRadiusM: 300,        // absen dianggap di lokasi bila ≤ 300 m dari titik proyek
      ppn: 0.11, pph: 0.0265, overhead: 0.04, bunga: 0.012
    };
    fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
  }
  return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
}
let CFG = loadConfig();

// ---------- "database" file JSON ----------
let DB;
function seed() {
  const mx = require('./seed-matrix.js');
  return {
    seq: 100,
    matrix: { version: 'v15', date: '2026-10-12', items: mx },
    projects: [{
      id: 'p1', name: 'Ruko 3 Lantai', client: 'PT Sinar Abadi', address: 'Jl. Raya Bekasi KM 21', lat: -6.2335, lng: 106.9929,
      status: 'berjalan', buk: 15, start: '2026-10-08', months: 7, dp: 0.2, retensi: 0.05, mandor: 'mandor',
      divisions: [['Persiapan', 32e6], ['Tanah & pondasi', 118e6], ['Struktur beton (K-300 ready mix)', 362e6], ['Dinding', 96e6], ['Atap', 34e6], ['Kusen, pintu & jendela', 64e6], ['Lantai', 82e6], ['Plafon & cat', 71e6], ['Sanitasi', 46e6], ['Listrik', 42e6], ['Lain-lain', 85e6]].map((d, i) => ({ id: i, name: d[0], rap: d[1], progress: 0, verified: 0 })),
      termins: [{ n: 1, label: 'Termin 1', pct: 0.3, atProgress: 0.3 }, { n: 2, label: 'Termin 2', pct: 0.3, atProgress: 0.6 }, { n: 3, label: 'Termin 3', pct: 0.4, atProgress: 1 }],
      kasAwal: 400e6
    }],
    attendance: [], reports: [], notas: [], invoices: [], log: []
  };
}
function loadDB() { DB = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : seed(); saveDB(); }
let saveT = null;
function saveDB() { clearTimeout(saveT); saveT = setTimeout(() => fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 1)), 50); }
const nid = (p) => p + (++DB.seq);
const now = () => new Date().toISOString();
function logEv(who, text, projectId) { DB.log.unshift({ id: nid('l'), ts: now(), who, text, projectId }); DB.log = DB.log.slice(0, 300); }

// ---------- hitungan proyek ----------
function voSum(p) { return (p.vos || []).filter((v) => v.status === 'ok').reduce((a, v) => a + v.price, 0); }
function contractOf(p) { return p.divisions.reduce((a, d) => a + d.rap, 0) * (1 + p.buk / 100) + voSum(p); }
function rapOf(p) { return p.divisions.reduce((a, d) => a + d.rap, 0); }
function progressOf(p, key) { const rap = rapOf(p); return rap ? p.divisions.reduce((a, d) => a + d.rap * (d[key] || 0) / 100, 0) / rap : 0; }
function summary(p) {
  const K = contractOf(p), rap = rapOf(p), cut = CFG.overhead + CFG.bunga + CFG.pph;
  const prog = progressOf(p, 'progress'), vprog = progressOf(p, 'verified');
  const approved = DB.notas.filter((n) => n.projectId === p.id && n.status === 'approved').reduce((a, n) => a + n.amount, 0);
  const extra = DB.notas.filter((n) => n.projectId === p.id && n.status === 'approved' && n.overMarket > 0).reduce((a, n) => a + n.overMarket, 0);
  const paid = DB.invoices.filter((i) => i.projectId === p.id && i.status === 'paid');
  const dpIn = DB.invoices.find((i) => i.projectId === p.id && i.termin === 0 && i.status === 'paid') ? K * p.dp * (1 - CFG.pph) : 0;
  const kas = p.kasAwal + dpIn + paid.filter((i) => i.termin > 0).reduce((a, i) => a + i.net - i.pph, 0) - approved;
  const labaAkhir = K - rap - extra - K * cut;
  const floorBuk = Math.ceil((1 / (1 - cut) - 1) * 100);
  const net = (K - rap - K * cut) / K;
  const zone = p.buk < floorBuk ? 'Rugi' : net < 0.05 ? 'Tipis' : p.buk > (p.offer ? 25 : 20) ? 'Di atas wajar' : 'Aman';  // proyek dari Konsultan: margin sudah memuat cadangan risiko
  const pendingN = DB.notas.filter((n) => n.projectId === p.id && (n.status === 'pending' || n.status === 'owner')).length;
  return { contract: K, vo: voSum(p), rap, progress: prog, verified: vprog, spent: approved, overMarket: extra, kas, labaAkhir, labaPct: K ? labaAkhir / K : 0, net, zone, floorBuk, revenue: vprog * K, pendingN,
    receivable: DB.invoices.filter((i) => i.projectId === p.id && i.status === 'sent').reduce((a, i) => a + i.transfer, 0) };
}
function invoiceCalc(p, termin, progressPct) {
  const K = contractOf(p);
  if (termin === 0) { const dp = K * p.dp; return { termin: 0, label: 'Uang muka (DP)', bruto: dp, potDP: 0, retensi: 0, net: dp, ppn: dp * CFG.ppn, pph: dp * CFG.pph, transfer: dp + dp * CFG.ppn - dp * CFG.pph }; }
  const t = p.termins.find((x) => x.n === termin);
  const bruto = t.pct * K, potDP = p.dp * bruto, retensi = p.retensi * bruto, net = bruto - potDP - retensi, dasar = bruto - potDP;
  return { termin, label: t.label, progressPct, bruto, potDP, retensi, net, ppn: dasar * CFG.ppn, pph: dasar * CFG.pph, transfer: net + dasar * CFG.ppn - dasar * CFG.pph };
}
function distM(a, b, c, d) { const R = 6371e3, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r; const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

// ---------- sesi ----------
const sessions = new Map();
function parseCookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1)); }); return o; }
function userOf(req) { const s = sessions.get(parseCookies(req).bp); return s || null; }

// ---------- upload gambar (base64 → file) ----------
function savePhoto(dataUrl, prefix) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) return null;
  const name = prefix + '-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}

// ---------- API ----------
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const bad = (res, msg, code = 400) => json(res, code, { error: msg });
const projectFor = (u, id) => { const p = DB.projects.find((x) => x.id === id); if (!p) return null; if (u.role === 'mandor' && p.mandor !== u.role) return null; return p; };
const canMoney = (u) => u.role === 'owner' || u.role === 'admin';
const viewProject = (u, p) => { const base = { id: p.id, name: p.name, client: p.client, address: p.address, lat: p.lat, lng: p.lng, status: p.status, start: p.start, divisions: p.divisions.map((d) => ({ id: d.id, name: d.name, progress: d.progress, verified: d.verified })) }; if (!canMoney(u)) return base; return Object.assign(base, { buk: p.buk, dp: p.dp, retensi: p.retensi, months: p.months, termins: p.termins, kasAwal: p.kasAwal, divisions: p.divisions, vos: p.vos || [], offer: p.offer || null, summary: summary(p) }); };

const routes = {
  'POST /api/login': (req, res, b) => {
    const u = CFG.users[b.role];
    if (!u || hash(String(b.password || ''), CFG.salt) !== u.hash) return bad(res, 'Peran atau password salah', 401);
    const tok = crypto.randomBytes(24).toString('hex');
    const user = { role: b.role, name: u.name };
    sessions.set(tok, user);
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.setHeader('Set-Cookie', 'bp=' + tok + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' + secure);
    json(res, 200, { user });
  },
  'POST /api/logout': (req, res) => { sessions.delete(parseCookies(req).bp); res.setHeader('Set-Cookie', 'bp=; Path=/; Max-Age=0'); json(res, 200, { ok: true }); },
  'GET /api/me': (req, res, b, u) => json(res, 200, { user: u, config: { approvalLimit: CFG.approvalLimit, ppn: CFG.ppn, pph: CFG.pph, overhead: CFG.overhead, bunga: CFG.bunga, siteRadiusM: CFG.siteRadiusM } }),
  'POST /api/password': (req, res, b, u) => {
    if (hash(String(b.old || ''), CFG.salt) !== CFG.users[u.role].hash) return bad(res, 'Password lama salah');
    if (String(b.new || '').length < 6) return bad(res, 'Password baru minimal 6 karakter');
    CFG.users[u.role].hash = hash(String(b.new), CFG.salt); fs.writeFileSync(CFG_FILE, JSON.stringify(CFG, null, 2)); json(res, 200, { ok: true });
  },

  'GET /api/state': (req, res, b, u) => {
    const projects = DB.projects.filter((p) => u.role !== 'mandor' || p.mandor === u.role).map((p) => viewProject(u, p));
    const pid = new Set(projects.map((p) => p.id));
    const mine = (x) => pid.has(x.projectId);
    const notas = DB.notas.filter(mine).map((n) => canMoney(u) ? n : { id: n.id, projectId: n.projectId, ts: n.ts, type: n.type, desc: n.desc, amount: n.amount, shop: n.shop, photo: n.photo, status: n.status, note: n.note });
    json(res, 200, { user: u, projects, attendance: DB.attendance.filter(mine).slice(-200), reports: DB.reports.filter(mine), notas,
      invoices: canMoney(u) ? DB.invoices.filter(mine) : [], matrix: canMoney(u) ? DB.matrix : null, catalog: DB.matrix.items.map((x) => ({ key: x.key, name: x.name, unit: x.unit })), config: { approvalLimit: CFG.approvalLimit, ppn: CFG.ppn, pph: CFG.pph, overhead: CFG.overhead, bunga: CFG.bunga, siteRadiusM: CFG.siteRadiusM }, log: DB.log.filter((l) => !l.projectId || pid.has(l.projectId)).slice(0, 40) });
  },

  // ----- mandor -----
  'POST /api/absen': (req, res, b, u) => {
    const p = projectFor(u, b.projectId); if (!p) return bad(res, 'Proyek tidak ditemukan');
    const photo = savePhoto(b.photo, 'absen'); if (!photo) return bad(res, 'Foto selfie wajib');
    const hasLoc = typeof b.lat === 'number' && typeof b.lng === 'number';
    const d = hasLoc ? Math.round(distM(b.lat, b.lng, p.lat, p.lng)) : null;
    const rec = { id: nid('a'), projectId: p.id, who: u.role, name: u.name, ts: now(), type: b.type === 'pulang' ? 'pulang' : 'masuk', lat: b.lat, lng: b.lng, distM: d, onSite: d != null && d <= CFG.siteRadiusM, photo, workers: Number(b.workers) || 0 };
    DB.attendance.push(rec); logEv(u.name, 'Absen ' + rec.type + (rec.onSite ? ' di lokasi' : d == null ? ' (tanpa lokasi)' : ' — ' + d + ' m dari proyek') + (rec.workers ? ' · ' + rec.workers + ' tukang hadir' : ''), p.id); saveDB(); json(res, 200, rec);
  },
  'POST /api/report': (req, res, b, u) => {
    const p = projectFor(u, b.projectId); if (!p) return bad(res, 'Proyek tidak ditemukan');
    const today = now().slice(0, 10);
    if (u.role === 'mandor' && !DB.attendance.some((a) => a.projectId === p.id && a.who === u.role && a.ts.slice(0, 10) === today && a.onSite)) return bad(res, 'Absen masuk di lokasi dulu sebelum lapor progres');
    const photos = (b.photos || []).map((x) => savePhoto(x, 'lapor')).filter(Boolean);
    if (photos.length < 1) return bad(res, 'Minimal 1 foto');
    const items = (b.items || []).map((it) => ({ div: Number(it.div), pct: Math.max(0, Math.min(100, Number(it.pct) || 0)) })).filter((it) => p.divisions[it.div]);
    items.forEach((it) => { p.divisions[it.div].progress = it.pct; });
    const rec = { id: nid('r'), projectId: p.id, who: u.role, name: u.name, ts: now(), items, note: String(b.note || '').slice(0, 500), photos, verified: false };
    DB.reports.push(rec); logEv(u.name, 'Lapor progres: ' + items.map((it) => p.divisions[it.div].name + ' ' + it.pct + '%').join(', '), p.id); saveDB(); json(res, 200, rec);
  },
  'POST /api/nota': (req, res, b, u) => {
    const p = projectFor(u, b.projectId); if (!p) return bad(res, 'Proyek tidak ditemukan');
    const photo = savePhoto(b.photo, 'nota'); if (!photo) return bad(res, 'Foto nota wajib');
    const amount = Math.round(Number(b.amount) || 0); if (amount <= 0) return bad(res, 'Nominal harus diisi');
    const n = { id: nid('n'), projectId: p.id, who: u.role, name: u.name, ts: now(), type: b.type || 'material', desc: String(b.desc || '').slice(0, 200), shop: String(b.shop || '').slice(0, 100), amount, qty: Number(b.qty) || null, unitKey: b.unitKey || null, photo, status: 'pending', check: null, overMarket: 0 };
    // cek otomatis terhadap matriks harga
    if (n.unitKey && n.qty) { const it = DB.matrix.items.find((x) => x.key === n.unitKey); if (it) { const unit = amount / n.qty, d = unit / it.typ - 1; n.check = { item: it.name, unit, market: it.typ, high: it.high, diff: d, flag: unit > it.high ? 'tinggi' : unit < it.low ? 'rendah' : 'wajar' }; n.overMarket = Math.max(0, (unit - it.typ) * n.qty); } }
    DB.notas.push(n); logEv(u.name, 'Kirim nota ' + n.desc + ' Rp ' + amount.toLocaleString('id-ID') + (n.check ? ' · ' + n.check.flag + ' vs pasar' : ''), p.id); saveDB(); json(res, 200, n);
  },

  // ----- admin / owner -----
  'POST /api/nota/decide': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const n = DB.notas.find((x) => x.id === b.id); if (!n) return bad(res, 'Nota tidak ada');
    if (b.decision === 'reject') { n.status = 'rejected'; n.note = String(b.note || ''); n.by = u.name; logEv(u.name, 'Tolak nota ' + n.desc + (n.note ? ' — ' + n.note : ''), n.projectId); }
    else if (u.role === 'admin' && n.amount > CFG.approvalLimit) { n.status = 'owner'; n.by = u.name; logEv(u.name, 'Teruskan nota ' + n.desc + ' ke Owner (> batas Admin)', n.projectId); }
    else { n.status = 'approved'; n.by = u.name; n.decidedAt = now(); logEv(u.name, 'Setujui nota ' + n.desc + ' Rp ' + n.amount.toLocaleString('id-ID'), n.projectId); }
    saveDB(); json(res, 200, n);
  },
  'POST /api/verify': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const p = DB.projects.find((x) => x.id === b.projectId); if (!p) return bad(res, 'Proyek tidak ada');
    const r = DB.reports.find((x) => x.id === b.reportId); if (r) { r.verified = true; r.verifiedBy = u.name; r.items.forEach((it) => { p.divisions[it.div].verified = Math.max(p.divisions[it.div].verified, it.pct); }); }
    else (b.items || []).forEach((it) => { if (p.divisions[it.div]) p.divisions[it.div].verified = Math.max(0, Math.min(100, Number(it.pct) || 0)); });
    logEv(u.name, 'Verifikasi progres → ' + Math.round(progressOf(p, 'verified') * 100) + '%', p.id); saveDB(); json(res, 200, viewProject(u, p));
  },
  'POST /api/project/save': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    let p = DB.projects.find((x) => x.id === b.id);
    if (!p) { p = { id: nid('p'), divisions: [], termins: [{ n: 1, label: 'Termin 1', pct: 0.3, atProgress: 0.3 }, { n: 2, label: 'Termin 2', pct: 0.3, atProgress: 0.6 }, { n: 3, label: 'Termin 3', pct: 0.4, atProgress: 1 }], dp: 0.2, retensi: 0.05, kasAwal: 0, status: 'penawaran', mandor: 'mandor', lat: null, lng: null }; DB.projects.push(p); }
    ['name', 'client', 'address', 'status', 'start'].forEach((k) => { if (b[k] != null) p[k] = String(b[k]).slice(0, 200); });
    ['lat', 'lng', 'kasAwal', 'months', 'dp', 'retensi'].forEach((k) => { if (b[k] != null && b[k] !== '') p[k] = Number(b[k]); });
    if (b.buk != null) { const floorBuk = Math.ceil((1 / (1 - (CFG.overhead + CFG.bunga + CFG.pph)) - 1) * 100); p.buk = Math.max(floorBuk, Math.min(25, Number(b.buk) || floorBuk)); }
    if (b.offer && typeof b.offer === 'object') p.offer = b.offer;
    if (Array.isArray(b.divisions)) p.divisions = b.divisions.map((d, i) => ({ id: i, name: String(d.name || '').slice(0, 80), rap: Math.max(0, Number(d.rap) || 0), progress: Number(d.progress) || 0, verified: Number(d.verified) || 0 }));
    logEv(u.name, 'Simpan RAB ' + p.name + ' · BUK ' + p.buk + '%', p.id); saveDB(); json(res, 200, viewProject(u, p));
  },
  'POST /api/vo': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const p = DB.projects.find((x) => x.id === b.projectId); if (!p) return bad(res, 'Proyek tidak ada');
    const cost = Math.round(Number(b.cost) || 0); if (cost <= 0) return bad(res, 'Biaya harus diisi');
    const margin = Math.max(0, Math.min(50, Number(b.margin) || 0)), kind = b.kind === 'minus' ? 'minus' : 'plus';
    const v = { id: nid('v'), ts: now(), desc: String(b.desc || '').slice(0, 200), kind, cost, margin, price: Math.round(cost * (1 + margin / 100)) * (kind === 'minus' ? -1 : 1), status: b.status === 'risk' ? 'risk' : 'wait', by: u.name };
    p.vos = (p.vos || []).concat([v]); logEv(u.name, (kind === 'plus' ? 'Pekerjaan tambah: ' : 'Pekerjaan kurang: ') + v.desc + ' Rp ' + Math.abs(v.price).toLocaleString('id-ID'), p.id); saveDB(); json(res, 200, v);
  },
  'POST /api/vo/status': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const p = DB.projects.find((x) => (x.vos || []).some((v) => v.id === b.id)); if (!p) return bad(res, 'Tidak ada');
    const v = p.vos.find((x) => x.id === b.id); v.status = ['ok', 'wait', 'risk', 'void'].includes(b.status) ? b.status : v.status; if (v.status === 'ok') { v.okBy = String(b.by || '').slice(0, 80); v.okAt = now(); }
    logEv(u.name, 'Tambah-kurang "' + v.desc + '" → ' + ({ ok: 'disetujui klien', wait: 'menunggu klien', risk: 'dikerjakan tanpa persetujuan', void: 'dibatalkan' })[v.status], p.id); saveDB(); json(res, 200, v);
  },
  'POST /api/invoice': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const p = DB.projects.find((x) => x.id === b.projectId); if (!p) return bad(res, 'Proyek tidak ada');
    const t = Number(b.termin);
    if (DB.invoices.some((i) => i.projectId === p.id && i.termin === t && i.status !== 'void')) return bad(res, 'Tagihan termin ini sudah ada');
    const vp = progressOf(p, 'verified');
    if (t > 0) { const tt = p.termins.find((x) => x.n === t); if (!tt) return bad(res, 'Termin tidak ada'); if (vp + 1e-9 < tt.atProgress) return bad(res, 'Progres terverifikasi ' + Math.round(vp * 100) + '% belum mencapai ' + Math.round(tt.atProgress * 100) + '%'); }
    const inv = Object.assign({ id: nid('i'), projectId: p.id, ts: now(), status: 'sent', dueDays: 30 }, invoiceCalc(p, t, Math.round(vp * 100)));
    DB.invoices.push(inv); logEv(u.name, 'Kirim tagihan ' + inv.label + ' Rp ' + Math.round(inv.transfer).toLocaleString('id-ID'), p.id); saveDB(); json(res, 200, inv);
  },
  'POST /api/invoice/paid': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const inv = DB.invoices.find((x) => x.id === b.id); if (!inv) return bad(res, 'Tagihan tidak ada');
    inv.status = 'paid'; inv.paidAt = now(); logEv(u.name, inv.label + ' dibayar klien', inv.projectId); saveDB(); json(res, 200, inv);
  },
  'POST /api/matrix': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const it = DB.matrix.items.find((x) => x.key === b.key); if (!it) return bad(res, 'Item tidak ada');
    ['low', 'typ', 'high'].forEach((k) => { if (b[k] != null) it[k] = Number(b[k]); });
    if (b.src) it.src = String(b.src).slice(0, 120); it.date = now().slice(0, 10);
    DB.matrix.version = 'v' + (Number(DB.matrix.version.slice(1)) + 1); DB.matrix.date = it.date;
    logEv(u.name, 'Matriks ' + DB.matrix.version + ': ' + it.name + ' = Rp ' + it.typ.toLocaleString('id-ID')); saveDB(); json(res, 200, DB.matrix);
  },
  'GET /api/export': (req, res, b, u) => {
    if (!canMoney(u)) return bad(res, 'Tidak berhak', 403);
    const p = DB.projects.find((x) => x.id === (b.projectId || DB.projects[0].id)); if (!p) return bad(res, 'Proyek tidak ada');
    const S = summary(p), lines = [['Buku Proyek — ' + p.name], ['Klien', p.client], [], ['Pekerjaan', 'RAP', 'Harga ke klien', 'Progres lapor', 'Progres verifikasi']];
    p.divisions.forEach((d) => lines.push([d.name, d.rap, d.rap * (1 + p.buk / 100), d.progress + '%', d.verified + '%']));
    lines.push([], ['Nilai kontrak', S.contract], ['RAP', S.rap], ['Biaya disetujui', S.spent], ['Kas', S.kas], ['Pendapatan diakui (PSAK 72)', S.revenue], ['Proyeksi laba bersih', S.labaAkhir]);
    const csv = '﻿' + lines.map((l) => l.map((c) => typeof c === 'number' ? Math.round(c) : '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + p.name.replace(/[^\w]+/g, '_') + '.csv"' }); res.end(csv);
  }
};

// ---------- static ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function serveFile(res, file) {
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); return res.end('Tidak ditemukan'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(buf); });
}

loadDB();
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const key = req.method + ' ' + url.pathname;
  if (url.pathname.startsWith('/api/')) {
    const handler = routes[key];
    if (!handler) return bad(res, 'Rute tidak ada', 404);
    const u = userOf(req);
    if (key !== 'POST /api/login' && !u) return bad(res, 'Silakan masuk dulu', 401);
    if (u && u.role === 'mandor' && !/^(GET \/api\/(me|state)|POST \/api\/(absen|report|nota|logout|password))$/.test(key)) return bad(res, 'Mandor tidak berhak', 403);
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 12 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      let b = {}; try { b = body ? JSON.parse(body) : {}; } catch (e) { return bad(res, 'JSON tidak valid'); }
      url.searchParams.forEach((v, k) => { if (b[k] == null) b[k] = v; });
      try { handler(req, res, b, u); } catch (e) { console.error(e); bad(res, 'Kesalahan server', 500); }
    });
    return;
  }
  if (url.pathname.startsWith('/uploads/')) { if (!userOf(req)) { res.writeHead(401); return res.end(); } return serveFile(res, path.join(UPLOADS, path.basename(url.pathname))); }
  const f = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const file = path.normalize(path.join(ROOT, 'public', f));
  if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  serveFile(res, fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(ROOT, 'public', 'index.html'));
}).listen(PORT, () => console.log('Buku Proyek jalan di http://localhost:' + PORT + '\nPassword awal: owner123 / admin123 / mandor123 — ganti dengan: node setpass.js <owner|admin|mandor> <password>'));
