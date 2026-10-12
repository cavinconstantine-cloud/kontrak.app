/* Buku Proyek — aplikasi web ringan (tanpa framework) */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
let S = null;            // state dari server
let view = 'home';       // layar aktif
let sel = {};            // pilihan sementara (proyek aktif, form, dsb)

// ---------- util ----------
const rp = (v) => (v < 0 ? '−' : '') + 'Rp ' + Math.round(Math.abs(v || 0)).toLocaleString('id-ID');
const sh = (v) => { if (Math.abs(v || 0) < 1) return 'Rp 0'; const a = Math.abs(v) / 1e6; return (v < 0 ? '−' : '') + 'Rp ' + (a >= 1000 ? (a / 1000).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + ' M' : (a < 10 ? a.toFixed(1).replace('.', ',').replace(/,0$/, '') : Math.round(a).toLocaleString('id-ID')) + ' Jt'); };
const pct = (x) => (x * 100).toFixed(1).replace('.', ',') + '%';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tgl = (iso) => { const d = new Date(iso); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
const today = () => new Date().toISOString().slice(0, 10);
let toastT; function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500); }
async function api(path, body, method) {
  const r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Gagal');
  return j;
}
async function refresh() { S = await api('/api/state'); if (!sel.pid || !S.projects.find((p) => p.id === sel.pid)) sel.pid = S.projects[0] && S.projects[0].id; render(); }
const P = () => S.projects.find((p) => p.id === sel.pid);
const zoneCls = (z) => z === 'Aman' ? 'ok' : z === 'Tipis' ? 'warn' : z === 'Rugi' ? 'bad' : 'grey';
function fileToDataUrl(file, max = 1024) { return new Promise((res, rej) => { const img = new Image(); const url = URL.createObjectURL(file); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = rej; img.src = url; }); }
function getLoc() { return new Promise((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 8000 }); }); }

// ---------- aksi global (dipanggil dari HTML) ----------
const A = {
  go(v) { view = v; render(); window.scrollTo(0, 0); },
  pick(pid, v) { sel.pid = pid; if (v) view = v; render(); },
  async logout() { await api('/api/logout', {}); S = null; view = 'home'; render(); },
  async login(e) { e.preventDefault(); const role = sel.role || 'owner'; try { await api('/api/login', { role, password: $('#pw').value }); view = 'home'; await refresh(); toast('Selamat datang, ' + S.user.name); } catch (err) { toast(err.message, true); } },
  setRole(r) { sel.role = r; render(); },
  async setPass(e) { e.preventDefault(); try { await api('/api/password', { old: $('#pw0').value, new: $('#pw1').value }); toast('Password diganti'); } catch (err) { toast(err.message, true); } },

  // mandor
  async absen(type) {
    const f = $('#selfie').files[0]; if (!f) return toast('Ambil selfie dulu', true);
    const btn = $('#btnAbsen'); btn.disabled = true; btn.textContent = 'Mengirim…';
    try { const photo = await fileToDataUrl(f, 800); const loc = await getLoc(); const r = await api('/api/absen', Object.assign({ projectId: sel.pid, type, photo, workers: Number($('#workers').value) || 0 }, loc || {})); toast(r.onSite ? 'Absen ' + type + ' tercatat di lokasi' : r.distM == null ? 'Absen tercatat tanpa lokasi (GPS mati)' : 'Absen tercatat, tapi ' + r.distM + ' m dari proyek'); view = 'home'; await refresh(); } catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Kirim absen'; }
  },
  step(i, d) { const p = P(); sel.prog = sel.prog || {}; const cur = sel.prog[i] != null ? sel.prog[i] : p.divisions[i].progress; sel.prog[i] = Math.max(0, Math.min(100, cur + d)); render(); },
  async lapor() {
    const files = Array.from($('#fotos').files); if (!files.length) return toast('Minimal 1 foto pekerjaan', true);
    const p = P(); const items = Object.keys(sel.prog || {}).map((i) => ({ div: Number(i), pct: sel.prog[i] })).filter((it) => it.pct !== p.divisions[it.div].progress);
    if (!items.length) return toast('Belum ada perubahan progres', true);
    const btn = $('#btnLapor'); btn.disabled = true;
    try { const photos = []; for (const f of files.slice(0, 8)) photos.push(await fileToDataUrl(f)); await api('/api/report', { projectId: sel.pid, items, note: $('#catatan').value, photos }); sel.prog = {}; toast('Laporan terkirim'); view = 'home'; await refresh(); } catch (err) { toast(err.message, true); btn.disabled = false; }
  },
  async nota() {
    const f = $('#fnota').files[0]; if (!f) return toast('Foto nota wajib', true);
    const amount = Number(String($('#amount').value).replace(/\D/g, '')); if (!amount) return toast('Isi nominal', true);
    const btn = $('#btnNota'); btn.disabled = true;
    try { const photo = await fileToDataUrl(f); await api('/api/nota', { projectId: sel.pid, type: sel.ntype || 'material', desc: $('#desc').value, shop: $('#shop').value, amount, qty: Number($('#qty').value) || null, unitKey: $('#ukey').value || null, photo }); toast('Nota terkirim, menunggu Admin'); view = 'home'; await refresh(); } catch (err) { toast(err.message, true); btn.disabled = false; }
  },
  setNType(t) { sel.ntype = t; render(); },

  // admin / owner
  async decide(id, decision) { let note = ''; if (decision === 'reject') { note = prompt('Alasan menolak (dikirim ke mandor):') || ''; if (note === '' ) return; } try { const n = await api('/api/nota/decide', { id, decision, note }); toast(n.status === 'owner' ? 'Diteruskan ke Owner' : n.status === 'approved' ? 'Disetujui' : 'Ditolak'); await refresh(); } catch (err) { toast(err.message, true); } },
  async verify(reportId) { try { await api('/api/verify', { projectId: sel.pid, reportId }); toast('Progres diverifikasi'); await refresh(); } catch (err) { toast(err.message, true); } },
  async saveRab() {
    const p = P(); const divisions = p.divisions.map((d, i) => ({ name: $('#dn' + i).value, rap: Number(String($('#dr' + i).value).replace(/\D/g, '')), progress: d.progress, verified: d.verified }));
    if (sel.newDiv) divisions.push({ name: sel.newDiv, rap: 0 });
    try { await api('/api/project/save', { id: p.id, name: $('#pname').value, client: $('#pclient').value, address: $('#paddr').value, lat: $('#plat').value, lng: $('#plng').value, buk: Number($('#buk').value), kasAwal: Number(String($('#kas').value).replace(/\D/g, '')), status: $('#pstatus').value, divisions }); sel.newDiv = null; toast('RAB disimpan'); await refresh(); } catch (err) { toast(err.message, true); }
  },
  addDiv() { sel.newDiv = prompt('Nama pekerjaan baru:'); if (sel.newDiv) A.saveRab(); },
  async newProject() { const name = prompt('Nama proyek baru:'); if (!name) return; try { const p = await api('/api/project/save', { name, client: '', status: 'penawaran', buk: 15, divisions: [{ name: 'Persiapan', rap: 0 }, { name: 'Tanah & pondasi', rap: 0 }, { name: 'Struktur beton', rap: 0 }, { name: 'Dinding', rap: 0 }, { name: 'Atap', rap: 0 }, { name: 'Lantai & finishing', rap: 0 }] }); sel.pid = p.id; view = 'rab'; await refresh(); } catch (err) { toast(err.message, true); } },
  bukPreview() { const p = P(); const rap = p.divisions.reduce((a, d) => a + Number(String($('#dr' + d.id).value).replace(/\D/g, '')), 0); const buk = Number($('#buk').value); const cut = S.config.overhead + S.config.bunga + S.config.pph; const K = rap * (1 + buk / 100); const net = K ? (K - rap - K * cut) / K : 0; const z = buk < p.summary.floorBuk ? 'Rugi' : net < 0.05 ? 'Tipis' : buk > 20 ? 'Di atas wajar' : 'Aman'; $('#bukOut').innerHTML = 'Harga ke klien <b>' + sh(K) + '</b> · laba bersih <b>' + pct(net) + '</b> <span class="pill ' + zoneCls(z) + '">' + z + '</span>'; },
  async saveMx(key) { try { await api('/api/matrix', { key, low: $('#ml-' + key).value, typ: $('#mt-' + key).value, high: $('#mh-' + key).value, src: $('#ms-' + key).value }); toast('Matriks diperbarui'); await refresh(); } catch (err) { toast(err.message, true); } },
  async invoice(termin) { try { const inv = await api('/api/invoice', { projectId: sel.pid, termin }); toast('Tagihan dibuat: ' + rp(inv.transfer)); await refresh(); } catch (err) { toast(err.message, true); } },
  async paid(id) { if (!confirm('Tandai sudah dibayar klien?')) return; try { await api('/api/invoice/paid', { id }); await refresh(); } catch (err) { toast(err.message, true); } }
};
window.A = A;

// ---------- potongan tampilan ----------
const pill = (t, c) => '<span class="pill ' + c + '">' + esc(t) + '</span>';
const kpi = (l, v, extra) => '<div class="kpi"><span class="l">' + esc(l) + '</span><span class="v">' + v + '</span>' + (extra ? '<span class="tiny muted">' + esc(extra) + '</span>' : '') + '</div>';
const bar = (x, cls) => '<div class="bar ' + (cls || '') + '"><span style="width:' + Math.round(x * 100) + '%"></span></div>';
function navBar(items) { return '<nav class="nav">' + items.map((it) => '<button class="' + (view === it[0] ? 'on' : '') + '" onclick="A.go(\'' + it[0] + '\')"><span class="ic">' + it[2] + '</span>' + esc(it[1]) + (it[3] ? '<span class="badge">' + it[3] + '</span>' : '') + '</button>').join('') + '</nav>'; }
function projPicker() { if (S.projects.length < 2) return ''; return '<div class="chips">' + S.projects.map((p) => '<button class="chip ' + (p.id === sel.pid ? 'on' : '') + '" onclick="A.pick(\'' + p.id + '\')">' + esc(p.name) + '</button>').join('') + '</div>'; }
const statusPill = (n) => n.status === 'pending' ? pill('Menunggu Admin', 'warn') : n.status === 'owner' ? pill('Menunggu Owner', 'blue') : n.status === 'approved' ? pill('Disetujui', 'ok') : pill('Ditolak', 'bad');
function notaCard(n, actions) {
  const chk = n.check ? '<div class="small" style="color:' + (n.check.flag === 'tinggi' ? 'var(--bad)' : n.check.flag === 'rendah' ? 'var(--warn)' : 'var(--ok)') + '">' + esc(n.check.item) + ': ' + rp(n.check.unit) + ' vs pasar ' + rp(n.check.market) + ' (' + (n.check.diff > 0 ? '+' : '') + pct(n.check.diff) + ') · ' + n.check.flag + (n.overMarket > 0 ? ' · kelebihan ' + rp(n.overMarket) : '') + '</div>' : (n.qty ? '' : '<div class="tiny muted">tanpa pembanding harga pasar</div>');
  return '<div class="card"><div class="row between"><div class="col grow"><b>' + esc(n.desc || n.type) + '</b><span class="small muted">' + esc(n.name) + ' · ' + esc(n.shop || '—') + ' · ' + tgl(n.ts) + '</span></div><b>' + rp(n.amount) + '</b></div>' + chk + (n.note ? '<div class="small" style="color:var(--bad)">Catatan: ' + esc(n.note) + '</div>' : '') + '<div class="row between wrap"><img class="thumb" src="' + n.photo + '" alt="nota">' + (actions ? '<div class="row">' + actions + '</div>' : statusPill(n)) + '</div></div>';
}
function psak(p) {
  const s = p.summary, K = s.contract; const dpInv = S.invoices.find((i) => i.projectId === p.id && i.termin === 0 && i.status === 'paid'); const potDP = S.invoices.filter((i) => i.projectId === p.id && i.termin > 0 && i.status !== 'void').reduce((a, i) => a + i.potDP, 0);
  const rows = [['Pendapatan diakui', 'progres terverifikasi ' + pct(s.verified) + ' × kontrak', s.revenue, 1], ['Beban kontrak', 'nota yang disetujui', -s.spent, 0], ['Laba kotor sampai sekarang', '', s.revenue - s.spent, 1], ['Kas proyek', 'kas awal + DP + termin − biaya', s.kas, 1], ['Piutang tagihan', 'invoice terkirim belum dibayar', s.receivable, 0], ['Retensi ditahan klien', '', S.invoices.filter((i) => i.projectId === p.id && i.status !== 'void').reduce((a, i) => a + i.retensi, 0), 0], ['Liabilitas kontrak (sisa DP)', 'DP yang belum dipotong', dpInv ? K * p.dp - potDP : 0, 0], ['Proyeksi laba bersih akhir', 'setelah kantor ' + pct(S.config.overhead) + ', bunga ' + pct(S.config.bunga) + ', PPh ' + pct(S.config.pph), s.labaAkhir, 1]];
  return '<div class="card"><h3>Laporan keuangan proyek (PSAK 72)</h3><div class="list">' + rows.map((r) => '<div class="row between"><div class="col"><span class="' + (r[3] ? 'b' : '') + '">' + r[0] + '</span><span class="tiny muted">' + r[1] + '</span></div><span class="' + (r[3] ? 'b' : '') + '">' + sh(r[2]) + '</span></div>').join('') + '</div><a class="btn ghost sm" href="/api/export?projectId=' + p.id + '">Unduh Excel (CSV)</a></div>';
}

// ---------- layar ----------
function loginView() {
  const roles = [['owner', 'Owner', 'semua angka'], ['admin', 'Admin', 'finance'], ['mandor', 'Mandor', 'lapangan']]; sel.role = sel.role || 'owner';
  return '<div class="login"><form class="card" onsubmit="A.login(event)"><div class="row"><span class="top logo" style="width:40px;height:40px;border-radius:12px;background:var(--lime);color:var(--ink);display:flex;align-items:center;justify-content:center;font-weight:800">BP</span><div class="col"><h1>Buku Proyek</h1><span class="small muted">Masuk sebagai</span></div></div><div class="roles">' + roles.map((r) => '<button type="button" class="' + (sel.role === r[0] ? 'on' : '') + '" onclick="A.setRole(\'' + r[0] + '\')">' + r[1] + '<span>' + r[2] + '</span></button>').join('') + '</div><div class="field"><label>Password ' + esc(roles.find((r) => r[0] === sel.role)[1]) + '</label><input id="pw" type="password" autocomplete="current-password" inputmode="text" required></div><button class="btn full">Masuk</button><span class="tiny muted">Aplikasi internal. Lupa password: minta Owner menjalankan <code>node setpass.js</code>.</span></form></div>';
}

function ownerHome() {
  const tot = S.projects.reduce((a, p) => ({ k: a.k + p.summary.contract, kas: a.kas + p.summary.kas, laba: a.laba + p.summary.labaAkhir, pend: a.pend + S.notas.filter((n) => n.projectId === p.id && n.status === 'owner').length }), { k: 0, kas: 0, laba: 0, pend: 0 });
  return '<h1>Pagi, ' + esc(S.user.name) + '</h1><div class="grid">' + kpi('Nilai kontrak berjalan', sh(tot.k), S.projects.length + ' proyek') + kpi('Kas', sh(tot.kas)) + kpi('Proyeksi laba bersih', sh(tot.laba)) + kpi('Menunggu persetujuan Bapak', String(tot.pend), '> ' + sh(S.config.approvalLimit)) + '</div>' +
    (tot.pend ? '<div class="card warn"><b>' + tot.pend + ' nota di atas ' + sh(S.config.approvalLimit) + ' menunggu Bapak</b><button class="btn sm" onclick="A.go(\'approve\')">Lihat &amp; setujui</button></div>' : '') +
    S.projects.map((p) => { const s = p.summary; return '<div class="card" onclick="A.pick(\'' + p.id + '\',\'project\')" style="cursor:pointer"><div class="row between"><div class="col"><b>' + esc(p.name) + '</b><span class="small muted">' + esc(p.client) + ' · ' + esc(p.status) + '</span></div>' + pill(s.zone, zoneCls(s.zone)) + '</div>' + bar(s.verified) + '<div class="row between small"><span>Progres terverifikasi ' + pct(s.verified) + ' (lapor ' + pct(s.progress) + ')</span><span>Laba ' + sh(s.labaAkhir) + '</span></div></div>'; }).join('') +
    '<div class="card"><h3>Kejadian terakhir</h3><div class="list">' + S.log.slice(0, 8).map((l) => '<div class="small"><b>' + esc(l.who) + '</b> ' + esc(l.text) + '<br><span class="tiny muted">' + tgl(l.ts) + '</span></div>').join('') + '</div></div>';
}
function projectView() {
  const p = P(); if (!p) return '<div class="card">Belum ada proyek</div>'; const s = p.summary; const money = !!s;
  return projPicker() + '<h1>' + esc(p.name) + '</h1><span class="small muted">' + esc(p.client) + ' · ' + esc(p.address || '') + '</span>' +
    (money ? '<div class="card dark"><span class="muted small">Nilai kontrak (belum PPN)</span><span class="big">' + sh(s.contract) + '</span><div class="row between small"><span>RAP ' + sh(s.rap) + ' · BUK ' + p.buk + '%</span>' + pill(s.zone + ' · laba ' + pct(s.labaPct), zoneCls(s.zone)) + '</div></div><div class="grid">' + kpi('Biaya disetujui', sh(s.spent), s.overMarket ? 'di atas pasar ' + sh(s.overMarket) : 'sesuai matriks') + kpi('Kas proyek', sh(s.kas)) + kpi('Pendapatan diakui', sh(s.revenue)) + kpi('Piutang', sh(s.receivable)) + '</div>' : '') +
    '<div class="card"><h3>Progres per pekerjaan</h3><div class="list">' + p.divisions.map((d) => '<div class="col"><div class="row between small"><span>' + esc(d.name) + '</span><b>' + d.verified + '% ✓ <span class="muted">/ lapor ' + d.progress + '%</span></b></div>' + bar(d.verified / 100) + '</div>').join('') + '</div></div>' +
    (money ? psak(p) : '') + '<div class="card"><h3>Riwayat</h3><div class="list">' + S.log.filter((l) => l.projectId === p.id).slice(0, 12).map((l) => '<div class="small"><b>' + esc(l.who) + '</b> ' + esc(l.text) + ' <span class="tiny muted">' + tgl(l.ts) + '</span></div>').join('') + '</div></div>';
}
function approveView() {
  const mine = S.user.role === 'owner' ? S.notas.filter((n) => n.status === 'owner') : S.notas.filter((n) => n.status === 'pending');
  const done = S.notas.filter((n) => !mine.includes(n)).slice(-10).reverse();
  return '<h1>Persetujuan biaya</h1><span class="small muted">' + (S.user.role === 'admin' ? 'Admin menyetujui sampai ' + sh(S.config.approvalLimit) + '; lebih dari itu diteruskan ke Owner.' : 'Nota di atas ' + sh(S.config.approvalLimit) + ' yang diteruskan Admin.') + '</span>' +
    (mine.length ? mine.map((n) => notaCard(n, '<button class="btn danger sm" onclick="A.decide(\'' + n.id + '\',\'reject\')">Tolak</button><button class="btn sm" onclick="A.decide(\'' + n.id + '\',\'approve\')">' + (S.user.role === 'admin' && n.amount > S.config.approvalLimit ? 'Teruskan ke Owner' : 'Setujui') + '</button>')).join('') : '<div class="card ok">Tidak ada yang menunggu.</div>') +
    (done.length ? '<h3>Sudah diputuskan</h3>' + done.map((n) => notaCard(n)).join('') : '');
}
function menuView() {
  return '<h1>Menu</h1><div class="card"><b>' + esc(S.user.name) + '</b><span class="small muted">Peran: ' + S.user.role + '</span></div><form class="card" onsubmit="A.setPass(event)"><h3>Ganti password</h3><div class="field"><label>Password lama</label><input id="pw0" type="password" required></div><div class="field"><label>Password baru (min. 6)</label><input id="pw1" type="password" required minlength="6"></div><button class="btn ghost">Simpan</button></form><button class="btn danger full" onclick="A.logout()">Keluar</button>';
}

// --- admin ---
function adminDash() {
  const pend = S.notas.filter((n) => n.status === 'pending').length, unver = S.reports.filter((r) => !r.verified).length;
  return '<h1>Dasbor</h1><div class="grid">' + S.projects.map((p) => kpi(p.name, sh(p.summary.contract), 'laba ' + pct(p.summary.labaPct) + ' · ' + p.summary.zone)).join('') + kpi('Nota menunggu', String(pend)) + kpi('Laporan belum diverifikasi', String(unver)) + kpi('Matriks harga', S.matrix.version, S.matrix.date) + '</div>' +
    '<div class="row wrap"><button class="btn sm" onclick="A.go(\'approve\')">Periksa nota (' + pend + ')</button><button class="btn sm ghost" onclick="A.go(\'lapangan\')">Verifikasi lapangan (' + unver + ')</button><button class="btn sm ghost" onclick="A.newProject()">+ Proyek baru</button></div>' +
    '<div class="card"><h3>Kejadian terakhir</h3><div class="list">' + S.log.slice(0, 12).map((l) => '<div class="small"><b>' + esc(l.who) + '</b> ' + esc(l.text) + ' <span class="tiny muted">' + tgl(l.ts) + '</span></div>').join('') + '</div></div>';
}
function rabView() {
  const p = P(); if (!p) return '<button class="btn" onclick="A.newProject()">+ Proyek baru</button>'; const s = p.summary;
  const rows = p.divisions.map((d, i) => '<tr><td><input class="sm" id="dn' + i + '" value="' + esc(d.name) + '"></td><td><input class="sm num" id="dr' + i + '" inputmode="numeric" value="' + Math.round(d.rap).toLocaleString('id-ID') + '" oninput="A.bukPreview()"></td><td class="num">' + rp(d.rap * (1 + p.buk / 100)) + '</td><td class="num">' + (s.rap ? pct(d.rap / s.rap) : '—') + '</td></tr>').join('');
  return projPicker() + '<div class="row between wrap"><h1>RAB &amp; penawaran</h1><button class="btn sm ghost" onclick="A.newProject()">+ Proyek baru</button></div>' +
    '<div class="card"><div class="grid"><div class="field"><label>Nama proyek</label><input class="sm" id="pname" value="' + esc(p.name) + '"></div><div class="field"><label>Klien</label><input class="sm" id="pclient" value="' + esc(p.client) + '"></div><div class="field"><label>Alamat</label><input class="sm" id="paddr" value="' + esc(p.address || '') + '"></div><div class="field"><label>Status</label><select class="sm" id="pstatus">' + ['penawaran', 'kontrak', 'berjalan', 'selesai'].map((x) => '<option ' + (p.status === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div><div class="field"><label>Titik proyek (lat)</label><input class="sm" id="plat" value="' + (p.lat ?? '') + '"></div><div class="field"><label>Titik proyek (lng)</label><input class="sm" id="plng" value="' + (p.lng ?? '') + '"></div><div class="field"><label>Kas awal proyek</label><input class="sm" id="kas" inputmode="numeric" value="' + Math.round(p.kasAwal).toLocaleString('id-ID') + '"></div></div><span class="tiny muted">Titik proyek dipakai untuk mengecek absen mandor (radius ' + S.config.siteRadiusM + ' m). Ambil dari Google Maps: klik kanan → salin koordinat.</span></div>' +
    '<div class="card"><h3>Biaya modal per pekerjaan (RAP) — tidak pernah dikirim ke klien</h3><div class="scroll"><table><tr><th>Pekerjaan</th><th class="num">RAP (Rp)</th><th class="num">Harga ke klien</th><th class="num">Bobot</th></tr>' + rows + '<tr><td class="b">JUMLAH</td><td class="num b">' + rp(s.rap) + '</td><td class="num b">' + rp(s.contract) + '</td><td class="num">100%</td></tr></table></div><button class="btn sm ghost" onclick="A.addDiv()">+ Tambah pekerjaan</button></div>' +
    '<div class="card"><h3>Pengaman laba</h3><div class="row wrap"><div class="field"><label>Margin di RAB (BUK %) — minimal ' + s.floorBuk + '%</label><input class="sm" id="buk" type="number" min="' + s.floorBuk + '" max="25" value="' + p.buk + '" oninput="A.bukPreview()" style="width:110px"></div><div id="bukOut" class="grow">Harga ke klien <b>' + sh(s.contract) + '</b> · laba bersih <b>' + pct(s.net) + '</b> ' + pill(s.zone, zoneCls(s.zone)) + '</div></div><span class="tiny muted">Dari setiap Rp 100 harga: kantor ' + (S.config.overhead * 100) + ', bunga ' + (S.config.bunga * 100) + ', PPh final ' + (S.config.pph * 100) + ' → di bawah ' + s.floorBuk + '% pasti rugi.</span><button class="btn" onclick="A.saveRab()">Simpan RAB</button></div>' +
    '<div class="card"><h3>Kirim</h3><div class="row wrap"><a class="btn sm ghost" href="/api/export?projectId=' + p.id + '">Unduh ringkasan (CSV)</a></div><span class="tiny muted">Versi klien tanpa RAP dan margin; versi bank dengan struktur biaya. (Dokumen PDF menyusul di tahap berikutnya.)</span></div>';
}
function matrixView() {
  return '<h1>Matriks harga ' + S.matrix.version + '</h1><span class="small muted">Patokan: harga pasar terbaru. Nota mandor dibandingkan dengan kolom "Wajar". Ubah angka lalu tekan Simpan di barisnya.</span><div class="card"><div class="scroll"><table><tr><th>Bahan / upah</th><th>Sat</th><th class="num">Rendah</th><th class="num">Wajar</th><th class="num">Tinggi</th><th>Sumber</th><th></th></tr>' +
    S.matrix.items.map((it) => '<tr><td class="b">' + esc(it.name) + '<br><span class="tiny muted">' + it.date + '</span></td><td>' + esc(it.unit) + '</td><td><input class="sm num" id="ml-' + it.key + '" value="' + it.low + '" style="width:100px"></td><td><input class="sm num b" id="mt-' + it.key + '" value="' + it.typ + '" style="width:110px"></td><td><input class="sm num" id="mh-' + it.key + '" value="' + it.high + '" style="width:100px"></td><td><input class="sm" id="ms-' + it.key + '" value="' + esc(it.src) + '" style="width:160px"></td><td><button class="btn sm ghost" onclick="A.saveMx(\'' + it.key + '\')">Simpan</button></td></tr>').join('') + '</table></div></div>';
}
function lapanganView() {
  const p = P(); if (!p) return ''; const reps = S.reports.filter((r) => r.projectId === p.id).slice().reverse(); const abs = S.attendance.filter((a) => a.projectId === p.id).slice().reverse().slice(0, 14);
  return projPicker() + '<h1>Laporan lapangan</h1>' + (reps.length ? reps.map((r) => '<div class="card"><div class="row between"><div class="col"><b>' + esc(r.name) + ' · ' + tgl(r.ts) + '</b><span class="small">' + r.items.map((it) => esc(p.divisions[it.div].name) + ' → ' + it.pct + '%').join(', ') + '</span>' + (r.note ? '<span class="small muted">' + esc(r.note) + '</span>' : '') + '</div>' + (r.verified ? pill('Diverifikasi', 'ok') : '<button class="btn sm" onclick="A.verify(\'' + r.id + '\')">Verifikasi</button>') + '</div><div class="thumbs">' + r.photos.map((f) => '<a href="' + f + '" target="_blank"><img class="thumb" src="' + f + '" alt=""></a>').join('') + '</div></div>').join('') : '<div class="card muted">Belum ada laporan.</div>') +
    '<div class="card"><h3>Absensi mandor</h3><div class="list">' + (abs.length ? abs.map((a) => '<div class="row between small"><div class="row"><img class="thumb" style="width:40px;height:40px" src="' + a.photo + '" alt=""><div class="col"><b>' + esc(a.name) + ' · ' + a.type + '</b><span class="tiny muted">' + tgl(a.ts) + (a.workers ? ' · ' + a.workers + ' tukang' : '') + '</span></div></div>' + (a.onSite ? pill('Di lokasi', 'ok') : a.distM == null ? pill('Tanpa GPS', 'grey') : pill(a.distM + ' m dari proyek', 'bad')) + '</div>').join('') : '<span class="muted small">Belum ada absen.</span>') + '</div></div>';
}
function tagihanView() {
  const p = P(); if (!p) return ''; const s = p.summary, invs = S.invoices.filter((i) => i.projectId === p.id);
  const row = (t, inv) => { const can = !inv && (t.n === 0 ? p.status !== 'penawaran' : s.verified + 1e-9 >= t.atProgress); return '<div class="row between wrap"><div class="col"><b>' + esc(t.label) + '</b><span class="small muted">' + (t.n === 0 ? 'DP ' + (p.dp * 100) + '% saat tanda tangan' : 'cair saat progres terverifikasi ≥ ' + Math.round(t.atProgress * 100) + '% (sekarang ' + Math.round(s.verified * 100) + '%)') + '</span></div>' + (inv ? '<div class="col right"><b>' + rp(inv.transfer) + '</b>' + (inv.status === 'paid' ? pill('Dibayar ' + tgl(inv.paidAt), 'ok') : '<button class="btn sm ghost" onclick="A.paid(\'' + inv.id + '\')">Tandai dibayar</button>') + '</div>' : '<button class="btn sm" ' + (can ? '' : 'disabled') + ' onclick="A.invoice(' + t.n + ')">Buat tagihan</button>') + '</div>'; };
  const terms = [{ n: 0, label: 'Uang muka (DP)', atProgress: 0 }].concat(p.termins);
  return projPicker() + '<h1>Tagihan &amp; termin</h1><div class="card"><div class="list">' + terms.map((t) => row(t, invs.find((i) => i.termin === t.n && i.status !== 'void'))).join('') + '</div></div>' +
    invs.filter((i) => i.termin > 0).map((i) => '<div class="card"><h3>' + esc(i.label) + ' · progres ' + i.progressPct + '%</h3><div class="list small">' + [['Nilai pekerjaan (bruto)', i.bruto], ['− Potongan uang muka', -i.potDP], ['− Retensi', -i.retensi], ['Tagihan bersih', i.net], ['+ PPN', i.ppn], ['− PPh final (dipotong klien)', -i.pph], ['Ditransfer klien', i.transfer]].map((r) => '<div class="row between"><span>' + r[0] + '</span><b>' + rp(r[1]) + '</b></div>').join('') + '</div></div>').join('') + psak(p);
}

// --- mandor ---
function mandorHome() {
  const p = P(); if (!p) return '<div class="card">Belum ada proyek yang ditugaskan.</div>';
  const ab = S.attendance.filter((a) => a.projectId === p.id && a.ts.slice(0, 10) === today()); const masuk = ab.find((a) => a.type === 'masuk'), pulang = ab.find((a) => a.type === 'pulang');
  const myNotas = S.notas.filter((n) => n.projectId === p.id).slice(-5).reverse();
  return '<h1>Pagi, ' + esc(S.user.name) + '</h1><span class="small muted">' + esc(p.name) + ' · ' + esc(p.address || '') + '</span>' +
    '<div class="card ' + (masuk ? (masuk.onSite ? 'ok' : 'warn') : 'dark') + '"><b style="font-size:18px">' + (masuk ? '✓ Absen masuk ' + tgl(masuk.ts).slice(-5) + (masuk.onSite ? ' di lokasi' : ' — ' + (masuk.distM == null ? 'tanpa GPS' : masuk.distM + ' m dari proyek')) : 'Belum absen hari ini') + '</b><span class="small">' + (masuk ? (masuk.workers ? masuk.workers + ' tukang hadir' : '') : 'Selfie + lokasi. Laporan progres hanya bisa dikirim setelah absen di lokasi.') + '</span>' + (!masuk ? '<button class="btn lime" onclick="A.go(\'absen\')">Absen masuk</button>' : !pulang ? '<button class="btn sm ghost" onclick="A.go(\'absen\')">Absen pulang</button>' : '<span class="small">Absen pulang ' + tgl(pulang.ts).slice(-5) + '</span>') + '</div>' +
    '<div class="grid"><button class="kpi" style="border:none;text-align:left;cursor:pointer" onclick="A.go(\'lapor\')"><span class="v">📷</span><span class="l b">Lapor progres</span></button><button class="kpi" style="border:none;text-align:left;cursor:pointer" onclick="A.go(\'nota\')"><span class="v">🧾</span><span class="l b">Kirim nota</span></button></div>' +
    '<div class="card"><h3>Progres yang dilaporkan</h3><div class="list">' + p.divisions.map((d) => '<div class="col"><div class="row between small"><span>' + esc(d.name) + '</span><b>' + d.progress + '%' + (d.verified >= d.progress && d.progress > 0 ? ' ✓' : '') + '</b></div>' + bar(d.progress / 100) + '</div>').join('') + '</div></div>' +
    (myNotas.length ? '<div class="card"><h3>Nota saya</h3><div class="list">' + myNotas.map((n) => '<div class="row between small"><div class="col"><b>' + esc(n.desc) + '</b><span class="tiny muted">' + tgl(n.ts) + (n.note ? ' · ' + esc(n.note) : '') + '</span></div>' + statusPill(n) + '</div>').join('') + '</div></div>' : '');
}
function absenView() {
  const p = P(); const ab = S.attendance.filter((a) => a.projectId === p.id && a.ts.slice(0, 10) === today()); const type = ab.some((a) => a.type === 'masuk') ? 'pulang' : 'masuk';
  return '<h1>Absen ' + type + '</h1><div class="card"><div class="field"><label>1 · Selfie di lokasi</label><input id="selfie" type="file" accept="image/*" capture="user" onchange="this.nextElementSibling.src=URL.createObjectURL(this.files[0])"><img class="photo" alt="" style="margin-top:8px"></div>' + (type === 'masuk' ? '<div class="field"><label>2 · Jumlah tukang hadir hari ini</label><input id="workers" type="number" inputmode="numeric" min="0" placeholder="mis. 14"></div>' : '<input id="workers" type="hidden" value="0">') + '<span class="small muted">Lokasi GPS diambil otomatis saat tombol ditekan. Izinkan akses lokasi di browser.</span><button id="btnAbsen" class="btn lime full" onclick="A.absen(\'' + type + '\')">Kirim absen</button></div>';
}
function laporView() {
  const p = P(); sel.prog = sel.prog || {};
  return '<h1>Lapor progres</h1><span class="small muted">Geser angka sesuai keadaan di lapangan, lalu foto hasilnya.</span><div class="card"><div class="list">' + p.divisions.map((d, i) => { const v = sel.prog[i] != null ? sel.prog[i] : d.progress; return '<div class="row between"><div class="col grow"><b>' + esc(d.name) + '</b><span class="tiny muted">sebelumnya ' + d.progress + '%</span></div><div class="stepper"><button onclick="A.step(' + i + ',-5)">−</button><b>' + v + '%</b><button onclick="A.step(' + i + ',5)">+</button></div></div>'; }).join('') + '</div></div>' +
    '<div class="card"><div class="field"><label>Foto pekerjaan (wajib, maks. 8)</label><input id="fotos" type="file" accept="image/*" capture="environment" multiple></div><div class="field"><label>Catatan (hujan, kendala, bahan habis)</label><textarea id="catatan"></textarea></div><button id="btnLapor" class="btn full" onclick="A.lapor()">Kirim laporan</button></div>';
}
function notaView() {
  const types = [['material', 'Material'], ['upah', 'Upah tukang'], ['sewa', 'Sewa alat'], ['lain', 'Lain-lain']]; sel.ntype = sel.ntype || 'material';
  return '<h1>Kirim nota</h1><div class="card"><div class="chips">' + types.map((t) => '<button class="chip ' + (sel.ntype === t[0] ? 'on' : '') + '" onclick="A.setNType(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>' +
    '<div class="field"><label>Foto nota (wajib)</label><input id="fnota" type="file" accept="image/*" capture="environment"></div><div class="field"><label>Barang / keterangan</label><input id="desc" placeholder="mis. Semen 50 kg"></div>' +
    (sel.ntype === 'material' ? '<div class="field"><label>Jenis barang (untuk pembanding harga)</label><select id="ukey"><option value="">— pilih —</option>' + S.catalog.map((c) => '<option value="' + c.key + '">' + esc(c.name) + ' (per ' + esc(c.unit) + ')</option>').join('') + '</select></div><div class="field"><label>Jumlah (sesuai satuan)</label><input id="qty" type="number" inputmode="decimal" placeholder="mis. 120"></div>' : '<input id="ukey" type="hidden" value=""><input id="qty" type="hidden" value="">') +
    '<div class="field"><label>Toko / penerima</label><input id="shop"></div><div class="field"><label>Total nominal (Rp)</label><input id="amount" inputmode="numeric" placeholder="mis. 11040000"></div><button id="btnNota" class="btn full" onclick="A.nota()">Kirim ke Admin</button></div>';
}

// ---------- render ----------
function render() {
  if (!S) { app.innerHTML = loginView(); return; }
  const role = S.user.role; let body = '', nav = '';
  const pendOwner = S.notas.filter((n) => n.status === 'owner').length, pendAdmin = S.notas.filter((n) => n.status === 'pending').length;
  if (role === 'owner') { nav = navBar([['home', 'Beranda', '🏠'], ['project', 'Proyek', '🏗️'], ['approve', 'Setujui', '✅', pendOwner], ['menu', 'Menu', '☰']]); body = { home: ownerHome, project: projectView, approve: approveView, menu: menuView }[view] || ownerHome; }
  else if (role === 'admin') { nav = navBar([['home', 'Dasbor', '📊'], ['rab', 'RAB', '📋'], ['matrix', 'Harga', '🏷️'], ['approve', 'Nota', '🧾', pendAdmin], ['lapangan', 'Lapangan', '📷'], ['tagihan', 'Tagihan', '💰'], ['menu', 'Menu', '☰']]); body = { home: adminDash, rab: rabView, matrix: matrixView, approve: approveView, lapangan: lapanganView, tagihan: tagihanView, menu: menuView }[view] || adminDash; }
  else { nav = navBar([['home', 'Beranda', '🏠'], ['absen', 'Absen', '🤳'], ['lapor', 'Lapor', '📷'], ['nota', 'Nota', '🧾'], ['menu', 'Menu', '☰']]); body = { home: mandorHome, absen: absenView, lapor: laporView, nota: notaView, menu: menuView }[view] || mandorHome; }
  const rolePill = { owner: 'lime', admin: 'blue', mandor: 'warn' }[role];
  app.innerHTML = '<div class="shell ' + (role === 'admin' ? 'desk' : '') + '"><header class="top"><div class="brand"><span class="logo">BP</span><div class="col"><b>Buku Proyek</b><span class="tiny" style="color:#A9C7B8">' + esc(S.user.name) + '</span></div></div>' + pill(role === 'admin' ? 'Admin – Finance' : role[0].toUpperCase() + role.slice(1), rolePill) + (role === 'admin' ? nav : '') + '</header><main class="page">' + body() + '</main>' + (role !== 'admin' ? nav : '') + '</div>';
}
(async () => { try { S = await api('/api/state'); if (!sel.pid) sel.pid = S.projects[0] && S.projects[0].id; } catch (e) { S = null; } render(); })();
