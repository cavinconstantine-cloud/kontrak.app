/* Adapter data untuk versi web (claude.ai Artifact): penyimpanan db + assets, hitungan di sisi klien.
   Antarmuka sama dengan public/api.js. Dibangun jadi satu file HTML oleh web/build.js. */
'use strict';
window.API = (() => {
  let dbh = null, assetsh = null, user = null;
  const D = { config: null, matrix: null, log: [], projects: [], attendance: [], reports: [], notas: [], invoices: [] };
  const DEFAULT_CFG = { approvalLimit: 10000000, siteRadiusM: 300, ppn: 0.11, pph: 0.0265, overhead: 0.04, bunga: 0.012 };
  const CFG = () => Object.assign({}, DEFAULT_CFG, D.config || {});
  const now = () => new Date().toISOString();
  const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fail = (m) => { throw new Error(m); };
  const rp = (v) => 'Rp ' + Math.round(Math.abs(v || 0)).toLocaleString('id-ID');
  async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
  const remember = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const recall = (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } };
  function shrink(file, max = 1024) { return new Promise((res, rej) => { const im = new Image(); const url = window.URL.createObjectURL(file); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); window.URL.revokeObjectURL(url); c.toBlob((b) => b ? res(b) : rej(new Error('gagal')), 'image/jpeg', 0.72); }; im.onerror = rej; im.src = url; }); }
  async function upload(file, max) { if (!assetsh) fail('Unggah foto tidak aktif: akun ini hanya punya akses "lihat" pada halaman ini.'); const blob = await shrink(file, max); const r = await assetsh.upload(blob, { type: 'image/jpeg' }); return r.id; }
  async function put(coll, id, obj) { await dbh.doc(coll + '/' + id).set(obj); }
  async function logEv(text, projectId) { const items = [{ id: nid('l'), ts: now(), who: user ? user.name : 'Sistem', text, projectId: projectId || null }].concat(D.log).slice(0, 200); D.log = items; await dbh.doc('app/log').set({ items }); }
  const changed = () => { if (window.onDataChange) window.onDataChange(); };

  // ---- hitungan (sama dengan server.js) ----
  const rapOf = (p) => p.divisions.reduce((a, d) => a + d.rap, 0), voSum = (p) => (p.vos || []).filter((v) => v.status === 'ok').reduce((a, v) => a + v.price, 0), contractOf = (p) => rapOf(p) * (1 + p.buk / 100) + voSum(p);
  const progressOf = (p, k) => { const r = rapOf(p); return r ? p.divisions.reduce((a, d) => a + d.rap * (d[k] || 0) / 100, 0) / r : 0; };
  function summary(p) {
    const C = CFG(), K = contractOf(p), rap = rapOf(p), cut = C.overhead + C.bunga + C.pph, prog = progressOf(p, 'progress'), vprog = progressOf(p, 'verified');
    const ap = D.notas.filter((n) => n.projectId === p.id && n.status === 'approved'), approved = ap.reduce((a, n) => a + n.amount, 0), extra = ap.reduce((a, n) => a + (n.overMarket || 0), 0);
    const paid = D.invoices.filter((i) => i.projectId === p.id && i.status === 'paid'), dpIn = paid.find((i) => i.termin === 0) ? K * p.dp * (1 - C.pph) : 0;
    const kas = (p.kasAwal || 0) + dpIn + paid.filter((i) => i.termin > 0).reduce((a, i) => a + i.net - i.pph, 0) - approved;
    const labaAkhir = K - rap - extra - K * cut, floorBuk = Math.ceil((1 / (1 - cut) - 1) * 100), net = K ? (K - rap - K * cut) / K : 0;
    const zone = p.buk < floorBuk ? 'Rugi' : net < 0.05 ? 'Tipis' : p.buk > (p.offer ? 25 : 20) ? 'Di atas wajar' : 'Aman';  // proyek dari Konsultan: margin sudah memuat cadangan risiko
    return { contract: K, vo: voSum(p), rap, progress: prog, verified: vprog, spent: approved, overMarket: extra, kas, labaAkhir, labaPct: K ? labaAkhir / K : 0, net, zone, floorBuk, revenue: vprog * K, pendingN: D.notas.filter((n) => n.projectId === p.id && (n.status === 'pending' || n.status === 'owner')).length, receivable: D.invoices.filter((i) => i.projectId === p.id && i.status === 'sent').reduce((a, i) => a + i.transfer, 0) };
  }
  function invoiceCalc(p, termin, progressPct) {
    const C = CFG(), K = contractOf(p);
    if (termin === 0) { const dp = K * p.dp; return { termin: 0, label: 'Uang muka (DP)', bruto: dp, potDP: 0, retensi: 0, net: dp, ppn: dp * C.ppn, pph: dp * C.pph, transfer: dp + dp * C.ppn - dp * C.pph }; }
    const t = p.termins.find((x) => x.n === termin), bruto = t.pct * K, potDP = p.dp * bruto, retensi = p.retensi * bruto, net = bruto - potDP - retensi, dasar = bruto - potDP;
    return { termin, label: t.label, progressPct, bruto, potDP, retensi, net, ppn: dasar * C.ppn, pph: dasar * C.pph, transfer: net + dasar * C.ppn - dasar * C.pph };
  }
  function distM(a, b, c, d) { const R = 6371e3, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r; const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
  const canMoney = () => user && user.role !== 'mandor';
  const myProjects = () => D.projects.filter((p) => !user || user.role !== 'mandor' || (p.mandor || 'mandor') === 'mandor');
  const projectFor = (id) => myProjects().find((p) => p.id === id) || fail('Proyek tidak ditemukan');
  const viewProject = (p) => { const base = { mutus: Array.from(new Set((p.struct || []).filter((e) => e.met !== 'manual').map((e) => e.mutu))), id: p.id, name: p.name, client: p.client, address: p.address, lat: p.lat, lng: p.lng, status: p.status, start: p.start, divisions: p.divisions.map((d) => ({ id: d.id, name: d.name, progress: d.progress, verified: d.verified })) }; return canMoney() ? Object.assign(base, { buk: p.buk, dp: p.dp, retensi: p.retensi, termins: p.termins, kasAwal: p.kasAwal, divisions: p.divisions, vos: p.vos || [], offer: p.offer || null, struct: p.struct || null, structPerCor: p.structPerCor || 20, interior: p.interior || null, area: p.area || (p.offer && p.offer.area) || null, lantai: p.lantai || null, summary: summary(p) }) : base; };

  function subscribe() {
    dbh.doc('app/config').onSnapshot((s) => { D.config = s.exists ? s.data() : null; D.ready = true; changed(); }, (e) => console.error(e));
    dbh.doc('app/matrix').onSnapshot((s) => { D.matrix = s.exists ? s.data() : null; changed(); });
    dbh.doc('app/log').onSnapshot((s) => { D.log = s.exists ? (s.data().items || []) : []; changed(); });
    for (const c of ['projects', 'attendance', 'reports', 'notas', 'invoices']) dbh.collection(c).onSnapshot((q) => { D[c] = q.docs.map((d) => d.data()).sort((a, b) => String(a.ts || a.id).localeCompare(String(b.ts || b.id))); changed(); }, (e) => console.error(c, e));
  }
  return {
    kind: 'artifact',
    async init() {
      const has = window.claude && typeof window.claude.use === 'function';
      dbh = has ? await window.claude.use('db') : null;
      if (!dbh) return { error: 'Halaman ini harus dibuka lewat claude.ai dengan akun yang diberi akses. Muat ulang dan izinkan "data" saat diminta.' };
      subscribe(); assetsh = await window.claude.use('assets');
      await new Promise((res) => { const t = setInterval(() => { if (D.ready) { clearInterval(t); res(); } }, 50); setTimeout(() => { clearInterval(t); res(); }, 10000); });
      return {};
    },
    async me() { user = recall('bp-user'); return user; },
    async login(role, password) { const c = D.config; if (!c || !c.users) fail('Aplikasi belum disiapkan (data awal belum ada)'); const u = c.users[role]; if (!u || (await sha(c.salt + ':' + password)) !== u.hash) fail('Peran atau password salah'); user = { role, name: u.name }; remember('bp-user', user); return user; },
    async logout() { user = null; remember('bp-user', null); },
    async state() {
      const projects = myProjects().map(viewProject), pid = new Set(projects.map((p) => p.id)), mine = (x) => pid.has(x.projectId);
      const notas = D.notas.filter(mine).map((n) => canMoney() ? n : { id: n.id, projectId: n.projectId, ts: n.ts, type: n.type, desc: n.desc, amount: n.amount, shop: n.shop, photo: n.photo, status: n.status, note: n.note, name: n.name });
      return { user, projects, attendance: D.attendance.filter(mine).slice(-200), reports: D.reports.filter(mine), notas, invoices: canMoney() ? D.invoices.filter(mine) : [], matrix: canMoney() ? D.matrix : null, catalog: D.matrix ? D.matrix.items.map((x) => ({ key: x.key, name: x.name, unit: x.unit })) : [], config: CFG(), log: D.log.filter((l) => !l.projectId || pid.has(l.projectId)).slice(0, 40), setupMissing: !D.config };
    },
    async password(oldPw, newPw) { const c = D.config; if ((await sha(c.salt + ':' + oldPw)) !== c.users[user.role].hash) fail('Password lama salah'); if (String(newPw).length < 6) fail('Password baru minimal 6 karakter'); const users = Object.assign({}, c.users, { [user.role]: Object.assign({}, c.users[user.role], { hash: await sha(c.salt + ':' + newPw) }) }); await dbh.doc('app/config').update({ users }); },
    async absen(b) {
      const p = projectFor(b.projectId), photo = await upload(b.file, 800);
      const hasLoc = typeof b.lat === 'number' && typeof b.lng === 'number' && p.lat != null, d = hasLoc ? Math.round(distM(b.lat, b.lng, p.lat, p.lng)) : null;
      const rec = { id: nid('a'), projectId: p.id, who: user.role, name: user.name, ts: now(), type: b.type === 'pulang' ? 'pulang' : 'masuk', lat: b.lat ?? null, lng: b.lng ?? null, distM: d, onSite: d != null && d <= CFG().siteRadiusM, photo, workers: Number(b.workers) || 0 };
      await put('attendance', rec.id, rec); await logEv('Absen ' + rec.type + (rec.onSite ? ' di lokasi' : d == null ? ' (tanpa lokasi)' : ' — ' + d + ' m dari proyek') + (rec.workers ? ' · ' + rec.workers + ' tukang hadir' : ''), p.id); return rec;
    },
    async report(b) {
      const p = projectFor(b.projectId), today = now().slice(0, 10);
      if (user.role === 'mandor' && !D.attendance.some((a) => a.projectId === p.id && a.who === 'mandor' && a.ts.slice(0, 10) === today && a.onSite)) fail('Absen masuk di lokasi dulu sebelum lapor progres');
      if (!b.files.length) fail('Minimal 1 foto');
      const photos = []; for (const f of b.files.slice(0, 8)) photos.push(await upload(f));
      const items = b.items.filter((it) => p.divisions[it.div]), divisions = p.divisions.map((d) => Object.assign({}, d)); items.forEach((it) => { divisions[it.div].progress = it.pct; });
      const rec = { id: nid('r'), projectId: p.id, who: user.role, name: user.name, ts: now(), items, note: String(b.note || '').slice(0, 500), photos, verified: false };
      await put('reports', rec.id, rec); await dbh.doc('projects/' + p.id).update({ divisions }); await logEv('Lapor progres: ' + items.map((it) => (p.divisions[it.div].grp ? p.divisions[it.div].grp + ' · ' : '') + p.divisions[it.div].name + ' ' + it.pct + '%').join(', '), p.id); return rec;
    },
    async nota(b) {
      const p = projectFor(b.projectId), amount = Math.round(Number(b.amount) || 0); if (amount <= 0 && b.type !== 'readymix') fail('Nominal harus diisi'); const photo = await upload(b.file);
      const rm = b.type === 'readymix' && b.rm ? { mutu: String(b.rm.mutu || ''), vol: Number(b.rm.vol) || 0, out: String(b.rm.out || ''), arrive: String(b.rm.arrive || ''), slump: String(b.rm.slump || '') } : null;
      const n = { id: nid('n'), projectId: p.id, who: user.role, name: user.name, ts: now(), type: b.type || 'material', desc: String(b.desc || '').slice(0, 200), shop: String(b.shop || '').slice(0, 100), amount, qty: Number(b.qty) || null, unitKey: b.unitKey || null, photo, status: 'pending', check: null, overMarket: 0, note: '' };
      if (rm) { n.rm = rm; n.rmCheck = BETON.ticketCheck(rm, p.struct); n.desc = n.desc || ('Tiket ready mix ' + rm.mutu + ' · ' + rm.vol + ' m³'); if (amount > 0) { n.unitKey = 'rm' + rm.mutu.replace('-', ''); n.qty = rm.vol; } }
      if (n.unitKey && n.qty && D.matrix) { const it = D.matrix.items.find((x) => x.key === n.unitKey); if (it) { const unit = amount / n.qty, diff = unit / it.typ - 1; n.check = { item: it.name, unit, market: it.typ, high: it.high, diff, flag: unit > it.high ? 'tinggi' : unit < it.low ? 'rendah' : 'wajar' }; n.overMarket = Math.max(0, (unit - it.typ) * n.qty); } }
      await put('notas', n.id, n); await logEv((rm ? 'Kirim tiket ready mix ' + rm.mutu + ' ' + rm.vol + ' m³' + (n.rmCheck.late ? ' · ' + n.rmCheck.minutes + ' menit di jalan' : '') + (!n.rmCheck.mutuOk ? ' · mutu beda dari RAB' : '') : 'Kirim nota ' + n.desc + ' ' + rp(amount)) + (n.check ? ' · ' + n.check.flag + ' vs pasar' : ''), p.id); return n;
    },
    async decide(id, decision, note) {
      const n = D.notas.find((x) => x.id === id) || fail('Nota tidak ada'); let patch;
      if (decision === 'reject') { patch = { status: 'rejected', note: note || '', by: user.name }; await logEv('Tolak nota ' + n.desc + (note ? ' — ' + note : ''), n.projectId); }
      else if (user.role === 'admin' && n.amount > CFG().approvalLimit) { patch = { status: 'owner', by: user.name }; await logEv('Teruskan nota ' + n.desc + ' ke Owner (> batas Admin)', n.projectId); }
      else { patch = { status: 'approved', by: user.name, decidedAt: now() }; await logEv('Setujui nota ' + n.desc + ' ' + rp(n.amount), n.projectId); }
      await dbh.doc('notas/' + id).update(patch); return patch.status;
    },
    async verify(projectId, reportId) {
      const p = D.projects.find((x) => x.id === projectId) || fail('Proyek tidak ada'), r = D.reports.find((x) => x.id === reportId) || fail('Laporan tidak ada');
      const divisions = p.divisions.map((d) => Object.assign({}, d)); r.items.forEach((it) => { if (divisions[it.div]) divisions[it.div].verified = Math.max(divisions[it.div].verified || 0, it.pct); });
      await dbh.doc('reports/' + reportId).update({ verified: true, verifiedBy: user.name }); await dbh.doc('projects/' + p.id).update({ divisions }); await logEv('Verifikasi progres → ' + Math.round(progressOf({ divisions }, 'verified') * 100) + '%', p.id);
    },
    async saveProject(b) {
      let p = D.projects.find((x) => x.id === b.id);
      if (!p) p = { id: nid('p'), divisions: [], termins: [{ n: 1, label: 'Termin 1', pct: 0.3, atProgress: 0.3 }, { n: 2, label: 'Termin 2', pct: 0.3, atProgress: 0.6 }, { n: 3, label: 'Termin 3', pct: 0.4, atProgress: 1 }], dp: 0.2, retensi: 0.05, kasAwal: 0, status: 'penawaran', mandor: 'mandor', lat: null, lng: null, buk: 15, ts: now() };
      p = Object.assign({}, p);
      ['name', 'client', 'address', 'status', 'start'].forEach((k) => { if (b[k] != null) p[k] = String(b[k]).slice(0, 200); });
      ['lat', 'lng', 'kasAwal'].forEach((k) => { if (b[k] != null && b[k] !== '') p[k] = Number(b[k]); });
      const C = CFG(), floorBuk = Math.ceil((1 / (1 - (C.overhead + C.bunga + C.pph)) - 1) * 100);
      if (b.buk != null) p.buk = Math.max(floorBuk, Math.min(25, Number(b.buk) || floorBuk));
      if (b.offer && typeof b.offer === 'object') p.offer = b.offer;
      if (Array.isArray(b.struct)) p.struct = b.struct.slice(0, 160).map((e) => ({ grp: e.grp ? String(e.grp).slice(0, 60) : null, el: String(e.el), mutu: String(e.mutu), met: String(e.met), baja: String(e.baja || 'bjts'), vol: Number(e.vol) || 0, ratio: e.ratio === '' || e.ratio == null ? null : Number(e.ratio), slab: e.slab === 'bondek' ? 'bondek' : 'konv' }));
      if (b.structPerCor != null) p.structPerCor = Number(b.structPerCor) || 20;
      if (Array.isArray(b.interior)) p.interior = b.interior.slice(0, 40).map((r) => ({ key: String(r.key), by: ['k', 'j', 'x'].includes(r.by) ? r.by : 'k', qty: Number(r.qty) || 0 }));
      ['area', 'lantai'].forEach((k) => { if (b[k] != null && b[k] !== '') p[k] = Number(b[k]); });
      if (Array.isArray(b.divisions)) p.divisions = b.divisions.map((d, i) => ({ id: i, src: d.src || null, grp: d.grp ? String(d.grp).slice(0, 60) : null, name: String(d.name || '').slice(0, 80), rap: Math.max(0, Number(d.rap) || 0), progress: Number(d.progress) || 0, verified: Number(d.verified) || 0 }));
      await put('projects', p.id, p); await logEv('Simpan RAB ' + p.name + ' · BUK ' + p.buk + '%', p.id); return viewProject(p);
    },
    async vo(b) {
      const p = D.projects.find((x) => x.id === b.projectId) || fail('Proyek tidak ada'); const cost = Math.round(Number(b.cost) || 0); if (cost <= 0) fail('Biaya harus diisi');
      const margin = Math.max(0, Math.min(50, Number(b.margin) || 0)), kind = b.kind === 'minus' ? 'minus' : 'plus';
      const v = { id: nid('v'), ts: now(), desc: String(b.desc || '').slice(0, 200), kind, cost, margin, price: Math.round(cost * (1 + margin / 100)) * (kind === 'minus' ? -1 : 1), status: b.status === 'risk' ? 'risk' : 'wait', by: user.name };
      await dbh.doc('projects/' + p.id).update({ vos: (p.vos || []).concat([v]) }); await logEv((kind === 'plus' ? 'Pekerjaan tambah: ' : 'Pekerjaan kurang: ') + v.desc + ' ' + rp(v.price), p.id); return v;
    },
    async voStatus(id, status, by) {
      const p = D.projects.find((x) => (x.vos || []).some((v) => v.id === id)) || fail('Tidak ada');
      const vos = p.vos.map((v) => v.id === id ? Object.assign({}, v, { status }, status === 'ok' ? { okBy: String(by || ''), okAt: now() } : {}) : v); const v = vos.find((x) => x.id === id);
      await dbh.doc('projects/' + p.id).update({ vos }); await logEv('Tambah-kurang "' + v.desc + '" → ' + ({ ok: 'disetujui klien', wait: 'menunggu klien', risk: 'dikerjakan tanpa persetujuan', void: 'dibatalkan' })[status], p.id);
    },
    async invoice(projectId, t) {
      const p = D.projects.find((x) => x.id === projectId) || fail('Proyek tidak ada');
      if (D.invoices.some((i) => i.projectId === p.id && i.termin === t && i.status !== 'void')) fail('Tagihan termin ini sudah ada');
      const vp = progressOf(p, 'verified');
      if (t > 0) { const tt = p.termins.find((x) => x.n === t) || fail('Termin tidak ada'); if (vp + 1e-9 < tt.atProgress) fail('Progres terverifikasi ' + Math.round(vp * 100) + '% belum mencapai ' + Math.round(tt.atProgress * 100) + '%'); }
      const inv = Object.assign({ id: nid('i'), projectId: p.id, ts: now(), status: 'sent', dueDays: 30 }, invoiceCalc(p, t, Math.round(vp * 100)));
      await put('invoices', inv.id, inv); await logEv('Kirim tagihan ' + inv.label + ' ' + rp(inv.transfer), p.id); return inv;
    },
    async paid(id) { const inv = D.invoices.find((x) => x.id === id) || fail('Tagihan tidak ada'); await dbh.doc('invoices/' + id).update({ status: 'paid', paidAt: now() }); await logEv(inv.label + ' dibayar klien', inv.projectId); },
    async matrix(key, patch) { const m = D.matrix, items = m.items.map((it) => it.key === key ? Object.assign({}, it, patch, { date: now().slice(0, 10) }) : it), version = 'v' + (Number(String(m.version).slice(1)) + 1); await dbh.doc('app/matrix').set({ version, date: now().slice(0, 10), items }); const it = items.find((x) => x.key === key); await logEv('Matriks ' + version + ': ' + it.name + ' = ' + rp(it.typ)); },
    photoUrl: (id) => '/_blob/' + id,
    async exportCsv(p, csv) { const dl = await window.claude.use('downloads'); if (!dl) fail('Unduh tidak tersedia di tampilan ini'); await dl.save({ filename: p.name.replace(/[^\w]+/g, '_') + '.csv', data: csv }); },
    canUpload: () => !!assetsh
  };
})();
