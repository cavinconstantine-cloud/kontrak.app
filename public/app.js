/* Buku Proyek — tampilan bersama (versi server & versi web). Data lewat window.API. */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
let S = null, view = 'home', sel = { form: {} }, booting = true, bootError = '', navStack = [], navSkipPop = false, busy = false;
window.addEventListener('popstate', () => { if (navSkipPop) { navSkipPop = false; return; } if (S && S.user && view !== 'home') A.back(true); });

/* ---------- util ---------- */
const rp = (v) => (v < 0 ? '−' : '') + 'Rp ' + Math.round(Math.abs(v || 0)).toLocaleString('id-ID');
const sh = (v) => { if (Math.abs(v || 0) < 1) return 'Rp 0'; const a = Math.abs(v) / 1e6; return (v < 0 ? '−' : '') + 'Rp ' + (a >= 1000 ? (a / 1000).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + ' M' : (a < 10 ? a.toFixed(1).replace('.', ',').replace(/,0$/, '') : Math.round(a).toLocaleString('id-ID')) + ' Jt'); };
const pct = (x) => (x * 100).toFixed(1).replace('.', ',') + '%';
const prog = (x) => { const v = x * 100; return (v > 0 && v < 10 ? v.toFixed(1).replace('.', ',') : String(Math.round(v))) + '%'; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tgl = (iso) => { const d = new Date(iso); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); };
const tglD = (s) => { if (!s) return ''; const d = new Date(String(s).length === 10 ? s + 'T00:00:00' : s); return isNaN(d) ? String(s) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
const jam = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const hariIni = () => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
const salam = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };
const today = () => new Date().toISOString().slice(0, 10);
const initials = (n) => n.split(' ').filter((x) => x && x !== 'Pak' && x !== 'Bu' && x !== 'Ibu').map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'BP';
const T = (plain, official) => esc(plain) + ' <span class="off">' + esc(official) + '</span>';
let toastT;
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 5000 : 3000); }
const hideToast = () => { clearTimeout(toastT); const t = $('#toast'); if (t) t.hidden = true; };
function getLoc() { return new Promise((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 8000 }); }); }
async function refresh() { S = await API.state(); if (!sel.pid || !S.projects.find((p) => p.id === sel.pid)) sel.pid = S.projects[0] && S.projects[0].id; render(); }
window.onDataChange = () => { if (S && !booting && !busy) refresh().catch(() => {}); };
const P = () => S.projects.find((p) => p.id === sel.pid);
const zoneCls = (z) => z === 'Aman' ? 'ok' : z === 'Tipis' ? 'warn' : z === 'Rugi' ? 'bad' : 'grey';
const zoneTxt = (z) => z === 'Di atas wajar' ? 'Margin tinggi' : z;
const money = () => S.user.role !== 'mandor';
function setBusy(on, label) { busy = on; document.body.classList.toggle('busy', on); const b = $('#busy'); if (b) { b.hidden = !on; b.textContent = label || 'Menyimpan…'; } }
async function run(fn, okMsg, label) {
  if (busy) return; setBusy(true, label);
  try { const r = await fn(); await refresh(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); return r; }
  catch (e) { toast(e.message || 'Gagal. Periksa koneksi lalu coba lagi.', true); render(); }
  finally { setBusy(false); }
}
/* kotak konfirmasi sendiri (pengganti confirm/prompt bawaan browser) */
function ask(o) {
  return new Promise((res) => {
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog');
    m.innerHTML = '<div class="sheet"><h2>' + esc(o.title) + '</h2>' + (o.text ? '<span class="small muted">' + esc(o.text) + '</span>' : '') + (o.input != null ? '<input id="askIn" placeholder="' + esc(o.input) + '" value="' + esc(o.value || '') + '">' : '') + '<div class="row" style="gap:8px"><button class="btn ghost grow" data-a="0">Batal</button><button class="btn grow' + (o.danger ? ' red' : '') + '" data-a="1">' + esc(o.ok || 'Ya') + '</button></div></div>';
    document.body.appendChild(m); const inp = m.querySelector('#askIn'); if (inp) setTimeout(() => inp.focus(), 60);
    const done = (v) => { m.remove(); res(v); };
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) { if (e.target === m) done(null); return; } if (b.dataset.a === '0') return done(null); if (inp && o.required && !inp.value.trim()) { inp.classList.add('err'); inp.focus(); return; } done(inp ? inp.value.trim() : true); });
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') m.querySelector('[data-a="1"]').click(); });
  });
}
const I = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  proj: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-3h4v3"/></svg>',
  shield: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  bill: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-3-7z"/></svg>',
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
  cam: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  calc: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h3M13 11h3M8 15h3M13 15h3"/></svg>',
  chart: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg>',
  user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  nota: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  chev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A948E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  bell: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:1px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  tag: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
  dash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  ok: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>'
};
const small = (svg) => svg.replace(/width="26" height="26"/, 'width="22" height="22"');

/* ---------- aksi ---------- */
const A = {
  go(v) { if (v !== view) { navStack.push(view); try { history.pushState({ bp: 1 }, ''); } catch (e) {} } view = v; hideToast(); render(); window.scrollTo(0, 0); },
  tab(v) { navStack = []; view = v; hideToast(); render(); window.scrollTo(0, 0); },
  back(fromPop) {
    hideToast();
    if (view === 'penawaran' && sel.kon && sel.kon.step > 1) { sel.kon = Object.assign({}, sel.kon, { step: sel.kon.step - 1 }); render(); window.scrollTo(0, 0); return; }
    view = navStack.pop() || 'home'; if (!fromPop) { navSkipPop = true; try { history.back(); } catch (e) { navSkipPop = false; } } render(); window.scrollTo(0, 0);
  },
  open(pid, v) { sel.pid = pid; A.go(v || 'detail'); },
  f(el) { sel.form[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; },
  setRole(r) { sel.role = r; render(); },
  login(e) { e.preventDefault(); const role = sel.role || 'owner', pw = $('#pw').value; run(async () => { const u = await API.login(role, pw); view = 'home'; navStack = []; return u; }, (u) => 'Selamat datang, ' + u.name, 'Masuk…'); },
  async logout() { if (!(await ask({ title: 'Keluar dari aplikasi?', ok: 'Keluar', danger: true }))) return; await API.logout(); S = null; view = 'home'; navStack = []; render(); },
  setPass(e) { e.preventDefault(); const o = $('#pw0').value, n = $('#pw1').value; run(() => API.password(o, n), 'Password diganti'); },
  // ---- foto: disimpan di memori supaya tidak hilang saat layar digambar ulang ----
  pickOne(input, key) { const f = input.files[0]; if (!f) return; if (sel[key + 'Url']) window.URL.revokeObjectURL(sel[key + 'Url']); sel[key] = f; sel[key + 'Url'] = window.URL.createObjectURL(f); render(); },
  addPhotos(input) { sel.lfiles = (sel.lfiles || []).concat(Array.from(input.files)).slice(0, 8); render(); },
  delPhoto(i) { sel.lfiles.splice(i, 1); render(); },
  sent(title, sub, kind) { sel.sent = { title, sub, kind: kind || 'ok' }; sel.form = {}; view = 'terkirim'; navStack = []; },
  absen(type) {
    if (!sel.selfie) return toast('Ambil selfie dulu', true);
    const workers = Number(sel.form.workers) || 0;
    run(async () => { const loc = await getLoc(); const r = await API.absen(Object.assign({ projectId: sel.pid, type, file: sel.selfie, workers }, loc || {})); sel.selfie = null; sel.selfieUrl = null;
      A.sent(r.onSite ? 'Absen ' + type + ' tercatat' : 'Absen tercatat, tapi di luar lokasi', r.onSite ? 'Jam ' + jam(r.ts) + ' · di lokasi proyek' + (workers ? ' · ' + workers + ' tukang hadir' : '') : r.distM == null ? 'GPS mati atau tidak diizinkan. Admin akan mengecek foto selfie.' : 'Posisi Bapak ' + r.distM + ' m dari titik proyek. Admin akan mengecek.', r.onSite ? 'ok' : 'warn'); }, null, 'Mengirim absen…');
  },
  step(i, d) { const p = P(); sel.prog = sel.prog || {}; const cur = sel.prog[i] != null ? sel.prog[i] : p.divisions[i].progress; sel.prog[i] = Math.max(0, Math.min(100, cur + d)); render(); },
  toggleAllDiv() { sel.allDiv = !sel.allDiv; render(); },
  lapor() {
    const files = sel.lfiles || []; if (!files.length) return toast('Ambil minimal 1 foto pekerjaan', true);
    const p = P(); const items = Object.keys(sel.prog || {}).map((i) => ({ div: Number(i), pct: sel.prog[i] })).filter((it) => it.pct !== p.divisions[it.div].progress);
    if (!items.length) return toast('Ubah angka progres dulu (tombol + / −)', true);
    run(async () => { await API.report({ projectId: sel.pid, items, note: sel.form.catatan || '', files }); sel.prog = {}; sel.lfiles = []; sel.allDiv = false;
      A.sent('Laporan terkirim', items.map((it) => dname(p.divisions[it.div]) + ' ' + it.pct + '%').join(', ') + ' · ' + files.length + ' foto. Menunggu diperiksa Admin.'); }, null, 'Mengirim laporan…');
  },
  nota() {
    if (!sel.nfile) return toast(sel.ntype === 'readymix' ? 'Foto tiket ready mix wajib' : 'Foto nota wajib', true);
    if (sel.ntype === 'readymix') { const F = sel.form, rm = { mutu: F.rmMutu || (P().mutus || [])[0] || 'K-250', vol: Number(String(F.rmVol || '').replace(',', '.')) || 0, out: F.rmOut || '', arrive: F.rmArrive || new Date().toTimeString().slice(0, 5), slump: F.rmSlump || '' }; if (!rm.vol) return toast('Isi volume (m³) dari tiket', true); if (!rm.out) return toast('Isi jam keluar dari batching plant (ada di tiket)', true); const b = { projectId: sel.pid, type: 'readymix', desc: 'Tiket ready mix ' + rm.mutu + ' · ' + rm.vol + ' m³', shop: F.shop || '', amount: Number(String(F.amount || '').replace(/\D/g, '')) || 0, rm, file: sel.nfile }; run(async () => { const n = await API.nota(b); sel.nfile = null; sel.nfileUrl = null; const c = n.rmCheck || {}; A.sent(c.late || c.mutuOk === false ? 'Tiket terkirim — ada yang perlu dicek' : 'Tiket ready mix terkirim', (c.mutuOk === false ? 'Mutu ' + rm.mutu + ' berbeda dari rencana (' + c.planned.join(', ') + '). ' : '') + (c.late ? 'Truk ' + c.minutes + ' menit di jalan (batas 90). Jangan dicor sebelum Admin/pengawas setuju. ' : '') + (c.late || c.mutuOk === false ? '' : (c.planned && c.planned.length ? 'Mutu sesuai rencana' : 'Rencana mutu belum diisi di RAB') + (c.minutes != null ? ', ' + c.minutes + ' menit di jalan.' : '.')), c.late || c.mutuOk === false ? 'warn' : 'ok'); }, null, 'Mengirim tiket…'); return; }
    const F = sel.form, b = { projectId: sel.pid, type: sel.ntype || 'material', desc: F.desc || '', shop: F.shop || '', amount: Number(String(F.amount || '').replace(/\D/g, '')), qty: Number(F.qty) || null, unitKey: F.ukey || null, file: sel.nfile };
    if (!b.amount) return toast('Isi total nominal', true);
    run(async () => { await API.nota(b); sel.nfile = null; sel.nfileUrl = null; A.sent('Nota terkirim', (b.desc || 'Nota') + ' ' + rp(b.amount) + '. Menunggu diperiksa Admin.'); }, null, 'Mengirim nota…');
  },
  setNType(t) { sel.ntype = t; render(); },
  async decide(id, decision) {
    let note = '';
    if (decision === 'reject') { note = await ask({ title: 'Tolak nota ini?', text: 'Alasan akan dikirim ke mandor.', input: 'mis. harga di atas pasar, minta nota ulang', required: true, ok: 'Tolak', danger: true }); if (note == null) return; }
    run(() => API.decide(id, decision, note), (s) => s === 'owner' ? 'Diteruskan ke Owner' : s === 'approved' ? 'Disetujui' : 'Ditolak, mandor diberi tahu');
  },
  verify(pid, reportId) { sel.pid = pid; run(() => API.verify(pid, reportId), 'Progres diverifikasi'); },
  saveRab() {
    const p = P(), F = sel.form;
    const divisions = p.divisions.map((d, i) => ({ src: d.src || null, grp: d.grp || null, name: F['dn' + i] != null ? F['dn' + i] : d.name, rap: F['dr' + i] != null ? Number(String(F['dr' + i]).replace(/\D/g, '')) : d.rap, progress: d.progress, verified: d.verified }));
    if (sel.newDiv) { const nd = typeof sel.newDiv === 'string' ? { name: sel.newDiv } : sel.newDiv, at = nd.grp ? divisions.reduce((a, d, i) => (d.grp === nd.grp ? i : a), -1) : -1; const row = { grp: nd.grp || null, name: nd.name, rap: 0, progress: 0, verified: 0 }; if (at >= 0) divisions.splice(at + 1, 0, row); else divisions.push(row); }
    const g = (k, d) => F[k] != null ? F[k] : d;
    const b = { id: p.id, name: g('pname', p.name), client: g('pclient', p.client), address: g('paddr', p.address || ''), lat: g('plat', p.lat ?? ''), lng: g('plng', p.lng ?? ''), buk: Number(g('buk', p.buk)), kasAwal: Number(String(g('kas', p.kasAwal || 0)).replace(/\D/g, '')), status: g('pstatus', p.status), area: g('parea', p.area || ''), lantai: g('plantai', p.lantai || ''), divisions };
    run(async () => { await API.saveProject(b); sel.newDiv = null; sel.form = {}; }, 'RAB disimpan');
  },
  async addDiv(grp) { const n = await ask({ title: 'Tambah pekerjaan' + (grp ? ' · ' + grp : ''), input: 'mis. Pagar & carport', required: true, ok: 'Tambah' }); if (!n) return; sel.newDiv = { name: n, grp: grp || null }; A.saveRab(); },
  async addGrp() { const g = await ask({ title: 'Tambah lantai / area', text: 'Contoh: Lantai 3 · Dak, atau Lantai 1 · Teras.', input: 'Nama lantai / area', required: true, ok: 'Lanjut' }); if (g) A.addDiv(g); },
  async newProject() { const name = await ask({ title: 'Proyek baru (kosong)', text: 'Untuk menghitung harga dulu, pakai Konsultan Penawaran.', input: 'Nama proyek', required: true, ok: 'Buat' }); if (!name) return; run(async () => { const p = await API.saveProject({ name, client: '', status: 'penawaran', buk: 15, divisions: ['Persiapan', 'Tanah & pondasi', 'Struktur beton', 'Dinding', 'Atap', 'Lantai & finishing'].map((n) => ({ name: n, rap: 0 })) }); sel.pid = p.id; sel.form = {}; navStack.push('home'); view = 'rab'; }, 'Proyek dibuat. Isi biaya modal per pekerjaan.'); },
  bukPreview() { const p = P(), C = S.config, F = sel.form; const rap = p.divisions.reduce((a, d, i) => a + (F['dr' + i] != null ? Number(String(F['dr' + i]).replace(/\D/g, '')) : d.rap), 0); const buk = Number(F.buk != null ? F.buk : p.buk); const cut = C.overhead + C.bunga + C.pph; const K = rap * (1 + buk / 100); const net = K ? (K - rap - K * cut) / K : 0; const z = buk < p.summary.floorBuk ? 'Rugi' : net < 0.05 ? 'Tipis' : buk > 20 ? 'Di atas wajar' : 'Aman'; const o = $('#bukOut'); if (o) o.innerHTML = 'Harga ke klien <b>' + sh(K) + '</b> · untung bersih <b>' + pct(net) + '</b> ' + pill(zoneTxt(z), zoneCls(z)); const t = $('#rapTot'); if (t) t.textContent = rp(rap); },
  saveMx(key) { const patch = { low: Number($('#ml-' + key).value), typ: Number($('#mt-' + key).value), high: Number($('#mh-' + key).value), src: $('#ms-' + key).value }; run(() => API.matrix(key, patch), 'Harga diperbarui'); },
  invoice(pid, t) { run(() => API.invoice(pid, t), (inv) => 'Tagihan dibuat: ' + rp(inv.transfer)); },
  async paid(id, label, amt) { if (!(await ask({ title: 'Tandai sudah dibayar?', text: label + ' · ' + rp(amt) + '. Pastikan uang sudah masuk rekening.', ok: 'Sudah dibayar' }))) return; run(() => API.paid(id), 'Dicatat sebagai lunas'); },
  toggle(k) { sel[k] = !sel[k]; render(); },
  vo() { const F = sel.form; const b = { projectId: sel.pid, kind: sel.voKind || 'plus', desc: F.voDesc || '', cost: Number(String(F.voCost || '').replace(/\D/g, '')), margin: Number(F.voMargin != null ? F.voMargin : (P().buk || 15)), status: F.voRisk ? 'risk' : 'wait' }; if (!b.desc) return toast('Isi uraian pekerjaan', true); if (!b.cost) return toast('Isi biaya modal', true); run(async () => { await API.vo(b); sel.form = {}; }, 'Dicatat. Mintakan persetujuan klien.'); },
  setVoKind(k) { sel.voKind = k; render(); },
  async voStatus(id, status) {
    let by = '';
    if (status === 'ok') { by = await ask({ title: 'Disetujui klien', text: 'Siapa yang menyetujui di pihak klien?', input: 'mis. Pak Andi, PT Sinar Abadi', required: true, ok: 'Simpan' }); if (by == null) return; }
    if (status === 'void' && !(await ask({ title: 'Batalkan pekerjaan ini?', ok: 'Batalkan', danger: true }))) return;
    run(() => API.voStatus(id, status, by), status === 'ok' ? 'Disetujui — nilai kontrak bertambah' : 'Dibatalkan');
  },
  // ---- struktur per elemen ----
  st(i, k, v) { const e = sel.struct[i]; e[k] = (k === 'vol' || k === 'ratio') ? (v === '' ? (k === 'ratio' ? null : 0) : Number(String(v).replace(',', '.'))) : v; if (k === 'el') { e.ratio = null; if (v === 'praktis') { e.mutu = 'K-175'; e.baja = 'bjtp'; } if (v === 'kerja') { e.mutu = 'K-100'; e.met = 'manual'; } } render(); },
  stAdd() { sel.struct.push({ el: 'kolom', mutu: (P().lantai || 1) >= 3 ? 'K-300' : 'K-250', met: 'pump', baja: 'bjts', vol: 1, ratio: null, slab: 'konv' }); render(); },
  async stDel(i) { if (!(await ask({ title: 'Hapus elemen ini?', ok: 'Hapus', danger: true }))) return; sel.struct.splice(i, 1); render(); },
  async stReset() { if (!(await ask({ title: 'Isi ulang dari luas bangunan?', text: 'Volume dihitung kasar dari luas & jumlah lantai. Isian sekarang akan diganti.', ok: 'Isi ulang' }))) return; const p = P(); sel.struct = BETON.defaults(p.area, p.lantai || 1, 'pump'); render(); },
  setPerCor(v) { sel.perCor = Math.max(1, Number(v) || 20); render(); },
  saveStruct() {
    const p = P(), P2 = BETON.prices(S.matrix), ctx = { volPerCor: sel.perCor, lantai: p.lantai || 1 };
    const res = sel.struct.map((e) => BETON.element(e, P2, ctx)); if (res.some((r) => !r.ok)) return toast('Ada elemen dengan cara cor yang tidak cocok untuk mutunya. Perbaiki dulu.', true);
    const total = Math.round(res.reduce((a, r) => a + r.total, 0)), divisions = p.divisions.map((d) => Object.assign({}, d));
    const many = divisions.filter((x) => x.src === 'struct');
    if (many.length > 1) { const cur = many.reduce((a, x) => a + x.rap, 0); many.forEach((x) => { x.rap = cur ? Math.round(total * x.rap / cur) : Math.round(total / many.length); }); }  // RAB per lantai: total dibagi ke tiap lantai sebanding porsinya
    else { let d = many[0] || divisions.find((x) => /struktur/i.test(x.name)); if (!d) { d = { name: '', rap: 0, progress: 0, verified: 0 }; divisions.push(d); } Object.assign(d, { src: 'struct', name: d.grp ? d.name : 'Struktur beton (rincian per elemen)', rap: total }); }
    run(async () => { await API.saveProject({ id: p.id, struct: sel.struct, structPerCor: sel.perCor, divisions }); sel.structPid = null; }, 'Struktur disimpan ke RAB: ' + rp(total));
  },
  // ---- interior ----
  it(i, k, v) { sel.inter[i][k] = k === 'qty' ? (Number(String(v).replace(',', '.')) || 0) : v; render(); },
  saveInterior() {
    const p = P(), r = INTERIOR.calc(sel.inter), total = Math.round(r.total), divisions = p.divisions.map((d) => Object.assign({}, d));
    const many = divisions.filter((x) => x.src === 'interior');
    if (many.length > 1) { const cur = many.reduce((a, x) => a + x.rap, 0); many.forEach((x) => { x.rap = cur ? Math.round(total * x.rap / cur) : Math.round(total / many.length); }); }
    else { let d = many[0] || divisions.find((x) => /interior|kitchen/i.test(x.name)); if (!d && total > 0) { d = { name: '', rap: 0, progress: 0, verified: 0 }; divisions.push(d); } if (d) Object.assign(d, { src: 'interior', name: d.grp ? d.name : 'Interior (lihat pembagian pekerjaan)', rap: total }); }
    run(async () => { await API.saveProject({ id: p.id, interior: sel.inter, divisions }); sel.interPid = null; }, 'Pembagian interior disimpan: ' + rp(total));
  },
  exportCsv(pid) { const p = S.projects.find((x) => x.id === (pid || sel.pid)), s = p.summary; const lines = [['Buku Proyek — ' + p.name], ['Klien', p.client], [], ['Lantai / area', 'Pekerjaan', 'Biaya modal (RAP)', 'Harga ke klien', 'Progres dilapor', 'Progres diperiksa']]; p.divisions.forEach((d) => lines.push([d.grp || '', d.name, d.rap, d.rap * (1 + p.buk / 100), d.progress + '%', d.verified + '%'])); if (p.struct && p.struct.length) { const P2 = BETON.prices(S.matrix); lines.push([], ['Struktur beton per elemen'], ['Elemen', 'Mutu', 'Cara cor', 'Besi', 'Volume m³', 'Biaya per m³', 'Jumlah']); p.struct.forEach((e) => { const r = BETON.element(e, P2, { volPerCor: p.structPerCor, lantai: p.lantai }); lines.push([BETON.EL[e.el][0], e.mutu, BETON.MET[e.met][0], e.el === 'kerja' ? '-' : BETON.BAJA[e.baja], e.vol, r.perM3, r.total]); }); }
    if (p.interior && p.interior.length) { const ir = INTERIOR.calc(p.interior); lines.push([], ['Interior — termasuk'], ['Pekerjaan', 'Oleh', 'Jumlah', 'Satuan']); ir.termasuk.forEach((r) => lines.push([r.name, INTERIOR.BY[r.by][0] + ' (' + INTERIOR.BY[r.by][1] + ')', r.qty, r.unit])); lines.push([], ['Interior — TIDAK termasuk (oleh pemilik / vendor lain)']); ir.tidak.forEach((r) => lines.push([r.name, '', r.qty, r.unit])); }
    lines.push([], ['Nilai kontrak', s.contract], ['Biaya modal (RAP)', s.rap], ['Uang keluar (nota disetujui)', s.spent], ['Kas proyek', s.kas], ['Nilai pekerjaan selesai (pendapatan diakui PSAK 72)', s.revenue], ['Perkiraan untung bersih akhir', s.labaAkhir]); const csv = '﻿' + lines.map((l) => l.map((c) => typeof c === 'number' ? Math.round(c) : '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n'); const r = API.exportCsv(p, csv); if (r && r.then) r.then(() => toast('File Excel (CSV) disimpan')).catch((e) => toast(e.message || 'Unduh dibatalkan', true)); }
};
window.A = A;
KONSULTAN.set = (p) => { sel.kon = Object.assign({}, sel.kon || KONSULTAN.defaults(), p); render(); if (p.step) window.scrollTo(0, 0); };
KONSULTAN.save = () => { const nama = (sel.kon.nama || '').trim(), klien = (sel.kon.klienNama || '').trim(); if (!nama) return toast('Isi nama proyek', true); const b = KONSULTAN.toProject(sel.kon, nama, klien); run(async () => { const p = await API.saveProject(b); sel.pid = p.id; sel.kon = null; navStack = ['home']; view = 'detail'; }, 'Proyek dibuat dengan RAB awal. Rapikan angkanya di RAB bila perlu.'); };

/* ---------- potongan tampilan ---------- */
const pill = (t, c) => '<span class="pill ' + c + '">' + esc(t) + '</span>';
const kpi = (l, v, extra, cls, go) => '<' + (go ? 'button onclick="' + go + '"' : 'div') + ' class="kpi ' + (cls || '') + '"><span class="l">' + esc(l) + '</span><span class="v">' + v + '</span>' + (extra ? '<span class="tiny muted">' + esc(extra) + '</span>' : '') + '</' + (go ? 'button' : 'div') + '>';
const bar = (x) => '<div class="bar"><span style="width:' + Math.round(Math.max(0, Math.min(1, x)) * 100) + '%"></span></div>';
const card = (inner, cls) => '<div class="card ' + (cls || '') + '">' + inner + '</div>';
const todo = (t, s, go, bg, ink) => '<button class="todo" onclick="' + go + '"><span class="ico" style="background:' + bg + ';color:' + ink + '"><i style="background:' + ink + '"></i></span><span class="col grow"><span class="t">' + esc(t) + '</span><span class="s">' + esc(s) + '</span></span>' + I.chev + '</button>';
const field = (label, k, val, extra) => '<div class="field"><label>' + label + '</label><input data-k="' + k + '" oninput="A.f(this)' + (extra && extra.live ? ';A.bukPreview()' : '') + '" value="' + esc(sel.form[k] != null ? sel.form[k] : val) + '"' + (extra && extra.attrs ? ' ' + extra.attrs : '') + '></div>';
const hdrWho = (right) => '<div class="hdr"><div class="who"><span class="avatar">' + initials(S.user.name) + '</span><span class="col" style="gap:0"><span class="greet">' + salam() + '</span><span class="name">' + esc(S.user.name) + '</span></span></div>' + (right || '') + '</div>';
const backBtn = () => !navStack.length ? '' : '<button class="iconbtn back" aria-label="Kembali" onclick="A.back()">' + I.back + '</button>';
const hdrTitle = (title, sub, right) => '<div class="hdr"><span class="row" style="gap:12px;min-width:0">' + backBtn() + '<span class="col" style="gap:0;min-width:0"><span class="date">' + (sub || esc(hariIni())) + '</span><span class="title">' + esc(title) + '</span></span></span>' + (right || '') + '</div>';
function navBar(items, fab) {
  const b = (it) => '<button class="' + (view === it[0] || (it[2] && it[2].includes(view)) ? 'on' : '') + '" onclick="A.tab(\'' + it[0] + '\')">' + it[1] + esc(it[3] || '') + '</button>';
  const f = '<button class="fab" aria-label="' + esc(fab[2]) + '" onclick="A.tab(\'' + fab[0] + '\')">' + fab[1] + (fab[3] ? '<span class="badge">' + fab[3] + '</span>' : '') + '</button>';
  return '<nav class="nav">' + b(items[0]) + b(items[1]) + f + b(items[2]) + b(items[3]) + '</nav>';
}
const statusPill = (n) => n.status === 'pending' ? pill('Menunggu Admin', 'warn') : n.status === 'owner' ? pill('Menunggu Owner', 'blue') : n.status === 'approved' ? pill('Disetujui', 'ok') : pill('Ditolak', 'bad');
const photo = (ref, sm) => '<a class="ph' + (sm ? ' sm' : '') + '" href="' + API.photoUrl(ref) + '" target="_blank" aria-label="Lihat foto"><img src="' + API.photoUrl(ref) + '" alt="Foto" onerror="this.parentNode.classList.add(\'broken\')"></a>';
const dname = (d) => (d && d.grp ? d.grp + ' · ' : '') + ((d && d.name) || '');  // nama pekerjaan + lantai/area
const projOf = (id) => S.projects.find((p) => p.id === id) || { name: '', divisions: [] };
const weightOf = (p, d) => { const r = p.summary ? p.summary.rap : 0; return r ? d.rap / r : 0; };
function progressExplain(p) {
  const d = p.divisions.filter((x) => (x.verified || 0) > 0).sort((a, b) => b.verified - a.verified)[0];
  if (!d || !p.summary) return 'Progres proyek dihitung menurut nilai biaya tiap pekerjaan.';
  return 'Dihitung menurut nilai biaya tiap pekerjaan. ' + dname(d) + ' ' + d.verified + '% hanya menambah ' + prog(weightOf(p, d) * d.verified / 100) + ' karena bobotnya ' + prog(weightOf(p, d)) + ' dari seluruh biaya.';
}
function notaCard(n, actions) {
  const chk = money() && n.check ? '<div class="small" style="color:' + (n.check.flag === 'tinggi' ? 'var(--bad)' : n.check.flag === 'rendah' ? 'var(--warnink)' : 'var(--ok)') + '">' + esc(n.check.item) + ': ' + rp(n.check.unit) + ' vs harga pasar ' + rp(n.check.market) + ' (' + (n.check.diff > 0 ? '+' : '') + pct(n.check.diff) + ') · <b>' + ({ tinggi: 'kemahalan', rendah: 'di bawah pasar — cek kualitas', wajar: 'wajar' })[n.check.flag] + '</b>' + (n.overMarket > 0 ? ' · kelebihan ' + rp(n.overMarket) : '') + '</div>' : (money() && !n.qty ? '<div class="tiny muted">Tanpa pembanding harga pasar (jumlah barang tidak diisi)</div>' : '');
  const rmc = n.rm && n.rmCheck ? '<div class="small" style="color:' + (n.rmCheck.late || !n.rmCheck.mutuOk ? 'var(--bad)' : 'var(--ok)') + '">' + esc(n.rm.mutu) + ' · ' + n.rm.vol + ' m³ · keluar ' + esc(n.rm.out) + ', tiba ' + esc(n.rm.arrive) + (n.rmCheck.minutes != null ? ' (' + n.rmCheck.minutes + ' menit)' : '') + (n.rm.slump ? ' · slump ' + esc(n.rm.slump) + ' cm' : '') + ' · <b>' + [!n.rmCheck.mutuOk ? 'mutu beda dari rencana ' + n.rmCheck.planned.join('/') : '', n.rmCheck.late ? 'lewat 90 menit' : ''].filter(Boolean).concat(n.rmCheck.late || !n.rmCheck.mutuOk ? [] : [n.rmCheck.planned && n.rmCheck.planned.length ? 'sesuai' : 'rencana mutu belum ada di RAB']).join(' · ') + '</b></div>' : '';
  return card('<div class="row between" style="align-items:flex-start"><div class="col grow" style="gap:0"><b>' + esc(n.desc || n.type) + '</b><span class="small muted">' + esc(projOf(n.projectId).name) + ' · ' + esc(n.name) + ' · ' + esc(n.shop || '—') + ' · ' + tgl(n.ts) + '</span></div><b>' + (n.amount ? rp(n.amount) : '—') + '</b></div>' + rmc + chk + (n.note ? '<div class="small" style="color:var(--bad)">Alasan: ' + esc(n.note) + '</div>' : '') + '<div class="row between wrap">' + photo(n.photo) + (actions ? '<div class="row">' + actions + '</div>' : statusPill(n)) + '</div>');
}
function psak(p) {
  const C = S.config, s = p.summary, K = s.contract; const dpInv = S.invoices.find((i) => i.projectId === p.id && i.termin === 0 && i.status === 'paid'); const potDP = S.invoices.filter((i) => i.projectId === p.id && i.termin > 0 && i.status !== 'void').reduce((a, i) => a + i.potDP, 0);
  const rows = [['Nilai pekerjaan selesai', 'pendapatan diakui (PSAK 72) = progres diperiksa ' + prog(s.verified) + ' × kontrak', s.revenue, 1], ['Uang keluar', 'beban kontrak · nota yang disetujui', -s.spent, 0], ['Untung kotor sampai sekarang', '', s.revenue - s.spent, 1], ['Kas proyek', 'kas awal + uang muka + termin − uang keluar', s.kas, 1], ['Tagihan belum dibayar', 'piutang', s.receivable, 0], ['Uang ditahan klien', 'retensi, cair setelah masa pemeliharaan', S.invoices.filter((i) => i.projectId === p.id && i.status !== 'void').reduce((a, i) => a + i.retensi, 0), 0], ['Uang muka belum dipotong', 'liabilitas kontrak', dpInv ? K * p.dp - potDP : 0, 0], ['Perkiraan untung bersih akhir', 'setelah biaya kantor ' + pct(C.overhead) + ', bunga ' + pct(C.bunga) + ', PPh ' + pct(C.pph), s.labaAkhir, 1]];
  return card('<div class="row between"><h3>' + esc(p.name) + '</h3><button class="link" onclick="A.open(\'' + p.id + '\')">Buka proyek</button></div><div class="list">' + rows.map((r) => '<div class="row between"><div class="col" style="gap:0"><span class="' + (r[3] ? 'b' : '') + '">' + r[0] + '</span><span class="tiny muted">' + esc(r[1]) + '</span></div><span class="' + (r[3] ? 'b' : '') + '">' + sh(r[2]) + '</span></div>').join('') + '</div><button class="btn ghost sm" onclick="A.exportCsv(\'' + p.id + '\')">Unduh Excel (CSV)</button>');
}
function pcard(p, wide) {
  const s = p.summary; const costPct = s.contract ? s.spent / s.contract : 0; const ok = s.labaAkhir >= 0;
  return '<button class="pcard' + (wide ? ' wide' : '') + '" onclick="A.open(\'' + p.id + '\')"><span class="row between"><span class="pill ' + zoneCls(s.zone) + '"><i></i>' + esc(zoneTxt(s.zone)) + '</span><span class="tiny muted">' + esc(p.status) + '</span></span><span class="col" style="gap:0"><b style="font-size:16px">' + esc(p.name) + '</b><span class="tiny muted">' + esc(p.client || '—') + ' · kontrak ' + sh(s.contract) + '</span></span><span class="col" style="gap:4px"><span class="pbar"><span style="width:' + Math.round(s.verified * 100) + '%"></span><i style="left:' + Math.min(100, Math.round(costPct * 100)) + '%"></i></span><span class="row between tiny"><span class="leg"><i class="g"></i>Pekerjaan selesai ' + prog(s.verified) + '</span><span class="leg"><i class="o"></i>Uang keluar ' + prog(costPct) + '</span></span></span><span class="foot"><span class="tiny muted">' + (ok ? 'Perkiraan untung' : 'Perkiraan rugi') + '</span><b style="font-size:16px;color:' + (ok ? 'var(--ok)' : 'var(--bad)') + '">' + sh(s.labaAkhir) + '</b></span></button>';
}
const photoBtn = (label, onchange, opts) => '<label class="photoBtn">' + I.cam + '<span>' + esc(label) + '</span><input type="file" accept="image/*"' + (opts && opts.capture ? ' capture="' + opts.capture + '"' : '') + (opts && opts.multiple ? ' multiple' : '') + ' onchange="' + onchange + '"></label>';

/* ---------- layar masuk ---------- */
function loginView() {
  const roles = [['owner', 'Owner', 'pemilik'], ['admin', 'Admin', 'keuangan'], ['mandor', 'Mandor', 'lapangan']]; sel.role = sel.role || 'owner';
  const warn = S && S.setupMissing ? '<div class="card warn" style="padding:10px 12px"><span class="small">Data awal belum ada. Hubungi pengelola aplikasi.</span></div>' : '';
  return '<div class="login"><form class="card" onsubmit="A.login(event)"><div class="row"><span class="avatar" style="border-radius:14px">BP</span><div class="col" style="gap:0"><h1>Buku Proyek</h1><span class="small muted">Pilih peran Bapak/Ibu</span></div></div>' + warn + '<div class="roles">' + roles.map((r) => '<button type="button" class="' + (sel.role === r[0] ? 'on' : '') + '" onclick="A.setRole(\'' + r[0] + '\')">' + r[1] + '<span>' + r[2] + '</span></button>').join('') + '</div><div class="field"><label>Password ' + esc(roles.find((r) => r[0] === sel.role)[1]) + '</label><input id="pw" type="password" autocomplete="current-password" required></div><button class="btn full">Masuk</button><span class="tiny muted">Aplikasi internal. Lupa password: hubungi Owner.</span></form></div>';
}

/* ---------- bersama Owner & Admin ---------- */
function counts() { return { notaOwner: S.notas.filter((n) => n.status === 'owner').length, notaAdmin: S.notas.filter((n) => n.status === 'pending').length, unver: S.reports.filter((r) => !r.verified).length, risk: S.projects.reduce((a, p) => a + (p.vos || []).filter((v) => v.status === 'risk').length, 0) }; }
function buktiCount() { const c = counts(); return (S.user.role === 'owner' ? c.notaOwner : c.notaAdmin) + c.unver; }
function readyAmount() { return S.projects.reduce((a, p) => { const s = p.summary; return a + (p.termins || []).filter((t) => !S.invoices.some((i) => i.projectId === p.id && i.termin === t.n && i.status !== 'void') && s.verified + 1e-9 >= t.atProgress).reduce((x, t) => x + t.pct * s.contract, 0); }, 0); }

function ownerHome() {
  const ps = S.projects, C = S.config, c = counts();
  const tot = ps.reduce((a, p) => { const s = p.summary; return { kas: a.kas + s.kas, laba: a.laba + s.labaAkhir, rec: a.rec + s.receivable }; }, { kas: 0, laba: 0, rec: 0 }), ready = readyAmount();
  const hadir = S.attendance.filter((a) => a.ts.slice(0, 10) === today() && a.type === 'masuk').reduce((a, x) => a + (x.workers || 0), 0);
  const pend = S.notas.filter((n) => n.status === 'owner'), todos = [];
  if (pend.length) todos.push(todo(pend.length + ' nota di atas ' + sh(C.approvalLimit) + ' menunggu Bapak', pend.map((n) => n.desc + ' ' + sh(n.amount)).join(', '), "A.go('bukti')", 'var(--badbg)', 'var(--bad)'));
  if (c.risk) todos.push(todo(c.risk + ' pekerjaan tambah belum disetujui klien', 'sudah dikerjakan tapi belum ada persetujuan tertulis', "A.go('tambahkurang')", 'var(--badbg)', 'var(--bad)'));
  if (ready > 0) todos.push(todo('Siap ditagih ' + sh(ready), 'progres sudah mencapai syarat termin', "A.go('tagihan')", 'var(--okbg)', 'var(--ok)'));
  if (c.unver) todos.push(todo(c.unver + ' laporan mandor belum diperiksa', 'cek foto & progres, lalu verifikasi', "A.go('bukti')", 'var(--warnbg)', 'var(--warn)'));
  return hdrWho('<button class="iconbtn" aria-label="Cek bukti" onclick="A.go(\'bukti\')">' + I.bell + (buktiCount() ? '<span class="dot"></span>' : '') + '</button>') +
    '<div class="hero"><div class="col" style="gap:4px"><span class="lbl">Kas perusahaan · semua proyek</span><span class="big">' + sh(tot.kas) + '</span><span class="sub">Perkiraan untung semua proyek <b style="color:' + (tot.laba >= 0 ? 'var(--lime)' : '#FFB4AE') + '">' + sh(tot.laba) + '</b></span></div><div class="minis"><button class="mini" onclick="A.go(\'tagihan\')"><span>Siap ditagih</span><b class="lime">' + sh(ready) + '</b></button><button class="mini" onclick="A.go(\'tagihan\')"><span>Belum dibayar klien</span><b>' + sh(tot.rec) + '</b></button><button class="mini" onclick="A.go(\'bukti\')"><span>Tukang hadir hari ini</span><b>' + hadir + ' org</b></button></div></div>' +
    '<div class="quick"><button onclick="A.go(\'tagihan\')"><span class="circ lime">' + I.bill.replace('width="22" height="22"', 'width="26" height="26"') + '</span>Tagihan</button><button onclick="A.go(\'bukti\')"><span class="circ">' + I.shield + '</span>Cek bukti</button><button onclick="A.go(\'penawaran\')"><span class="circ">' + I.calc + '</span>Hitung harga</button><button onclick="A.go(\'laporan\')"><span class="circ">' + I.chart + '</span>Laporan</button></div>' +
    '<button class="todo" style="background:var(--lime)" onclick="A.go(\'penawaran\')"><span class="avatar" style="background:var(--green);color:var(--lime);border-radius:21px;width:42px;height:42px">K</span><span class="col grow" style="gap:0"><span class="t">Ada permintaan penawaran baru?</span><span class="s" style="color:#0B1410;opacity:.8">Konsultan Penawaran: 6 pertanyaan, langsung dapat harga aman</span></span>' + I.chev + '</button>' +
    (todos.length ? '<div class="sect"><h2>Perlu tindakan Bapak</h2></div><div class="col" style="gap:8px">' + todos.join('') + '</div>' : card('<b>Semua beres, tidak ada yang menunggu Bapak.</b><span class="small">Yang biasa dicek: progres proyek dan uang yang belum dibayar klien.</span><div class="row wrap"><button class="btn sm" onclick="A.tab(\'proyek\')">Lihat proyek</button><button class="btn sm ghost" onclick="A.go(\'tagihan\')">Lihat tagihan</button></div>', 'ok')) +
    '<div class="sect"><h2>Proyek berjalan</h2><button onclick="A.tab(\'proyek\')">Lihat semua</button></div>' +
    (ps.length ? '<div class="hscroll">' + ps.map((p) => pcard(p)).join('') + '</div>' : card('<span class="muted">Belum ada proyek.</span><button class="btn sm" onclick="A.go(\'penawaran\')">Hitung penawaran pertama</button>')) +
    card('<h3>Kejadian terakhir</h3><div class="list">' + S.log.slice(0, 6).map((l) => '<div class="small"><b>' + esc(l.who) + '</b> ' + esc(l.text) + '<br><span class="tiny muted2">' + tgl(l.ts) + '</span></div>').join('') + '</div>');
}
function projectsView() {
  const ps = S.projects; const group = (st) => ps.filter((p) => st.includes(p.status));
  const sec = (title, list) => list.length ? '<div class="sect"><h2>' + title + ' (' + list.length + ')</h2></div><div class="plist">' + list.map((p) => pcard(p, true)).join('') + '</div>' : '';
  return hdrTitle('Proyek', ps.length + ' proyek', '<button class="btn sm ghost" onclick="A.go(\'penawaran\')" title="Gambaran kasar: layak diambil, risiko, harga minimum">+ Penawaran baru</button>') +
    (ps.length ? sec('Berjalan', group(['berjalan', 'kontrak'])) + sec('Masih penawaran', group(['penawaran'])) + sec('Selesai', group(['selesai'])) : card('<b>Belum ada proyek.</b><span class="small">Mulai dari Konsultan Penawaran: jawab 6 pertanyaan, simpan, dan proyek langsung dibuat.</span><button class="btn sm" onclick="A.go(\'penawaran\')">Hitung penawaran</button>')) +
    '<button class="link" style="align-self:center" onclick="A.newProject()">Buat proyek kosong tanpa hitung penawaran</button>';
}
function projectView() {
  const p = P(); if (!p) return hdrTitle('Proyek') + card('Proyek tidak ditemukan.'); const s = p.summary;
  const act = (v, label, sub, icon) => '<button class="tile" onclick="A.go(\'' + v + '\')">' + icon + '<span class="col" style="gap:0"><b class="l">' + label + '</b><span class="s">' + sub + '</span></span></button>';
  const myInv = S.invoices.filter((i) => i.projectId === p.id), unpaid = myInv.filter((i) => i.status === 'sent').length;
  return hdrTitle(p.name, esc(p.client || '—') + ' · ' + esc(p.status), pill(zoneTxt(s.zone), zoneCls(s.zone))) +
    '<div class="hero"><div class="col" style="gap:4px"><span class="lbl">Nilai kontrak (belum PPN)' + (s.vo ? ' · termasuk tambah-kurang ' + sh(s.vo) : '') + '</span><span class="big">' + sh(s.contract) + '</span><span class="sub">Perkiraan untung bersih <b style="color:var(--lime)">' + sh(s.labaAkhir) + ' (' + pct(s.labaPct) + ')</b></span></div><div class="minis"><button class="mini" onclick="A.go(\'rab\')"><span>Pekerjaan selesai</span><b class="lime">' + prog(s.verified) + '</b></button><button class="mini" onclick="A.go(\'bukti\')"><span>Uang keluar</span><b>' + sh(s.spent) + '</b></button><button class="mini"><span>Kas proyek</span><b>' + sh(s.kas) + '</b></button></div></div>' +
    '<div class="tiles">' + act('rab', 'RAB', 'biaya & harga per pekerjaan', small(I.calc)) + act('tagihan', 'Tagihan', unpaid ? unpaid + ' belum dibayar' : 'uang muka & termin', I.bill) + act('tambahkurang', 'Tambah-kurang', (p.vos || []).length ? (p.vos || []).length + ' perubahan' : 'pekerjaan di luar kontrak', I.nota) + act('laporan', 'Laporan', 'untung, kas, unduh Excel', small(I.chart)) + '</div>' +
    (s.overMarket ? card('<b>Uang keluar ' + sh(s.overMarket) + ' di atas harga pasar</b><span class="small">Ada nota yang disetujui lebih mahal dari matriks harga. Untung berkurang sebesar ini.</span>', 'warn') : '') +
    card('<h3>Progres per pekerjaan</h3><span class="tiny muted">' + esc(progressExplain(p)) + '</span><div class="list">' + p.divisions.map((d) => '<div class="col" style="gap:3px"><div class="row between small"><span>' + esc(dname(d)) + ' <span class="muted2">· bobot ' + prog(weightOf(p, d)) + '</span></span><b>' + (d.verified || 0) + '%</b></div>' + bar((d.verified || 0) / 100) + (d.progress > (d.verified || 0) ? '<span class="tiny" style="color:var(--warnink)">Mandor melapor ' + d.progress + '%, belum diperiksa</span>' : '') + '</div>').join('') + '</div>') +
    (p.offer ? card('<div class="row between"><b>Hasil Konsultan Penawaran</b><span class="tiny muted">' + tgl(p.offer.ts) + '</span></div><span class="small">' + esc({ baru: 'Bangun baru', renov_besar: 'Renovasi besar', renov_sedang: 'Renovasi sedang', renov_kecil: 'Renovasi kecil', interior: 'Interior' }[p.offer.kategori]) + ' · ' + esc(p.offer.type) + ' ' + p.offer.area.toLocaleString('id-ID') + ' m² · ' + esc(p.offer.qual) + ' · tukang ' + esc(p.offer.tukang) + '</span><div class="grid3"><span class="col" style="gap:0"><span class="tiny muted">Batas rugi</span><b>' + sh(p.offer.floor) + '</b></span><span class="col" style="gap:0"><span class="tiny muted">Bersaing</span><b>' + sh(p.offer.bersaing) + '</b></span><span class="col" style="gap:0"><span class="tiny muted">Aman</span><b>' + sh(p.offer.aman) + '</b></span></div><span class="tiny muted">Syarat: ' + p.offer.terms.slice(0, 3).map(esc).join(' · ') + '</span>') : '') +
    card('<h3>Riwayat</h3><div class="list">' + (S.log.filter((l) => l.projectId === p.id).slice(0, 10).map((l) => '<div class="small"><b>' + esc(l.who) + '</b> ' + esc(l.text) + ' <span class="tiny muted2">' + tgl(l.ts) + '</span></div>').join('') || '<span class="small muted">Belum ada kejadian.</span>') + '</div>');
}
function buktiView() {
  const C = S.config, role = S.user.role; const pendN = role === 'owner' ? S.notas.filter((n) => n.status === 'owner') : S.notas.filter((n) => n.status === 'pending');
  const reps = S.reports.filter((r) => !r.verified).slice().reverse(), ab = S.attendance.filter((a) => a.ts.slice(0, 10) === today()).slice().reverse();
  const risk = S.projects.reduce((a, p) => a.concat((p.vos || []).filter((v) => v.status === 'risk').map((v) => Object.assign({ pid: p.id, pname: p.name }, v))), []);
  const hist = S.notas.filter((n) => !pendN.includes(n)).slice(-8).reverse();
  const empty = !pendN.length && !reps.length && !risk.length;
  return hdrTitle('Cek bukti', role === 'owner' ? 'Persetujuan Bapak & laporan lapangan' : 'Nota s/d ' + sh(C.approvalLimit) + ', di atasnya diteruskan ke Owner') +
    (empty ? card('<b>Tidak ada yang perlu diperiksa.</b><span class="small">Nota dan laporan baru dari mandor akan muncul di sini.</span>', 'ok') : '') +
    (pendN.length ? '<div class="sect"><h2>Nota menunggu ' + (role === 'owner' ? 'Bapak' : 'Admin') + ' (' + pendN.length + ')</h2></div>' + pendN.map((n) => notaCard(n, '<button class="btn danger sm" onclick="A.decide(\'' + n.id + '\',\'reject\')">Tolak</button><button class="btn sm" onclick="A.decide(\'' + n.id + '\',\'approve\')">' + (role === 'admin' && n.amount > C.approvalLimit ? 'Teruskan ke Owner' : 'Setujui') + '</button>')).join('') : '') +
    (reps.length ? '<div class="sect"><h2>Laporan progres belum diperiksa (' + reps.length + ')</h2></div>' + reps.map((r) => { const p = projOf(r.projectId); return card('<div class="col" style="gap:0"><b>' + esc(p.name) + ' · ' + esc(r.name) + '</b><span class="small">' + r.items.map((it) => esc(dname(p.divisions[it.div])) + ' → ' + it.pct + '%').join(', ') + '</span><span class="tiny muted">' + tgl(r.ts) + (r.note ? ' · "' + esc(r.note) + '"' : '') + '</span></div><div class="thumbs">' + r.photos.map((f) => photo(f)).join('') + '</div><span class="tiny muted">Cocokkan foto dengan angka progres sebelum memverifikasi. Hanya progres yang diverifikasi yang bisa ditagih.</span><button class="btn sm" onclick="A.verify(\'' + r.projectId + '\',\'' + r.id + '\')">Foto sesuai — verifikasi</button>'); }).join('') : '') +
    (risk.length ? '<div class="sect"><h2>Pekerjaan tambah tanpa persetujuan klien</h2></div>' + risk.map((v) => todo(v.desc, v.pname + ' · ' + sh(v.price), "A.open('" + v.pid + "','tambahkurang')", 'var(--badbg)', 'var(--bad)')).join('') : '') +
    card('<h3>Absen hari ini</h3><div class="list">' + (ab.length ? ab.map((a) => '<div class="row between small"><div class="row">' + photo(a.photo, true) + '<div class="col" style="gap:0"><b>' + esc(a.name) + ' · ' + a.type + ' ' + jam(a.ts) + '</b><span class="tiny muted2">' + esc(projOf(a.projectId).name) + (a.workers ? ' · ' + a.workers + ' tukang' : '') + '</span></div></div>' + (a.onSite ? pill('Di lokasi', 'ok') : a.distM == null ? pill('Tanpa GPS', 'grey') : pill(a.distM + ' m dari proyek', 'bad')) + '</div>').join('') : '<span class="muted small">Belum ada yang absen hari ini.</span>') + '</div>') +
    (hist.length ? '<button class="link" onclick="A.toggle(\'histOpen\')">' + (sel.histOpen ? 'Sembunyikan' : 'Lihat') + ' riwayat nota (' + hist.length + ')</button>' + (sel.histOpen ? hist.map((n) => notaCard(n)).join('') : '') : '');
}
function tagihanView() {
  const ps = S.projects.filter((p) => p.status !== 'selesai' || S.invoices.some((i) => i.projectId === p.id && i.status === 'sent'));
  const blk = (p) => {
    const s = p.summary, invs = S.invoices.filter((i) => i.projectId === p.id);
    const terms = [{ n: 0, label: 'Uang muka (DP ' + Math.round(p.dp * 100) + '%)', atProgress: 0 }].concat(p.termins || []);
    const row = (t) => {
      const inv = invs.find((i) => i.termin === t.n && i.status !== 'void');
      let right, why = '';
      if (inv) { right = '<div class="col right" style="gap:4px"><b>' + rp(inv.transfer) + '</b>' + (inv.status === 'paid' ? pill('Lunas ' + tglD(inv.paidAt), 'ok') : '<button class="btn sm ghost" onclick="A.paid(\'' + inv.id + '\',\'' + esc(inv.label) + '\',' + Math.round(inv.transfer) + ')">Tandai dibayar</button>') + '</div>'; }
      else if (t.n === 0 && p.status === 'penawaran') { right = ''; why = 'Bisa ditagih setelah status proyek diubah menjadi "kontrak". <button class="link" onclick="A.open(\'' + p.id + '\',\'rab\')">Ubah di RAB</button>'; }
      else if (t.n > 0 && s.verified + 1e-9 < t.atProgress) { right = ''; why = 'Bisa ditagih setelah progres diperiksa mencapai ' + Math.round(t.atProgress * 100) + '% (sekarang ' + prog(s.verified) + '). <button class="link" onclick="A.go(\'bukti\')">Cek bukti</button>'; }
      else right = '<button class="btn sm" onclick="A.invoice(\'' + p.id + '\',' + t.n + ')">Buat tagihan</button>';
      const open = inv && sel['inv' + inv.id];
      return '<div class="col" style="gap:4px"><div class="row between wrap"><div class="col" style="gap:0"><b>' + esc(t.label) + '</b>' + (t.n ? '<span class="tiny muted">' + Math.round(t.pct * 100) + '% kontrak · saat progres ' + Math.round(t.atProgress * 100) + '%</span>' : '') + '</div>' + right + '</div>' + (why ? '<span class="tiny" style="color:var(--mute)">' + why + '</span>' : '') +
        (inv && inv.termin > 0 ? '<button class="link" onclick="A.toggle(\'inv' + inv.id + '\')">' + (open ? 'Sembunyikan rincian' : 'Lihat rincian potongan') + '</button>' + (open ? '<div class="list small inset">' + [['Nilai pekerjaan termin ini', inv.bruto], ['− Potong uang muka', -inv.potDP], ['− Ditahan klien (retensi)', -inv.retensi], ['Tagihan bersih', inv.net], ['+ PPN 11%', inv.ppn], ['− PPh final, dipotong klien', -inv.pph], ['Uang yang masuk rekening', inv.transfer]].map((r) => '<div class="row between"><span>' + r[0] + '</span><b>' + rp(r[1]) + '</b></div>').join('') + '</div>' : '') : '') + '</div>';
    };
    return card('<div class="row between"><div class="col" style="gap:0"><h3>' + esc(p.name) + '</h3><span class="tiny muted">kontrak ' + sh(s.contract) + ' · pekerjaan selesai ' + prog(s.verified) + '</span></div><button class="link" onclick="A.open(\'' + p.id + '\')">Buka</button></div><div class="list">' + terms.map(row).join('') + '</div>');
  };
  const tot = S.projects.reduce((a, p) => a + p.summary.receivable, 0);
  return hdrTitle('Tagihan', 'Uang muka & termin semua proyek') +
    '<div class="grid">' + kpi('Siap ditagih', sh(readyAmount()), '', 'dark') + kpi('Belum dibayar klien', sh(tot)) + '</div>' +
    (ps.length ? ps.map(blk).join('') : card('Belum ada proyek.')) +
    '<span class="tiny muted" style="text-align:center">Laporan untung & kas ada di menu <button class="link" onclick="A.go(\'laporan\')">Laporan</button>.</span>';
}
function laporanView() {
  const ps = sel.pid && navStack.includes('detail') ? [P()].filter(Boolean) : S.projects;
  const tot = ps.reduce((a, p) => { const s = p.summary; return { rev: a.rev + s.revenue, spent: a.spent + s.spent, kas: a.kas + s.kas, laba: a.laba + s.labaAkhir }; }, { rev: 0, spent: 0, kas: 0, laba: 0 });
  return hdrTitle('Laporan', ps.length === 1 ? esc(ps[0].name) : 'Semua proyek') + '<div class="grid">' + kpi('Nilai pekerjaan selesai', sh(tot.rev), 'pendapatan diakui (PSAK 72)', 'dark') + kpi('Uang keluar', sh(tot.spent), 'nota disetujui') + kpi('Untung kotor', sh(tot.rev - tot.spent)) + kpi('Kas', sh(tot.kas)) + kpi('Perkiraan untung akhir', sh(tot.laba)) + '</div>' +
    ps.map(psak).join('') + '<div class="note">' + I.lock + '<span>Angka belum termasuk PPN. "Nilai pekerjaan selesai" memakai progres yang sudah diperiksa Admin, bukan yang baru dilaporkan mandor.</span></div>';
}
function menuView() {
  const role = S.user.role;
  const mods = role === 'mandor' ? [] : [['penawaran', 'Konsultan Penawaran', 'hitung harga aman sebelum menawar'], ['proyek', 'Proyek', 'RAB, tambah-kurang, progres per proyek'], ['bukti', 'Cek bukti', 'nota, laporan foto, absen'], ['tagihan', 'Tagihan', 'uang muka & termin'], ['laporan', 'Laporan', 'untung, kas, unduh Excel'], ['harga', 'Matriks harga pasar', 'patokan pembanding nota']];
  return hdrTitle('Menu', esc(S.user.name) + ' · ' + ({ owner: 'Owner', admin: 'Admin – Finance', mandor: 'Mandor' })[role]) + (mods.length ? '<div class="col" style="gap:8px">' + mods.map((m) => todo(m[1], m[2], (m[0] === 'proyek' ? "A.tab('proyek')" : "A.go('" + m[0] + "')"), 'var(--okbg)', 'var(--ok)')).join('') + '</div>' : '') +
    '<form class="card" onsubmit="A.setPass(event)"><h3>Ganti password</h3><div class="field"><label>Password lama</label><input id="pw0" type="password" required></div><div class="field"><label>Password baru (min. 6 huruf/angka)</label><input id="pw1" type="password" required minlength="6"></div><button class="btn ghost">Simpan password</button></form>' +
    '<div class="note">' + I.lock + '<span>Owner melihat semua angka dan menyetujui biaya di atas ' + sh(S.config.approvalLimit) + '. Admin – Finance: RAB, harga, nota, tagihan. Mandor: absen, lapor progres, kirim nota — tanpa angka uang.</span></div>' +
    '<button class="btn danger full" onclick="A.logout()">Keluar</button>';
}
function voView() {
  const p = P(); if (!p) return hdrTitle('Tambah-kurang') + card('Pilih proyek dulu.'); sel.voKind = sel.voKind || 'plus';
  const ST = { ok: ['Disetujui klien', 'ok'], wait: ['Menunggu jawaban klien', 'warn'], risk: ['Dikerjakan tanpa persetujuan', 'bad'], void: ['Dibatalkan', 'grey'] }, order = { risk: 0, wait: 1, ok: 2, void: 3 };
  const vos = (p.vos || []).slice().sort((a, b) => order[a.status] - order[b.status]); const sum = (f) => vos.filter(f).reduce((a, v) => a + v.price, 0);
  const sgn = (v) => (v < 0 ? '− ' : '+ ') + sh(Math.abs(v)), F = sel.form;
  return hdrTitle('Tambah-kurang', esc(p.name)) +
    '<div class="hero"><div class="col" style="gap:4px"><span class="lbl">Perubahan kontrak yang sudah disetujui klien</span><span class="big">' + sgn(sum((v) => v.status === 'ok')) + '</span><span class="sub">Nilai kontrak sekarang <b style="color:var(--lime)">' + sh(p.summary.contract) + '</b></span></div><div class="minis"><button class="mini"><span>Menunggu klien</span><b>' + sh(sum((v) => v.status === 'wait')) + '</b></button><button class="mini"><span>Tanpa persetujuan</span><b style="color:#FFB4AE">' + sh(sum((v) => v.status === 'risk')) + '</b></button><button class="mini"><span>Jumlah</span><b>' + vos.length + '</b></button></div></div>' +
    (vos.length ? vos.map((v) => card('<div class="row between" style="align-items:flex-start"><div class="col grow" style="gap:0"><b>' + esc(v.desc) + '</b><span class="tiny muted">' + (v.kind === 'plus' ? 'Pekerjaan tambah' : 'Pekerjaan kurang') + ' · biaya ' + rp(v.cost) + ' + untung ' + v.margin + '% · ' + tgl(v.ts) + (v.okBy ? ' · disetujui ' + esc(v.okBy) : '') + '</span></div><b style="color:' + (v.kind === 'minus' ? 'var(--bad)' : 'var(--ok)') + '">' + sgn(v.price) + '</b></div><div class="row between wrap">' + pill(ST[v.status][0], ST[v.status][1]) + (v.status === 'ok' || v.status === 'void' ? '' : '<span class="row"><button class="btn sm ghost" onclick="A.voStatus(\'' + v.id + '\',\'void\')">Batalkan</button><button class="btn sm" onclick="A.voStatus(\'' + v.id + '\',\'ok\')">Klien setuju</button></span>') + '</div>', v.status === 'risk' ? 'bad' : '')).join('') : card('<span class="muted">Belum ada pekerjaan tambah-kurang di proyek ini.</span>')) +
    card('<h3>Catat pekerjaan tambah / kurang</h3><div class="chips"><button class="chip ' + (sel.voKind === 'plus' ? 'on' : '') + '" onclick="A.setVoKind(\'plus\')">Tambah</button><button class="chip ' + (sel.voKind === 'minus' ? 'on' : '') + '" onclick="A.setVoKind(\'minus\')">Kurang</button></div>' + field('Uraian pekerjaan', 'voDesc', '', { attrs: 'placeholder="mis. Ganti keramik lantai 2 jadi granit 60×60"' }) + field('Biaya modal (Rp)', 'voCost', '', { attrs: 'inputmode="numeric" placeholder="mis. 64000000"' }) + field('Untung %', 'voMargin', p.buk || 15, { attrs: 'type="number"' }) + '<label class="row small"><input type="checkbox" data-k="voRisk" onchange="A.f(this)"' + (F.voRisk ? ' checked' : '') + ' style="width:22px;min-height:22px"> Sudah terlanjur dikerjakan sebelum klien setuju</label><span class="tiny muted">Harga ke klien = biaya + untung. Nilai kontrak baru berubah setelah klien setuju.</span><button class="btn full" onclick="A.vo()">Simpan</button>');
}
function penawaranView() {
  sel.kon = sel.kon || KONSULTAN.defaults();
  const intro = sel.kon.step === 1 ? card('<b>Ini gambaran kasar, bukan RAB</b><span class="small">Dalam 6 pertanyaan, Konsultan menjawab tiga hal sebelum Bapak menawar:</span><div class="list small"><div><b>1. Layak diambil atau tidak?</b> Dilihat dari harga, untung bersih, dan kemampuan kas Bapak menalangi sampai termin cair.</div><div><b>2. Seberapa besar risikonya?</b> Kondisi tanah, akses lokasi, cara bayar tukang, jenis klien, dan cara bayarnya.</div><div><b>3. Berapa harga minimum?</b> Batas di mana Bapak mulai rugi, sudah memperhitungkan risiko-risiko di atas.</div></div><span class="tiny">Ketelitian sekitar ±15–25%. Sebelum tanda tangan kontrak, susun RAB rinci dari gambar kerja.</span>', 'blue') : '';
  return hdrTitle('Konsultan Penawaran', 'Gambaran kasar: layak, risiko, harga minimum') + intro + KONSULTAN.view(sel.kon, S);
}
function rabView() {
  const p = P(); if (!p) return hdrTitle('RAB') + card('Pilih proyek dulu.'); const s = p.summary, C = S.config, F = sel.form;
  const dv = (d, i, k, base) => F[k + i] != null ? F[k + i] : base;
  const rowOf = (d, i) => '<div class="rabrow">' + (d.src ? '<div class="col" style="gap:2px"><b class="small">' + esc(d.name) + '</b><button class="link" onclick="A.go(\'' + (d.src === 'struct' ? 'struktur' : 'interior') + '\')">' + (d.src === 'struct' ? 'Ubah rincian per elemen' : 'Ubah pembagian interior') + ' →</button></div><div class="col right" style="gap:0"><span class="tiny muted">Biaya modal</span><b class="small">' + rp(d.rap) + '</b><span class="tiny muted2">dihitung otomatis</span></div>' : '<input class="sm" aria-label="Nama pekerjaan" data-k="dn' + i + '" oninput="A.f(this)" value="' + esc(dv(d, i, 'dn', d.name)) + '"><div class="field"><label class="tiny">Biaya modal (Rp)</label><input class="sm num" data-k="dr' + i + '" oninput="A.f(this);A.bukPreview()" inputmode="numeric" value="' + esc(F['dr' + i] != null ? F['dr' + i] : Math.round(d.rap).toLocaleString('id-ID')) + '"></div>') + '<div class="col right" style="gap:0"><span class="tiny muted">Harga ke klien</span><b class="small">' + rp(d.rap * (1 + p.buk / 100)) + '</b><span class="tiny muted2">bobot ' + prog(weightOf(p, d)) + '</span></div></div>';
  // RAB per lantai: kelompokkan baris menurut lantai/area, dengan subtotal & tombol tambah per lantai
  const grps = []; p.divisions.forEach((d, i) => { const g = d.grp || ''; let G = grps.find((x) => x.g === g); if (!G) grps.push(G = { g, ix: [] }); G.ix.push(i); });
  const rows = grps.some((G) => G.g) ? grps.map((G) => '<div class="row between" style="margin-top:6px;padding:8px 0 4px;border-bottom:2px solid var(--ink)"><b>' + esc(G.g || 'Lain-lain') + '</b><span class="small"><b>' + rp(G.ix.reduce((a, i) => a + p.divisions[i].rap, 0)) + '</b></span></div>' + G.ix.map((i) => rowOf(p.divisions[i], i)).join('') + '<button class="link" style="align-self:flex-start" onclick="A.addDiv(' + esc(JSON.stringify(G.g)).replace(/"/g, '&quot;') + ')">+ pekerjaan di ' + esc(G.g || 'Lain-lain') + '</button>').join('') : p.divisions.map(rowOf).join('');
  const sumSrc = (k) => { const a = p.divisions.filter((d) => d.src === k); return a.length ? { rap: a.reduce((x, d) => x + d.rap, 0) } : null; }, sd = sumSrc('struct'), idv = sumSrc('interior');
  return hdrTitle('RAB', esc(p.name)) +
    '<div class="tiles"><button class="tile" onclick="A.go(\'struktur\')">' + small(I.calc) + '<span class="col" style="gap:0"><b class="l">Struktur beton</b><span class="s">' + (p.struct && p.struct.length ? p.struct.length + ' elemen' + (sd ? ' · ' + sh(sd.rap) : '') : 'rinci mutu & cara cor') + '</span></span></button><button class="tile" onclick="A.go(\'interior\')">' + I.home + '<span class="col" style="gap:0"><b class="l">Interior</b><span class="s">' + (p.interior && p.interior.length ? 'pembagian diatur' + (idv ? ' · ' + sh(idv.rap) : '') : 'siapa mengerjakan apa') + '</span></span></button></div>' +
    fairCard(p) +
    card('<h3>Data proyek</h3><div class="grid">' + field('Nama proyek', 'pname', p.name, { attrs: 'class="sm"' }) + field('Klien', 'pclient', p.client, { attrs: 'class="sm"' }) + field('Alamat', 'paddr', p.address || '', { attrs: 'class="sm"' }) + '<div class="field"><label>Status</label><select class="sm" data-k="pstatus" onchange="A.f(this)">' + [['penawaran', 'Penawaran'], ['kontrak', 'Kontrak ditandatangani'], ['berjalan', 'Berjalan'], ['selesai', 'Selesai']].map((x) => '<option value="' + x[0] + '" ' + ((F.pstatus || p.status) === x[0] ? 'selected' : '') + '>' + x[1] + '</option>').join('') + '</select></div>' + field('Kas awal proyek (Rp)', 'kas', Math.round(p.kasAwal || 0).toLocaleString('id-ID'), { attrs: 'class="sm" inputmode="numeric"' }) + field('Luas bangunan (m²)', 'parea', p.area || '', { attrs: 'class="sm" inputmode="decimal"' }) + field('Jumlah lantai', 'plantai', p.lantai || '', { attrs: 'class="sm" inputmode="numeric"' }) + '</div>' +
      '<button class="link" onclick="A.toggle(\'locOpen\')">' + (sel.locOpen ? 'Sembunyikan' : 'Atur') + ' titik lokasi proyek (untuk cek absen mandor)</button>' + (sel.locOpen ? '<div class="grid">' + field('Garis lintang (lat)', 'plat', p.lat ?? '', { attrs: 'class="sm"' }) + field('Garis bujur (lng)', 'plng', p.lng ?? '', { attrs: 'class="sm"' }) + '</div><span class="tiny muted">Di Google Maps: tekan lama titik proyek → salin angka koordinat. Absen dianggap di lokasi bila jaraknya ≤ ' + C.siteRadiusM + ' m.</span>' : '')) +
    card('<h3>' + T('Biaya modal per pekerjaan', '(RAP)') + '</h3><span class="tiny muted">Angka ini hanya untuk internal, tidak pernah dikirim ke klien.</span><div class="rablist">' + rows + '</div><div class="row between"><b>Jumlah biaya modal</b><b id="rapTot">' + rp(s.rap) + '</b></div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm ghost" onclick="A.addDiv()">+ Tambah pekerjaan</button><button class="btn sm ghost" onclick="A.addGrp()">+ Tambah lantai / area</button></div>') +
    card('<h3>' + T('Untung di RAB', '(BUK)') + '</h3><div class="row wrap" style="align-items:flex-end"><div class="field"><label>Persen untung — minimal ' + s.floorBuk + '%</label><input class="sm" data-k="buk" oninput="A.f(this);A.bukPreview()" type="number" min="' + s.floorBuk + '" max="25" value="' + esc(F.buk != null ? F.buk : p.buk) + '" style="width:110px"></div><div id="bukOut" class="grow">Harga ke klien <b>' + sh(s.contract) + '</b> · untung bersih <b>' + pct(s.net) + '</b> ' + pill(zoneTxt(s.zone), zoneCls(s.zone)) + '</div></div><span class="tiny muted">Dari setiap Rp 100 harga: biaya kantor ' + (C.overhead * 100) + ', bunga ' + (C.bunga * 100) + ', PPh final ' + (C.pph * 100) + '. Di bawah ' + s.floorBuk + '% pasti rugi, jadi aplikasi menolak angka lebih kecil.</span>') +
    '<button class="btn full" onclick="A.saveRab()">Simpan RAB</button>' +
    card('<h3>Kirim ke klien</h3><button class="btn sm ghost" onclick="A.exportCsv()">Unduh ringkasan Excel (CSV)</button><span class="tiny muted">Dokumen PDF versi klien (tanpa biaya modal) dan versi bank menyusul.</span>');
}
function strukturView() {
  const p = P(); if (!p) return hdrTitle('Struktur beton') + card('Pilih proyek dulu.');
  if (sel.structPid !== p.id) { sel.structPid = p.id; sel.struct = JSON.parse(JSON.stringify(p.struct || BETON.defaults(p.area, p.lantai || 1, (p.offer && p.offer.cor) || 'pump'))); sel.perCor = p.structPerCor || 20; }
  const P2 = BETON.prices(S.matrix), ctx = { volPerCor: sel.perCor, lantai: p.lantai || 1 }, res = sel.struct.map((e) => BETON.element(e, P2, ctx));
  const total = res.reduce((a, r) => a + r.total, 0), vol = sel.struct.reduce((a, e) => a + (Number(e.vol) || 0), 0), cur = (p.divisions.filter((d) => d.src === 'struct').length > 1 ? { rap: p.divisions.filter((d) => d.src === 'struct').reduce((a, d) => a + d.rap, 0) } : p.divisions.find((d) => d.src === 'struct') || p.divisions.find((d) => /struktur/i.test(d.name)) || { rap: 0 }).rap;
  const pond = p.divisions.find((d) => /pondasi/i.test(d.name) && d.src !== 'struct');
  const opt = (obj, v, lab) => Object.keys(obj).map((k) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(lab ? lab(k) : obj[k][0]) + '</option>').join('');
  const rows = sel.struct.map((e, i) => { const r = res[i]; return card('<div class="row between"><select class="sm" style="max-width:240px" aria-label="Elemen" onchange="A.st(' + i + ',\'el\',this.value)">' + opt(BETON.EL, e.el) + '</select><button class="link" style="color:var(--bad)" onclick="A.stDel(' + i + ')">Hapus</button></div>' +
    '<div class="grid">' + '<div class="field"><label class="tiny">Mutu beton</label><select class="sm" onchange="A.st(' + i + ',\'mutu\',this.value)">' + opt(BETON.MUTU, e.mutu, (k) => k + ' (fc′ ' + String(BETON.MUTU[k][0]).replace('.', ',') + ')') + '</select></div>' + '<div class="field"><label class="tiny">Cara cor</label><select class="sm" onchange="A.st(' + i + ',\'met\',this.value)">' + opt(BETON.MET, e.met) + '</select></div>' +
    (e.el === 'kerja' ? '' : '<div class="field"><label class="tiny">Besi</label><select class="sm" onchange="A.st(' + i + ',\'baja\',this.value)">' + Object.keys(BETON.BAJA).map((k) => '<option value="' + k + '"' + (k === e.baja ? ' selected' : '') + '>' + BETON.BAJA[k] + '</option>').join('') + '</select></div>') +
    '<div class="field"><label class="tiny">Volume (m³)</label><input class="sm num" inputmode="decimal" value="' + esc(e.vol) + '" onchange="A.st(' + i + ',\'vol\',this.value)"></div>' + (e.el === 'kerja' ? '' : '<div class="field"><label class="tiny">Besi kg/m³ (umum ' + BETON.EL[e.el][4] + ')</label><input class="sm num" inputmode="decimal" value="' + esc(r.ratio) + '" onchange="A.st(' + i + ',\'ratio\',this.value)"></div>') + '</div>' +
    (e.el === 'plat' && r.slab ? '<div class="chips"><button class="chip ' + (e.slab !== 'bondek' ? 'on' : '') + '" onclick="A.st(' + i + ',\'slab\',\'konv\')">Konvensional ' + sh(r.slab.konv * r.slab.area) + '</button><button class="chip ' + (e.slab === 'bondek' ? 'on' : '') + '" onclick="A.st(' + i + ',\'slab\',\'bondek\')">Bondek + wiremesh ' + sh(r.slab.bond * r.slab.area) + '</button></div><span class="tiny muted">±' + Math.round(r.slab.area) + ' m² plat · ' + (r.slab.bond < r.slab.konv ? 'bondek lebih murah ' + rp(r.slab.konv - r.slab.bond) + '/m² dan lebih cepat' : 'konvensional lebih murah ' + rp(r.slab.bond - r.slab.konv) + '/m²') + '</span>' : '') +
    r.warn.map((w) => '<span class="small" style="color:' + (w[0] === 'bad' ? 'var(--bad)' : 'var(--warnink)') + '">⚠ ' + esc(w[1]) + '</span>').join('') +
    (r.ok ? '<div class="row between"><span class="small muted">' + rp(r.perM3) + ' / m³</span><b>' + rp(r.total) + '</b></div><span class="tiny muted2">' + r.parts.filter((x) => x[1] > 0).map((x) => x[0] + ' ' + sh(x[1])).join(' · ') + '</span>' : '')); }).join('');
  return hdrTitle('Struktur beton per elemen', esc(p.name)) +
    '<div class="note">' + I.lock + '<span>Mutu beton & besi selalu mengikuti gambar struktur yang ditandatangani perencana. Yang boleh dihemat hanya cara cor dan sumber beli, bukan mutu. Harga dari matriks harga pasar ' + esc(S.matrix ? S.matrix.version : '') + '.</span></div>' +
    '<div class="hero"><div class="col" style="gap:4px"><span class="lbl">Biaya modal struktur · ' + String(Math.round(vol * 10) / 10).replace('.', ',') + ' m³</span><span class="big">' + sh(total) + '</span><span class="sub">Di RAB sekarang ' + sh(cur) + (cur ? ' · selisih ' + (total >= cur ? '+' : '−') + sh(Math.abs(total - cur)) : '') + '</span></div></div>' +
    card('<div class="row wrap" style="align-items:flex-end"><div class="field"><label>Volume sekali cor (m³)</label><input class="sm num" style="width:110px" inputmode="decimal" value="' + sel.perCor + '" onchange="A.setPerCor(this.value)"></div><span class="tiny muted grow">Sewa pompa minimal 8 jam dibagi volume ini. Makin kecil sekali cor, makin mahal per m³.</span></div><button class="link" onclick="A.stReset()">Isi ulang volume dari luas bangunan</button>') +
    rows + '<button class="btn ghost full" onclick="A.stAdd()">+ Tambah elemen</button>' +
    (pond ? card('<b>Cek: jangan dihitung dua kali</b><span class="small">Pondasi & sloof sudah dihitung di sini. Pekerjaan "' + esc(pond.name) + '" (' + sh(pond.rap) + ') di RAB sebaiknya hanya galian & urugan.</span>', 'warn') : '') +
    '<button class="btn full" onclick="A.saveStruct()">Simpan ke RAB</button>';
}
function interiorView() {
  const p = P(); if (!p) return hdrTitle('Interior') + card('Pilih proyek dulu.');
  if (sel.interPid !== p.id) { sel.interPid = p.id; sel.inter = JSON.parse(JSON.stringify(p.interior || INTERIOR.defaults((p.offer && p.offer.interiorBy) || 'semua'))); }
  const r = INTERIOR.calc(sel.inter);
  const rows = sel.inter.map((x, i) => { const it = INTERIOR.info(x.key); if (!it) return ''; const rr = r.rows.find((z) => z.key === x.key) || {}; return '<div class="introw"><div class="col" style="gap:0"><b class="small">' + esc(it[1]) + '</b><span class="tiny muted">pasok+pasang ' + sh(it[3]) + ' · jasa ' + sh(it[4]) + ' per ' + esc(it[2]) + '</span></div><div class="chips">' + Object.keys(INTERIOR.BY).map((k) => '<button class="chip sm ' + (x.by === k ? 'on' : '') + '" onclick="A.it(' + i + ',\'by\',\'' + k + '\')">' + INTERIOR.BY[k][0] + '</button>').join('') + '</div><div class="row"><input class="sm num" style="width:90px" inputmode="decimal" aria-label="Jumlah" value="' + esc(x.qty) + '" onchange="A.it(' + i + ',\'qty\',this.value)"><span class="tiny muted">' + esc(it[2]) + '</span><b class="small grow right">' + (x.by === 'x' ? 'tidak termasuk' : rp(rr.total || 0)) + '</b></div></div>'; }).join('');
  return hdrTitle('Interior: siapa mengerjakan apa', esc(p.name)) +
    '<div class="note">' + I.lock + '<span>Tiap pekerjaan pilih: <b>Kontraktor</b> (pasok & pasang), <b>Jasa saja</b> (material dari pemilik), atau <b>Tidak termasuk</b> (pemilik / vendor lain). Daftar ini ikut ke klien supaya tidak ada yang dibayar dua kali.</span></div>' +
    '<div class="hero"><div class="col" style="gap:4px"><span class="lbl">Biaya modal interior oleh kontraktor</span><span class="big">' + sh(r.total) + '</span><span class="sub">' + r.termasuk.length + ' pekerjaan termasuk · ' + r.tidak.length + ' tidak termasuk</span></div></div>' +
    (r.gaps.length ? card('<b>Ada yang jatuh di tengah</b>' + r.gaps.map((g) => '<span class="small">⚠ ' + esc(g) + '</span>').join('') + '<span class="tiny">Tambahkan titiknya ke pekerjaan kontraktor, atau tulis jelas bahwa vendor pemilik yang mengerjakan.</span>', 'warn') : '') +
    card('<div class="list">' + rows + '</div>') +
    card('<h3>Yang dikirim ke klien</h3><div class="grid"><div class="col"><b class="small" style="color:var(--ok)">Termasuk</b>' + (r.termasuk.map((x) => '<span class="small">✓ ' + esc(x.name) + ' · ' + x.qty + ' ' + esc(x.unit) + (x.by === 'j' ? ' (jasa pasang, material dari pemilik)' : '') + '</span>').join('') || '<span class="small muted">—</span>') + '</div><div class="col"><b class="small" style="color:var(--bad)">Tidak termasuk</b>' + (r.tidak.map((x) => '<span class="small">✗ ' + esc(x.name) + '</span>').join('') || '<span class="small muted">—</span>') + '</div></div>') +
    '<button class="btn full" onclick="A.saveInterior()">Simpan ke RAB</button>';
}
function fairCard(p) {
  const s = p.summary, C = S.config, cut = C.overhead + C.bunga + C.pph, rap = s.rap, K = s.contract - (s.vo || 0);
  if (!rap) return '';
  const impas = rap / (1 - cut), wajarLo = rap * 1.12, wajarHi = rap * 1.20, lo = impas * 0.97, hi = rap * 1.28, pos = (v) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  const bukNow = K / rap - 1, kon = s.net >= 0.05 ? ['Aman', 'ok', 'untung bersih ' + pct(s.net) + ' setelah biaya kantor, bunga & PPh'] : s.net >= 0 ? ['Tipis', 'warn', 'untung bersih hanya ' + pct(s.net)] : ['Rugi', 'bad', 'harga di bawah biaya + kantor + bunga + pajak'];
  const kli = bukNow <= 0.20 + 1e-9 ? ['Wajar', 'ok', 'untung di RAB ' + pct(bukNow) + ' (wajar 12–20%)'] : bukNow <= 0.25 ? ['Agak tinggi', 'warn', 'untung di RAB ' + pct(bukNow) + ', jelaskan risikonya ke klien'] : ['Mahal', 'bad', 'untung di RAB ' + pct(bukNow) + ' di atas kebiasaan pasar'];
  const chk = [[!!S.matrix, 'Harga material dari matriks harga pasar ' + (S.matrix ? S.matrix.version + ' (' + tglD(S.matrix.date) + ')' : '')], [!!(p.struct && p.struct.length), 'Struktur dirinci per elemen: mutu beton & cara cor tertulis'], [!!(p.interior && p.interior.length) || !p.divisions.some((d) => /interior/i.test(d.name)), 'Pembagian interior jelas: termasuk / tidak termasuk'], [!!p.offer, 'Risiko proyek sudah dihitung di Konsultan Penawaran']];
  return card('<h3>Cek harga fair</h3><span class="tiny muted">Fair = kontraktor tidak rugi, klien membayar harga pasar + untung yang wajar.</span>' +
    '<div class="fairbar"><span class="zone bad" style="left:0;width:' + pos(impas) + '%"></span><span class="zone ok" style="left:' + pos(wajarLo) + '%;width:' + (pos(wajarHi) - pos(wajarLo)) + '%"></span><span class="zone warn" style="left:' + pos(wajarHi) + '%;right:0"></span><i style="left:' + pos(K) + '%"></i></div>' +
    '<div class="row between tiny muted"><span>Rugi &lt; ' + sh(impas) + '</span><span>Wajar ' + sh(wajarLo) + '–' + sh(wajarHi) + '</span><span>Harga ' + sh(K) + '</span></div>' +
    '<div class="grid"><div class="col" style="gap:2px"><span class="tiny muted">Untuk kontraktor</span>' + pill(kon[0], kon[1]) + '<span class="tiny">' + kon[2] + '</span></div><div class="col" style="gap:2px"><span class="tiny muted">Untuk klien</span>' + pill(kli[0], kli[1]) + '<span class="tiny">' + kli[2] + '</span></div></div>' +
    (p.offer ? '<span class="small">' + (K < p.offer.bersaing * 0.97 ? (p.struct && p.struct.length ? 'ℹ Lebih rendah dari perkiraan kasar Konsultan (' + sh(p.offer.bersaing) + ') karena struktur sudah dihitung per elemen. Ini harga yang lebih tepat untuk klien; pastikan untung di RAB masih menutup risiko proyek.' : '⚠ Di bawah harga bersaing hasil Konsultan (' + sh(p.offer.bersaing) + '): risiko belum tertutup.') : K > p.offer.aman * 1.05 ? '⚠ Di atas harga aman hasil Konsultan (' + sh(p.offer.aman) + '): klien membayar lebih dari risikonya.' : '✓ Di antara harga bersaing dan aman hasil Konsultan (' + sh(p.offer.bersaing) + '–' + sh(p.offer.aman) + ').') + '</span>' : '') +
    '<div class="list small">' + chk.map((c) => '<div style="color:' + (c[0] ? 'var(--ok)' : 'var(--warnink)') + '">' + (c[0] ? '✓ ' : '○ ') + esc(c[1]) + '</div>').join('') + '</div>');
}
function matrixView() {
  if (!S.matrix) return hdrTitle('Matriks harga') + card('Matriks belum ada.');
  return hdrTitle('Matriks harga pasar', 'Versi ' + esc(S.matrix.version) + ' · ' + tglD(S.matrix.date)) + '<div class="note">' + I.lock + '<span>Nota mandor dibandingkan dengan kolom "Wajar". Di atas kolom "Tinggi" = kemahalan. Ubah angka lalu tekan Simpan di barisnya.</span></div>' +
    '<div class="col" style="gap:8px">' + S.matrix.items.map((it) => card('<div class="row between"><div class="col" style="gap:0"><b>' + esc(it.name) + '</b><span class="tiny muted">per ' + esc(it.unit) + ' · ' + tglD(it.date) + ' · ' + esc(it.src) + '</span></div></div><div class="grid3"><div class="field"><label class="tiny">Rendah</label><input class="sm num" id="ml-' + it.key + '" inputmode="numeric" value="' + it.low + '"></div><div class="field"><label class="tiny">Wajar</label><input class="sm num b" id="mt-' + it.key + '" inputmode="numeric" value="' + it.typ + '"></div><div class="field"><label class="tiny">Tinggi</label><input class="sm num" id="mh-' + it.key + '" inputmode="numeric" value="' + it.high + '"></div></div><div class="row"><input class="sm grow" id="ms-' + it.key + '" value="' + esc(it.src) + '" aria-label="Sumber harga"><button class="btn sm ghost" onclick="A.saveMx(\'' + it.key + '\')">Simpan</button></div>')).join('') + '</div>';
}

/* ---------- ADMIN ---------- */
function adminDash() {
  const c = counts(), tot = S.projects.reduce((a, p) => ({ k: a.k + p.summary.contract, rec: a.rec + p.summary.receivable, kas: a.kas + p.summary.kas }), { k: 0, rec: 0, kas: 0 });
  const nb = c.notaAdmin + c.unver;
  return hdrWho() + '<div class="grid">' + kpi('Perlu diperiksa', String(nb), 'nota & laporan foto', nb ? 'bad' : 'ok', "A.tab('bukti')") + kpi('Siap ditagih', sh(readyAmount()), '', 'dark', "A.tab('tagihan')") + kpi('Belum dibayar klien', sh(tot.rec), '', '', "A.tab('tagihan')") + kpi('Kas', sh(tot.kas)) + kpi('Nilai kontrak berjalan', sh(tot.k), S.projects.length + ' proyek') + kpi('Matriks harga', S.matrix ? S.matrix.version : '—', S.matrix ? tglD(S.matrix.date) : '', '', "A.go('harga')") + '</div>' +
    '<div class="row wrap"><button class="btn sm" onclick="A.go(\'penawaran\')">Hitung penawaran baru</button><button class="btn sm ghost" onclick="A.tab(\'proyek\')">Semua proyek</button></div>' +
    '<div class="sect"><h2>Proyek</h2></div><div class="plist">' + S.projects.map((p) => pcard(p, true)).join('') + '</div>' +
    card('<h3>Kejadian terakhir</h3><div class="list">' + S.log.slice(0, 10).map((l) => '<div class="small"><b>' + esc(l.who) + '</b> ' + esc(l.text) + ' <span class="tiny muted2">' + tgl(l.ts) + '</span></div>').join('') + '</div>');
}

/* ---------- MANDOR ---------- */
function mandorHome() {
  const p = P(); if (!p) return hdrTitle('Pagi, ' + S.user.name) + card('Belum ada proyek yang ditugaskan.');
  const ab = S.attendance.filter((a) => a.projectId === p.id && a.ts.slice(0, 10) === today()); const masuk = ab.find((a) => a.type === 'masuk'), pulang = ab.find((a) => a.type === 'pulang');
  const items = S.reports.filter((r) => r.projectId === p.id).map((r) => ({ ts: r.ts, t: 'Laporan · ' + r.items.map((it) => dname(p.divisions[it.div]) + ' ' + it.pct + '%').join(', '), s: r.photos.length + ' foto', pill: r.verified ? pill('Diverifikasi', 'ok') : pill('Menunggu diperiksa', 'warn') }))
    .concat(S.notas.filter((n) => n.projectId === p.id).map((n) => ({ ts: n.ts, t: 'Nota · ' + (n.desc || n.type) + ' ' + rp(n.amount), s: n.note ? 'Alasan: ' + n.note : '', pill: statusPill(n) }))).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15);
  const abCard = masuk ? '<div class="card ' + (masuk.onSite ? 'ok' : 'warn') + '" style="border-radius:24px;padding:18px"><span class="small b" style="opacity:.85">Absensi saya</span><b style="font-size:22px;line-height:1.2">✓ Masuk ' + jam(masuk.ts) + (masuk.onSite ? ' di lokasi' : ' — ' + (masuk.distM == null ? 'tanpa GPS' : masuk.distM + ' m dari proyek')) + '</b><span class="small" style="opacity:.85">' + (masuk.workers ? masuk.workers + ' tukang hadir' : '') + (pulang ? ' · pulang ' + jam(pulang.ts) : '') + '</span>' + (!pulang ? '<button class="btn white" onclick="A.go(\'absen\')">Absen pulang</button>' : '') + '</div>'
    : '<div class="card dark" style="border-radius:24px;padding:18px"><span class="small b" style="color:#A9C7B8">Absensi saya</span><b style="font-size:22px;line-height:1.2">Belum absen hari ini</b><span class="small" style="color:#A9C7B8">Selfie + lokasi. Lapor progres baru bisa setelah absen di lokasi.</span><button class="btn lime" onclick="A.go(\'absen\')">Absen masuk sekarang</button></div>';
  return hdrTitle('Pagi, ' + S.user.name.replace(/^Pak |^Bu /, ''), esc(hariIni()), pill(p.name, 'warn')) + abCard +
    (API.canUpload() ? '' : card('<b>Kirim foto belum aktif</b><span class="small">Minta Owner memberi akun ini akses "dapat mengedit".</span>', 'warn')) +
    '<div class="tiles"><button class="tile lime" onclick="A.go(\'lapor\')">' + I.cam + '<span class="col" style="gap:0"><b class="l">Lapor progres</b><span class="s">foto pekerjaan hari ini</span></span></button><button class="tile" onclick="A.go(\'nota\')">' + I.nota + '<span class="col" style="gap:0"><b class="l">Kirim nota</b><span class="s">belanja & upah</span></span></button></div>' +
    card('<b style="font-size:15px">Kiriman saya</b><div class="list">' + (items.length ? items.map((x) => '<div class="row between"><span class="col grow" style="gap:0"><b class="small">' + esc(x.t) + '</b><span class="tiny muted">' + tgl(x.ts) + (x.s ? ' · ' + esc(x.s) : '') + '</span></span>' + x.pill + '</div>').join('') : '<span class="muted small">Belum ada kiriman.</span>') + '</div>') +
    '<div class="note">' + I.lock + '<span>Akun mandor hanya untuk absen, lapor progres, dan kirim nota proyek ' + esc(p.name) + '.</span></div>';
}
function absenView() {
  const p = P(); const ab = S.attendance.filter((a) => a.projectId === p.id && a.ts.slice(0, 10) === today()); const type = ab.some((a) => a.type === 'masuk') ? 'pulang' : 'masuk';
  return hdrTitle('Absen ' + type, esc(p.name)) + card('<b>1 · Selfie di lokasi proyek</b>' + (sel.selfieUrl ? '<img class="photo" src="' + sel.selfieUrl + '" alt="Selfie">' : '') + photoBtn(sel.selfieUrl ? 'Ulangi selfie' : 'Ambil selfie', "A.pickOne(this,'selfie')", { capture: 'user' }) +
    (type === 'masuk' ? '<div class="field"><label>2 · Jumlah tukang hadir hari ini</label><input data-k="workers" oninput="A.f(this)" type="number" inputmode="numeric" min="0" placeholder="mis. 14" value="' + esc(sel.form.workers || '') + '"></div>' : '') +
    '<span class="small muted">Lokasi GPS diambil otomatis. Kalau HP bertanya, pilih "Izinkan".</span><button class="btn lime full" onclick="A.absen(\'' + type + '\')"' + (sel.selfie ? '' : ' disabled') + '>Kirim absen</button>' + (sel.selfie ? '' : '<span class="tiny muted" style="text-align:center">Ambil selfie dulu untuk mengaktifkan tombol kirim.</span>'));
}
function laporView() {
  const p = P(); sel.prog = sel.prog || {};
  const idx = p.divisions.map((d, i) => i), running = idx.filter((i) => { const d = p.divisions[i]; return (d.progress > 0 && d.progress < 100) || sel.prog[i] != null; });
  const firstTodo = idx.find((i) => p.divisions[i].progress === 0); if (firstTodo != null && !running.includes(firstTodo)) running.push(firstTodo);
  const shown = sel.allDiv || !running.length ? idx : running, hidden = idx.length - shown.length;
  const files = sel.lfiles || [];
  const urls = (sel.lurls = files.map((f, i) => (sel.lurls && sel.lurls[i] && sel.lurls[i].f === f) ? sel.lurls[i] : { f, u: window.URL.createObjectURL(f) }));
  return hdrTitle('Lapor progres', esc(p.name)) +
    card('<b>1 · Pekerjaan yang dikerjakan</b><span class="tiny muted">Tekan + atau − sesuai keadaan di lapangan.</span><div class="list">' + shown.map((i) => { const d = p.divisions[i], v = sel.prog[i] != null ? sel.prog[i] : d.progress; return '<div class="row between"><div class="col grow" style="gap:0"><b>' + esc(dname(d)) + '</b><span class="tiny muted">sebelumnya ' + d.progress + '%</span></div><div class="stepper"><button aria-label="Kurangi" onclick="A.step(' + i + ',-5)">−</button><b' + (v !== d.progress ? ' style="color:var(--ok)"' : '') + '>' + v + '%</b><button aria-label="Tambah" onclick="A.step(' + i + ',5)">+</button></div></div>'; }).join('') + '</div>' + (hidden > 0 || sel.allDiv ? '<button class="link" onclick="A.toggleAllDiv()">' + (sel.allDiv ? 'Tampilkan yang sedang dikerjakan saja' : 'Pekerjaan lain (' + hidden + ')') + '</button>' : '')) +
    card('<b>2 · Foto hasil pekerjaan</b><span class="tiny muted">Wajib minimal 1, paling banyak 8 foto.</span>' + (urls.length ? '<div class="thumbs">' + urls.map((x, i) => '<span class="pthumb"><img src="' + x.u + '" alt="Foto ' + (i + 1) + '"><button aria-label="Hapus foto" onclick="A.delPhoto(' + i + ')">×</button></span>').join('') + '</div>' : '') + (files.length < 8 ? photoBtn(files.length ? 'Tambah foto' : 'Ambil foto', 'A.addPhotos(this)', { capture: 'environment', multiple: true }) : '')) +
    card('<b>3 · Catatan (boleh kosong)</b><textarea data-k="catatan" oninput="A.f(this)" placeholder="mis. hujan 2 jam, semen habis">' + esc(sel.form.catatan || '') + '</textarea><button class="btn full" onclick="A.lapor()">Kirim laporan</button>');
}
function notaView() {
  const types = [['material', 'Material'], ['readymix', 'Tiket ready mix'], ['upah', 'Upah tukang'], ['sewa', 'Sewa alat'], ['lain', 'Lain-lain']]; sel.ntype = sel.ntype || 'material'; const F = sel.form;
  if (sel.ntype === 'readymix') { const p = P(), mutus = (p.mutus && p.mutus.length ? p.mutus : []).concat(Object.keys(BETON.MUTU).filter((m) => !(p.mutus || []).includes(m))); return hdrTitle('Tiket ready mix', 'Foto tiket dari sopir truk, isi angkanya') +
    card('<b>1 · Jenis</b><div class="chips">' + types.map((t) => '<button class="chip ' + (sel.ntype === t[0] ? 'on' : '') + '" onclick="A.setNType(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>') +
    card('<b>2 · Foto tiket</b>' + (sel.nfileUrl ? '<img class="photo" src="' + sel.nfileUrl + '" alt="Tiket">' : '') + photoBtn(sel.nfileUrl ? 'Foto ulang' : 'Foto tiket', "A.pickOne(this,'nfile')", { capture: 'environment' })) +
    card('<b>3 · Isi dari tiket</b><div class="field"><label>Mutu beton di tiket</label><select data-k="rmMutu" onchange="A.f(this)">' + mutus.map((m) => '<option' + ((F.rmMutu || mutus[0]) === m ? ' selected' : '') + '>' + m + '</option>').join('') + '</select>' + ((p.mutus || []).length ? '<span class="tiny muted">Rencana di RAB: ' + p.mutus.join(', ') + '</span>' : '') + '</div>' + field('Volume (m³)', 'rmVol', '', { attrs: 'inputmode="decimal" placeholder="mis. 7"' }) + '<div class="grid">' + field('Jam keluar batching plant', 'rmOut', '', { attrs: 'type="time"' }) + field('Jam tiba di lokasi', 'rmArrive', new Date().toTimeString().slice(0, 5), { attrs: 'type="time"' }) + '</div>' + field('Slump (cm, kalau diuji)', 'rmSlump', '', { attrs: 'inputmode="decimal" placeholder="mis. 12"' }) + field('Batching plant', 'shop', '', { attrs: 'placeholder="mis. Ready mix Cikarang"' }) + field('Nominal (isi kalau dibayar di lokasi)', 'amount', '', { attrs: 'inputmode="numeric"' }) + '<span class="tiny muted">Beton yang lebih dari 90 menit di jalan atau mutunya berbeda dari rencana: jangan dicor sebelum ada izin.</span><button class="btn full" onclick="A.nota()">Kirim tiket</button>'); }
  return hdrTitle('Kirim nota', 'Foto nota, isi nominal, Admin yang memeriksa') +
    card('<b>1 · Jenis</b><div class="chips">' + types.map((t) => '<button class="chip ' + (sel.ntype === t[0] ? 'on' : '') + '" onclick="A.setNType(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>') +
    card('<b>2 · Foto nota</b>' + (sel.nfileUrl ? '<img class="photo" src="' + sel.nfileUrl + '" alt="Nota">' : '') + photoBtn(sel.nfileUrl ? 'Foto ulang' : 'Foto nota', "A.pickOne(this,'nfile')", { capture: 'environment' })) +
    card('<b>3 · Isi</b>' + field('Barang / keterangan', 'desc', '', { attrs: 'placeholder="mis. Semen 50 kg"' }) +
      (sel.ntype === 'material' ? '<div class="field"><label>Jenis barang (supaya bisa dibandingkan harga pasar)</label><select data-k="ukey" onchange="A.f(this)"><option value="">— pilih —</option>' + S.catalog.map((c) => '<option value="' + c.key + '"' + (F.ukey === c.key ? ' selected' : '') + '>' + esc(c.name) + ' (per ' + esc(c.unit) + ')</option>').join('') + '</select></div>' + field('Jumlah (sesuai satuan di atas)', 'qty', '', { attrs: 'type="number" inputmode="decimal" placeholder="mis. 120"' }) : '') +
      field('Toko / penerima', 'shop', '') + field('Total nominal (Rp)', 'amount', '', { attrs: 'inputmode="numeric" placeholder="mis. 11040000"' }) + '<button class="btn full" onclick="A.nota()">Kirim ke Admin</button>');
}
function sentView() {
  const s = sel.sent || { title: 'Terkirim', sub: '' };
  return '<div class="sent ' + (s.kind === 'warn' ? 'warn' : '') + '">' + I.ok + '<h1>' + esc(s.title) + '</h1><span>' + esc(s.sub) + '</span></div><button class="btn full" onclick="A.tab(\'home\')">Kembali ke Beranda</button>';
}

/* ---------- render ---------- */
function render() {
  if (booting) { app.innerHTML = '<div class="center muted">Memuat Buku Proyek…</div>'; return; }
  if (bootError) { app.innerHTML = '<div class="center"><div class="card" style="max-width:420px"><h2>Tidak bisa memuat</h2><span class="small muted">' + esc(bootError) + '</span></div></div>'; return; }
  if (!S || !S.user) { app.innerHTML = loginView(); return; }
  const role = S.user.role, c = counts(); let body, nav;
  const shared = { struktur: strukturView, interior: interiorView, proyek: projectsView, detail: projectView, bukti: buktiView, tagihan: tagihanView, laporan: laporanView, penawaran: penawaranView, rab: rabView, tambahkurang: voView, harga: matrixView, menu: menuView };
  if (role === 'mandor') {
    nav = navBar([['home', I.home, [], 'Beranda'], ['absen', I.user, [], 'Absen'], ['nota', I.nota, [], 'Nota'], ['menu', I.menu, [], 'Menu']], ['lapor', I.cam, 'Lapor progres']);
    body = { home: mandorHome, absen: absenView, lapor: laporView, nota: notaView, menu: menuView, terkirim: sentView }[view] || mandorHome;
    app.innerHTML = '<div class="shell"><main class="page">' + body() + '</main>' + nav + '</div>'; return;
  }
  const nb = buktiCount();
  nav = navBar([['home', I.home, [], role === 'admin' ? 'Dasbor' : 'Beranda'], ['proyek', I.proj, ['detail', 'rab', 'tambahkurang', 'struktur', 'interior'], 'Proyek'], ['tagihan', I.bill, [], 'Tagihan'], ['menu', I.menu, ['penawaran', 'laporan', 'harga'], 'Menu']], ['bukti', I.shield, 'Cek bukti', nb]);
  body = Object.assign({ home: role === 'admin' ? adminDash : ownerHome }, shared)[view] || (role === 'admin' ? adminDash : ownerHome);
  if (role === 'admin') {
    const SECS = [['home', 'Dasbor', I.dash, 0, []], ['bukti', 'Cek bukti', small(I.shield), nb, []], ['proyek', 'Proyek', I.proj, c.risk, ['detail', 'rab', 'tambahkurang', 'struktur', 'interior']], ['tagihan', 'Tagihan', I.bill, 0, []], ['laporan', 'Laporan', small(I.chart), 0, []], ['penawaran', 'Konsultan Penawaran', small(I.calc), 0, []], ['harga', 'Matriks harga', I.tag, 0, []], ['menu', 'Pengaturan', I.user, 0, []]];
    const side = '<nav class="side"><div class="brand"><span class="logo">BP</span><span class="col" style="gap:0"><b style="font-size:15px">Buku Proyek</b><span class="tiny" style="color:#A9C7B8">Admin – Finance</span></span></div>' + SECS.map((x) => '<button class="' + (view === x[0] || x[4].includes(view) ? 'on' : '') + '" onclick="A.tab(\'' + x[0] + '\')"><span class="row">' + x[2] + esc(x[1]) + '</span>' + (x[3] ? '<span class="sbadge">' + x[3] + '</span>' : '') + '</button>').join('') + '<div class="me"><span class="tiny" style="color:#A9C7B8">Masuk sebagai</span><div class="mecard"><span class="avatar" style="width:32px;height:32px;font-size:12px;background:#E7ECFF;color:#2A3FB0">' + initials(S.user.name) + '</span><span class="col" style="gap:0"><b class="small">' + esc(S.user.name) + '</b><span class="tiny" style="color:#A9C7B8">Admin – Finance</span></span></div></div></nav>';
    app.innerHTML = '<div class="shell desk">' + side + '<main class="page">' + body() + '</main>' + nav + '</div>'; return;
  }
  app.innerHTML = '<div class="shell"><main class="page">' + body() + '</main>' + nav + '</div>';
}
(async () => {
  const b = document.createElement('div'); b.id = 'busy'; b.hidden = true; b.setAttribute('role', 'status'); document.body.appendChild(b);
  render();
  try { const r = await API.init(); if (r && r.error) bootError = r.error; else { const u = await API.me(); if (u) { S = await API.state(); sel.pid = S.projects[0] && S.projects[0].id; } else if (API.kind === 'artifact') S = await API.state().catch(() => null); } } catch (e) { bootError = e.message; }
  booting = false; render();
})();
