/* Konsultan Penawaran — 6 pertanyaan → harga aman, kesanggupan kas, syarat kontrak. Dipakai app.js (view 'penawaran').
   Angka di dalam hitungan memakai satuan juta rupiah, sama dengan mockup. */
'use strict';
window.KONSULTAN = (() => {
  // Biaya langsung arsitektur + listrik/air per m² (juta). Struktur dihitung terpisah dari rincian beton per elemen (beton.js).
  // Dikalibrasi Okt 2026 ke RAB contoh (ruko 240 m² ≈ Rp 4,95 Jt/m²) dan proyek lama di mockup (ruko 4,6–4,9 · rumah 5,4–5,6 · gudang 3,1 · kos 4,3).
  const BASE = { rumah: { sederhana: 1.4, menengah: 2.1, mewah: 4.1 }, ruko: { sederhana: 1.35, menengah: 1.8, mewah: 3.4 }, gudang: { sederhana: 0.85, menengah: 1.1, mewah: 1.6 }, kos: { sederhana: 1.4, menengah: 1.65, mewah: 2.8 } };
  // volume beton relatif terhadap ruko/rumah (gudang: atap baja, kolom jarang)
  const STRV = { rumah: 0.85, ruko: 1, gudang: 0.6, kos: 1 };
  // harga pasar ke klien per m² (juta, belum PPN), bangun baru, struktur + arsitektur + listrik/air
  const PASAR = { rumah: { sederhana: [3.8, 4.8], menengah: [4.8, 6.2], mewah: [7, 10] }, ruko: { sederhana: [3.6, 4.6], menengah: [4.4, 5.6], mewah: [6, 8] }, gudang: { sederhana: [2.4, 3.2], menengah: [2.8, 3.8], mewah: [3.5, 4.8] }, kos: { sederhana: [3.6, 4.6], menengah: [4.2, 5.4], mewah: [5.5, 7] } };
  const SCOPES = [['struktur', 'Struktur', 'Pondasi, kolom, balok, plat', 0], ['arsitektur', 'Arsitektur', 'Dinding, atap, kusen, lantai, cat', 0.8], ['mep', 'Listrik & air', 'Instalasi listrik, pipa, sanitasi', 0.2], ['interior', 'Interior', 'Kitchen set, lemari, wallpaper', 0.6]];
  const WORKS = [['persiapan', 'Persiapan & bongkar', 'struktur', 0.06, 'ls', 0.3], ['pondasi', 'Tanah & pondasi', 'struktur', 0.27, 'm³', 0.55], ['struktur', 'Struktur beton', 'struktur', 0.67, 'm³', 0.6], ['dinding', 'Dinding & plester', 'arsitektur', 0.27, 'm²', 0.5], ['atap', 'Atap', 'arsitektur', 0.18, 'm²', 0.65], ['kusen', 'Pintu & jendela', 'arsitektur', 0.16, 'unit', 0.75], ['lantai', 'Lantai', 'arsitektur', 0.21, 'm²', 0.7], ['finish', 'Plafon & cat', 'arsitektur', 0.18, 'm²', 0.5], ['mep', 'Listrik & air', 'mep', 1.0, 'titik', 0.6], ['kitchen', 'Kitchen set & lemari', 'interior', 0.55, 'm lari', 0.7], ['dekor', 'Wallpaper & dekor', 'interior', 0.45, 'm²', 0.6]];
  const TANAH = { keras: ['Tanah keras', 'Pondasi batu kali / foot plat biasa', 1.0, 'normal', 0], sedang: ['Tanah sedang', 'Pondasi diperbesar', 1.2, '+20% pondasi', 1], lunak: ['Tanah lunak / bekas sawah', 'Perlu tiang pancang atau bore pile', 1.7, '+70% pondasi', 3] };
  const AKSES = { mudah: ['Truk bisa masuk', 'Material langsung turun di lokasi', 1.0, 'normal', 0], sempit: ['Jalan sempit', 'Mobil kecil, bongkar muat 2 kali', 1.04, '+4%', 1], pikul: ['Gang, dipikul manual', 'Diangkut tenaga orang', 1.08, '+8%', 2] };
  const WAKTU = { normal: ['Waktu normal', 'Jadwal biasa', 1.0, 'normal', 0], cepat: ['Dikejar waktu', 'Lembur, tukang tambahan', 1.03, '+3%', 1] };
  const KAT = {
    baru: ['Bangun baru', 'Dari tanah kosong sampai serah terima', 1.0, 0, ['struktur', 'arsitektur', 'mep'], 1, '', 'harga penuh', 'rumah, ruko, kos, gudang baru', { lebar: 5, panjang: 15, lantai: 3 }],
    renov_besar: ['Renovasi besar', 'Ubah struktur, tambah lantai, atau bongkar lebih dari 30%', 0.8, 3, ['struktur', 'arsitektur', 'mep'], 3, 'temuan saat bongkar: kolom keropos, instalasi lama', '×0,8/m² · risiko +3%', 'tambah lantai 2, ubah ruko jadi kantor', { lebar: 8, panjang: 15, lantai: 2 }],
    renov_sedang: ['Renovasi sedang', 'Tambah ruang di bangunan yang sudah ada, mis. tutup void atau tambah kamar di lantai 2', 0.85, 2, ['struktur', 'arsitektur', 'mep'], 1.5, 'menyambung ke struktur lama: kolom & balok lama harus kuat', '×0,85/m² · risiko +2%', 'isi void lantai 2, tambah kamar di atas carport (perumahan)', { lebar: 3, panjang: 4, lantai: 1 }],
    renov_kecil: ['Renovasi kecil', 'Tanpa mengubah struktur', 1.1, 2, ['arsitektur', 'mep'], 2, 'pekerjaan sering melebar dari rencana', 'per m² lebih mahal · risiko +2%', 'dapur, kamar mandi, atap bocor, cat ulang', { lebar: 3, panjang: 6, lantai: 1 }]
  };
  const TUKANG = {
    borongan: ['Borongan', 'Upah per m² atau per paket, disepakati di awal', 1.08, 0, 'harga upah pasti, biasanya ±8% di atas harian', '', '+8% upah · risiko kecil', 'Biaya upah pasti dan risiko lambat ada di tukang. Bayar per opname mingguan, jangan di depan, dan cek kualitas sebelum bayar.'],
    harian: ['Harian', 'Dibayar per hari kerja, dihitung dari absensi', 1.0, 2, 'upah per hari × orang × hari', 'risiko lambat & jumlah orang dilebihkan', 'upah murah · risiko +2%', 'Paling murah kalau tukangnya rajin, tapi risiko lambat ada di Bapak. Wajib absensi dan cek progres mingguan; saya tambah premi 2%.'],
    campuran: ['Campuran', 'Struktur & pasangan borongan, finishing harian', 1.04, 1, 'yang bisa diukur borongan, detail finishing harian', 'sebagian dibayar harian', '+4% upah · risiko +1%', 'Paling umum di lapangan. Cor, pasang bata, plester borongan per m²; detail finishing harian dengan absensi.']
  };
  const KLIEN = { orang: ['Perorangan', 'Bayar dari tabungan; sering telat di termin akhir', 1, 21], swasta: ['Perusahaan swasta', 'Ada proses persetujuan; 30–45 hari', 1, 35], pemerintah: ['Pemerintah / BUMN', 'Pasti bayar, tapi 60–90 hari', 2, 75] };
  const BAYAR = { a: ['UM 20% + bulanan', 0.2, true], b: ['UM 10% + 4 termin', 0.1, false], c: ['Tanpa UM, 4 termin', 0, false] };
  const COR = { manual: ['Aduk manual (molen)', 'Volume kecil, akses sempit. Mutu sulit dijamin di atas K-250.'], talang: ['Ready mix + talang/ember', 'Truk 7 m³ harus bisa merapat ke lokasi.'], pump: ['Ready mix + pompa', 'Paling umum untuk plat & balok lantai atas.'], minimix: ['Minimix (truk kecil)', 'Jalan < 4 m. Lebih mahal ±Rp 350 rb/m³.'] };
  // rangka atap: faktor biaya pekerjaan atap (rangka + penutup), dibanding baja ringan
  const ATAP = { baja: ['Rangka baja ringan', 'Paling umum, cepat dipasang, tahan rayap', 1.0, 'patokan'], kayu: ['Rangka kayu', 'Kayu kelas II (kamper/meranti), perlu anti rayap; harga kayu naik-turun', 1.15, '+15% atap'], dak: ['Dak beton (atap datar)', 'Plat beton + waterproofing, bisa dipakai jemur/tambah lantai nanti', 1.7, '+70% atap'] };
  const INTBY = { semua: ['Kontraktor pasok & pasang semua', 'Kitchen set, lemari, wallpaper, plafon, titik listrik', 1], sipil: ['Kontraktor bagian sipil saja', 'Plafon, cat, titik listrik/air; furnitur oleh vendor pemilik', 0.4], jasa: ['Kontraktor pasang, material dari pemilik', 'Pemilik beli sendiri, kontraktor jasa pasang', 0.35] };
  const LABELS = ['Pertanyaan 1 dari 6 · Kategori', 'Pertanyaan 2 dari 6 · Bangunan', 'Pertanyaan 3 dari 6 · Kelas & lingkup', 'Pertanyaan 4 dari 6 · Lapangan & tukang', 'Pertanyaan 5 dari 6 · Klien', 'Pertanyaan 6 dari 6 · Uang Bapak', 'Keputusan'];
  const defaults = () => ({ step: 1, cor: 'pump', atap: 'baja', interiorBy: 'semua', kategori: 'baru', tukang: 'borongan', type: 'ruko', lebar: 5, panjang: 15, lantai: 3, qual: 'menengah', scope: ['struktur', 'arsitektur', 'mep'], tanah: 'sedang', akses: 'sempit', waktu: 'normal', klien: 'swasta', kenal: 'belum', bayar: 'b', kas: 400, plafon: 500, plafonPakai: 0, bunga: 11, omzet: 8000, detail: false, nama: '' });
  const rpJ = (jt) => { const a = Math.abs(jt); const s = a >= 1000 ? (a / 1000).toFixed(2).replace('.', ',').replace(/,?0+$/, '') + ' M' : a < 10 ? a.toFixed(1).replace('.', ',').replace(/,0$/, '') + ' Jt' : Math.round(a).toLocaleString('id-ID') + ' Jt'; return (jt < 0 ? '−' : '') + 'Rp ' + s; };

  // jenis pekerjaan per lantai: nama, keterangan, lingkup, faktor harga/m², faktor bongkar, faktor pondasi (lantai 1), faktor struktur atas
  const FJ = {
    baru: ['Bangun baru', 'Struktur + dinding, atap, lantai, listrik/air', ['struktur', 'arsitektur', 'mep'], 1, 1, 1, 1],
    struktur: ['Cor / struktur saja', 'Kolom, balok, plat; tanpa finishing', ['struktur'], 1, 1, 1, 1],
    renov_besar: ['Renovasi penuh + tambah struktur', 'Bongkar, tambah kolom/balok untuk naik lantai, finishing ulang', ['struktur', 'arsitektur', 'mep'], 0.8, 3, 0.4, 1],
    renov_sedang: ['Renovasi sedang', 'Tutup void, tambah kamar, sedikit struktur', ['struktur', 'arsitektur', 'mep'], 0.85, 1.5, 0.4, 0.5],
    renov_kecil: ['Renovasi ringan / finishing', 'Lantai, cat, plafon, kamar mandi; tanpa struktur', ['arsitektur', 'mep'], 1.1, 2, 0, 0],
    dak: ['Dak beton (atap datar)', 'Plat + balok atap, waterproofing', ['struktur'], 1, 1, 0, 0.7]
  };
  const jl = (f) => { const a = (Array.isArray(f.jenis) ? f.jenis : [f.jenis]).filter((k) => FJ[k]); return a.length ? a : ['baru']; };
  const newFloor = (i) => ({ lt: i + 1, nama: '', luas: 75, jenis: 'baru', int: false });
  const ltOf = (f, i) => Number(f.lt) || i + 1;  // baris = satu area; beberapa baris boleh di lantai yang sama
  // mode per lantai: luas = jumlah luas tiap lantai, kategori & lingkup diturunkan dari isian lantai
  function norm(s) {
    if (!s.perLantai || !Array.isArray(s.floors) || !s.floors.length) return s;
    const fl = s.floors, js = [].concat(...fl.filter((f) => f.luas > 0).map(jl)), scope = [];
    fl.forEach((f) => { if (f.luas > 0) [].concat(...jl(f).map((k) => FJ[k][2])).concat(f.int ? ['interior'] : []).forEach((k) => { if (!scope.includes(k)) scope.push(k); }); });
    const kategori = js.includes('renov_besar') ? 'renov_besar' : js.includes('renov_sedang') ? 'renov_sedang' : js.length && js.every((j) => j === 'renov_kecil') ? 'renov_kecil' : 'baru';
    return Object.assign({}, s, { lantai: Math.max(...fl.map(ltOf)), scope: scope.length ? scope : ['arsitektur'], kategori });
  }
  let MX = null, LAST = null;
  // ubah isian per lantai dari tampilan (input angka & tombol)
  function fl(i, k, v) {
    const f = (LAST.floors || []).map((x, n) => Object.assign({}, x, { lt: ltOf(x, n) }));
    if (k === 'add') { const top = f.length ? Math.max(...f.map((x) => x.lt)) : 0, last = f.filter((x) => x.lt === top).reduce((a, x) => a + (Number(x.luas) || 0), 0); f.push(Object.assign(newFloor(top), { luas: last || 75, jenis: f.length ? 'dak' : 'baru' })); }
    else if (k === 'seg') { const at = f.reduce((a, x, n) => (x.lt === v ? n : a), f.length - 1); f.splice(at + 1, 0, Object.assign(newFloor(v - 1), { luas: 10, jenis: ['struktur'] })); }
    else if (k === 'del') f.splice(i, 1);
    else if (k === 'tog' && f[i]) { const MAIN = ['baru', 'renov_besar', 'renov_sedang', 'renov_kecil']; let a = jl(f[i]); if (a.includes(v)) a = a.filter((x) => x !== v); else a = (MAIN.includes(v) ? a.filter((x) => !MAIN.includes(x)) : a).concat([v]); if (!a.length) return; f[i].jenis = a; }
    else if (f[i]) f[i][k] = k === 'luas' ? Math.max(0, Math.min(5000, Math.round(Number(String(v).replace(',', '.')) || 0))) : k === 'nama' ? String(v).slice(0, 40) : v;
    if (k === 'del') { const used = Array.from(new Set(f.map((x) => x.lt))).sort((a, b) => a - b); f.forEach((x) => { x.lt = used.indexOf(x.lt) + 1; }); }  // rapikan nomor lantai setelah hapus
    KONSULTAN.set({ floors: f });
  }
  // biaya struktur dari rincian beton per elemen (juta): bawah = pondasi + sloof + lantai kerja, atas = kolom, balok, plat, praktis
  function strukturCost(s, area) {
    const out = { bawah: 0, atas: 0, galian: 0, volBawah: 0, volAtas: 0, mutu: s.lantai >= 3 ? 'K-300' : 'K-250', kf: KAT[s.kategori][2] };
    if (typeof BETON === 'undefined') { out.atas = area * 1.2; out.bawah = area * 0.4; return out; }
    const P = BETON.prices(MX), vpc = Math.max(5, area * 0.22 / Math.max(1, s.lantai * 2)), ctx = { lantai: s.lantai, volPerCor: vpc };
    const f = (STRV[s.type] || 1) * (s.lantai === 1 ? 0.75 : 1);  // 1 lantai: tanpa plat atas
    BETON.defaults(area, s.lantai, s.cor).forEach((e) => {
      let r = BETON.element(e, P, ctx);
      if (!r.ok) r = BETON.element(Object.assign({}, e, { mutu: 'K-250' }), P, ctx);  // aduk manual tak sanggup mutu tinggi: hitung K-250, risikonya ditulis terpisah
      const bawah = ['pondasi', 'sloof', 'kerja'].includes(e.el);
      out[bawah ? 'bawah' : 'atas'] += r.total / 1e6 * f; out[bawah ? 'volBawah' : 'volAtas'] += e.vol * f;
    });
    out.galian = area / s.lantai * 0.3 * (STRV[s.type] || 1);  // galian, urugan, pemadatan per m² tapak
    out.volBawah = Math.round(out.volBawah); out.volAtas = Math.round(out.volAtas);
    return out;
  }

  function calc(s0) {
    const s = norm(s0), area = s.perLantai && s.floors && s.floors.length ? Math.max(1, s.floors.reduce((a, f) => a + (Number(f.luas) || 0), 0)) : s.lebar * s.panjang * s.lantai, rate = BASE[s.type][s.qual] * KAT[s.kategori][2], gm = AKSES[s.akses][2] * WAKTU[s.waktu][2];
    const scopeOn = (k) => s.scope.indexOf(k) >= 0, tk = (ms) => ms + (1 - ms) * TUKANG[s.tukang][2];
    const st = strukturCost(s, area);
    const VOL = { persiapan: '1 ls', pondasi: st.volBawah + ' m³ beton + galian', struktur: st.volAtas + ' m³ beton', dinding: Math.round(area * 2.0) + ' m² dinding', atap: Math.round(area / s.lantai * 1.15) + ' m² atap', kusen: Math.round(area / 12) + ' unit', lantai: Math.round(area * 0.95) + ' m² lantai', finish: Math.round(area * 0.95) + ' m² plafon', mep: Math.round(area / 6) + ' titik', kitchen: Math.round(area / 25) + ' m lari', dekor: Math.round(area * 0.6) + ' m²' };
    let works = WORKS.filter((x) => scopeOn(x[2])).map((x) => {
      let m = gm * tk(x[5]), flag = '', v, extra = {};
      if (x[0] === 'persiapan') { v = area * 0.1; if (KAT[s.kategori][5] > 1) { m *= KAT[s.kategori][5]; flag = 'bongkar ×' + String(KAT[s.kategori][5]).replace('.', ','); } }
      else if (x[0] === 'pondasi') { v = (st.galian + st.bawah) * TANAH[s.tanah][2] * st.kf; extra.galian = st.galian * TANAH[s.tanah][2] * st.kf * m; flag = s.tanah === 'keras' ? '' : TANAH[s.tanah][3]; if (s.kategori === 'renov_sedang') { m *= 0.4; extra.galian *= 0.4; flag = 'perkuatan kolom/pondasi lama'; } }
      else if (x[0] === 'struktur') { v = st.atas * st.kf; flag = 'dari rincian per elemen · ' + st.mutu + ', ' + COR[s.cor][0].toLowerCase(); }
      else { const sc = SCOPES.find((z) => z[0] === x[2]); v = area * rate * sc[3] * x[3]; if (x[0] === 'atap') { const A = ATAP[s.atap] || ATAP.baja; m *= A[2]; flag = A[0].toLowerCase(); } }
      if (x[2] === 'interior') { const f = s.interiorBy === 'sipil' ? (x[0] === 'kitchen' ? 0 : 0.6) : INTBY[s.interiorBy][2]; m *= f; if (f < 1) flag = INTBY[s.interiorBy][0].toLowerCase(); }
      return Object.assign({ key: x[0], label: x[0] === 'persiapan' && s.kategori !== 'baru' ? 'Bongkar & persiapan' : x[1], v: v * m, flag, vol: VOL[x[0]], matShare: x[5] }, extra);
    });
    let floorsOut = null;
    if (s.perLantai && s.floors && s.floors.length) {
      // per lantai: harga struktur per m² dari bangunan utuh, lalu dikalikan luas & jenis pekerjaan tiap lantai
      const base0 = BASE[s.type][s.qual], foot = Math.max(1, s.floors.reduce((a, f, i) => a + (ltOf(f, i) === 1 ? Number(f.luas) || 0 : 0), 0) || area / s.lantai), atasM2 = st.atas / area, bawahM2 = (st.bawah + st.galian) / (area / s.lantai), galM2 = st.galian / (area / s.lantai);
      const acc = {}, add = (key, label, v, matShare, lt, extra) => { if (v <= 0) return; const w = acc[key] || (acc[key] = { key, label, v: 0, flag: '', lts: [], vol: VOL[key] || '1 ls', matShare }); w.v += v; if (!w.lts.includes(lt)) w.lts.push(lt); if (extra) w.galian = (w.galian || 0) + extra; };
      const topLt = s.floors.reduce((a, f, i) => (Number(f.luas) > 0 ? Math.max(a, ltOf(f, i)) : a), 0);  // atap genteng hanya di lantai teratas (dak = tanpa atap genteng)
      floorsOut = s.floors.map((f, i) => {
        const LT = ltOf(f, i), js = jl(f), Js = js.map((k) => FJ[k]), L = Number(f.luas) || 0, lt = 'Lt ' + LT, nm = js.map((k) => FJ[k][0]).join(' + '); let sum = 0;
        if (L <= 0) return { n: LT, nama: f.nama || '', jenis: nm, luas: 0, v: 0, int: false };
        const put = (key, label, v, ms, extra) => { const val = v * gm * tk(ms); add(key, label, val, ms, lt, extra != null ? extra * gm * tk(ms) : null); sum += val; };
        const hasStr = Js.some((J) => J[2].includes('struktur')), bongkar = Math.max(...Js.map((J) => J[4])), dak = js.includes('dak');
        if (hasStr || bongkar > 1) put('persiapan', js.some((k) => k.indexOf('renov') === 0) ? 'Bongkar & persiapan' : 'Persiapan', L * 0.1 * bongkar, 0.3);
        if (hasStr) {
          const pf = LT === 1 ? Math.max(...Js.map((J) => (J[2].includes('struktur') ? J[5] : 0))) : js.includes('renov_besar') ? 0.25 : 0;  // lantai atas yang ditambah struktur: perkuatan kolom/pondasi lama
          if (pf) put('pondasi', 'Tanah & pondasi', Math.min(L, foot) * bawahM2 * TANAH[s.tanah][2] * pf, 0.55, LT === 1 && pf === 1 ? Math.min(L, foot) * galM2 * TANAH[s.tanah][2] : 0);
          const atas = Math.max(0, ...js.filter((k) => k !== 'dak').map((k) => FJ[k][6] * FJ[k][3]));  // kolom/balok lantai ini: ambil pekerjaan terberat, tidak dijumlah
          if (atas) put('struktur', 'Struktur beton', L * atasM2 * atas, 0.6);
          if (dak) { put('struktur', 'Struktur beton', L * atasM2 * FJ.dak[6], 0.6); put('waterproof', 'Waterproofing dak + screed', L * 0.22, 0.6); }
        }
        const main = ['baru', 'renov_besar', 'renov_sedang', 'renov_kecil'].find((k) => js.includes(k)), J = main ? FJ[main] : null;
        if (J) WORKS.filter((x) => J[2].includes(x[2]) && x[2] !== 'struktur').forEach((x) => { const sc = SCOPES.find((z) => z[0] === x[2]); let m = 1; if (x[0] === 'atap') { if (LT !== topLt || dak) return; m *= (ATAP[s.atap] || ATAP.baja)[2] * 2; } put(x[0], x[1], L * base0 * J[3] * sc[3] * x[3] * m, x[5]); });
        if (f.int) WORKS.filter((x) => x[2] === 'interior').forEach((x) => { const fi = s.interiorBy === 'sipil' ? (x[0] === 'kitchen' ? 0 : 0.6) : INTBY[s.interiorBy][2]; put(x[0], x[1], L * base0 * 0.6 * x[3] * fi, x[5]); });
        return { n: LT, nama: f.nama || '', jenis: nm, luas: L, v: sum, int: !!f.int };
      });
      const order = ['persiapan', 'pondasi', 'struktur', 'waterproof'].concat(WORKS.map((x) => x[0]).filter((k) => ['persiapan', 'pondasi', 'struktur'].indexOf(k) < 0));
      works = order.filter((k) => acc[k]).map((k) => Object.assign(acc[k], { flag: acc[k].lts.join(', ') + (k === 'pondasi' && s.tanah !== 'keras' ? ' · ' + TANAH[s.tanah][3] : '') + (k === 'atap' ? ' · ' + (ATAP[s.atap] || ATAP.baja)[0].toLowerCase() : '') }));
      if (!works.length) works = [{ key: 'mob', label: 'Belum ada lantai yang dikerjakan', v: 0.01, flag: '', vol: '', matShare: 0.5 }];
    }
    if (s.kategori === 'renov_kecil') works.unshift({ key: 'mob', label: 'Mobilisasi & kebersihan', v: 5, flag: 'biaya tetap proyek kecil', vol: '1 ls', matShare: 0.2 });
    const laborSum = works.reduce((a, x) => a + x.v * (1 - x.matShare), 0), direct = works.reduce((a, x) => a + x.v, 0) || 1;
    const BASE_M = 10, prem = [];
    if (KAT[s.kategori][3]) prem.push([KAT[s.kategori][0], KAT[s.kategori][3], KAT[s.kategori][6]]);
    if (TUKANG[s.tukang][3]) prem.push(['Tukang ' + TUKANG[s.tukang][0].toLowerCase(), TUKANG[s.tukang][3], TUKANG[s.tukang][5]]);
    if (TANAH[s.tanah][4]) prem.push(['Tanah ' + s.tanah, TANAH[s.tanah][4], 'pondasi sering meleset dari rencana']);
    if (AKSES[s.akses][4]) prem.push(['Akses ' + s.akses, AKSES[s.akses][4], 'ongkos angkut dan waktu bongkar muat']);
    if (s.atap === 'kayu' && scopeOn('arsitektur')) prem.push(['Rangka atap kayu', 1, 'harga kayu naik-turun, risiko rayap & melendut']);
    if (WAKTU[s.waktu][4]) prem.push(['Dikejar waktu', 1, 'lembur dan tukang tambahan']);
    if (s.qual === 'mewah') prem.push(['Kelas mewah', 2, 'material impor, harga gampang berubah']);
    if (s.klien === 'pemerintah') prem.push(['Klien pemerintah/BUMN', 2, 'pembayaran 60–90 hari']);
    if (s.klien === 'orang') prem.push(['Klien perorangan', 1, 'risiko telat di termin akhir']);
    if (s.kenal === 'belum') prem.push(['Belum pernah kerja bareng', 1, 'belum tahu kebiasaan bayarnya']);
    if (scopeOn('interior')) prem.push(['Ada interior', 1, 'selera klien sering berubah di tengah']);
    if (scopeOn('interior') && s.interiorBy !== 'semua') prem.push(['Interior dibagi dengan pihak lain', 1, 'pekerjaan bisa saling tunggu atau jatuh di tengah']);
    const premSum = prem.reduce((a, x) => a + x[1], 0), risiko = 5 + Math.min(10, premSum), oh = 0.05, PPH = 0.0265;
    const base = direct * (1 + risiko / 100 + oh), SC = BAYAR[s.bayar];
    const model = (Pr) => { const N = Math.max(s.kategori === 'baru' ? 4 : s.kategori === 'renov_kecil' ? 1 : 2, Math.round(area / (s.kategori === 'baru' ? 60 : 40))), r = s.bunga / 100 / 12, wts = []; let sw = 0; for (let t = 1; t <= N; t++) { const x = Math.sin(Math.PI * (t - 0.5) / N); wts.push(x); sw += x; } const H = N + 7, cost = new Array(H + 1).fill(0), recv = new Array(H + 1).fill(0); let cum = 0; const cums = [0]; for (let t = 1; t <= N; t++) { cost[t] = base * wts[t - 1] / sw; cum += wts[t - 1] / sw; cums.push(cum); } const lag = Math.max(1, Math.round(KLIEN[s.klien][3] / 30)); recv[0] += SC[1] * Pr * (1 - PPH); const body = (1 - SC[1] - 0.05) * Pr * (1 - PPH); if (SC[2]) { for (let t = 1; t <= N; t++) recv[Math.min(H, t + lag)] += (cums[t] - cums[t - 1]) * body; } else { [0.25, 0.5, 0.75, 1].forEach((ms) => { let mm = 1; while (mm < N && cums[mm] < ms - 1e-9) mm++; recv[Math.min(H, mm + lag)] += body / 4; }); } recv[Math.min(H, N + 6)] += 0.05 * Pr * (1 - PPH); let B = 0, I = 0, pk = 0, pkM = 0; const bal = []; for (let t = 0; t <= H; t++) { B += recv[t] - cost[t]; const it = B < 0 ? -B * r : 0; I += it; B -= it; if (-B > pk) { pk = -B; pkM = t; } bal.push(B); } return { I, peak: pk, peakM: pkM, bal, N }; };
    const priceAt = (mPct) => { let Pr = base / (1 - PPH - mPct / 100), md; for (let i = 0; i < 6; i++) { md = model(Pr); Pr = (base + md.I) / (1 - PPH - mPct / 100); } return { Pr, md: model(Pr) }; };
    const safe = priceAt(BASE_M + Math.min(6, premSum)), target = priceAt(BASE_M + Math.min(3, Math.round(premSum / 2))), compete = priceAt(BASE_M - 3);
    const floorP = (base + target.md.I) / (1 - PPH);
    const labaOf = (x) => x.Pr - base - x.md.I - x.Pr * PPH, pctOf = (x) => (labaOf(x) / x.Pr * 100).toFixed(1).replace('.', ',') + '%';
    const plafonSisa = Math.max(0, s.plafon - s.plafonPakai), capacity = s.kas + plafonSisa, peak = target.md.peak, capRatio = peak / Math.max(1, capacity);
    const cap = capRatio <= 0.6 ? ['Masuk kemampuan Bapak', 'Kebutuhan puncak ' + Math.round(capRatio * 100) + '% dari kas + plafon. Masih ada ruang untuk proyek lain.', 'ok'] : capRatio <= 1 ? ['Sanggup, tapi mepet', 'Kebutuhan puncak ' + Math.round(capRatio * 100) + '% dari kas + plafon. Satu klien telat bayar, Bapak kehabisan uang. Minta UM lebih besar.', 'warn'] : ['Di luar kemampuan', 'Kebutuhan puncak ' + rpJ(peak) + ' melebihi kas + plafon ' + rpJ(capacity) + '. Minta UM 20–30%, tagih bulanan, atau kerjakan bertahap.', 'bad'];
    const conc = target.Pr / Math.max(1, s.omzet), risks = [];
    if (s.tanah === 'lunak') risks.push(['Pondasi meleset', 'Tanah lunak: biaya pondasi bisa 2× rencana. Minta sondir dulu sebelum tanda tangan.', 'Besar', 'bad']);
    if (s.klien === 'pemerintah') risks.push(['Pembayaran 60–90 hari', 'Bunga modal naik ' + rpJ(target.md.I) + '. Sudah dimasukkan ke harga, tapi kas harus kuat.', 'Besar', 'bad']);
    if (capRatio > 0.6) risks.push(['Kehabisan kas di bulan ke-' + target.md.peakM, 'Butuh ' + rpJ(peak) + ' sebelum termin cair.', capRatio > 1 ? 'Besar' : 'Sedang', capRatio > 1 ? 'bad' : 'warn']);
    if (conc > 0.4) risks.push(['Terlalu bergantung pada 1 klien', 'Proyek ini ' + Math.round(conc * 100) + '% dari omzet tahunan. Kalau macet, perusahaan ikut macet.', 'Sedang', 'warn']);
    if (s.kategori === 'renov_besar') risks.push(['Kejutan saat bongkar', 'Kolom keropos, besi berkarat, instalasi listrik lama. Survei bongkar sebagian dulu sebelum harga final.', 'Besar', 'bad']);
    if (s.kategori === 'renov_sedang') risks.push(['Struktur lama belum tentu kuat', 'Plat baru di void atau kamar tambahan menambah beban ke kolom & pondasi lama. Minta ahli struktur cek dulu; perkuatan bisa menambah biaya.', 'Besar', 'bad']);
    if (s.kategori === 'renov_kecil') risks.push(['Pekerjaan melebar', 'Renovasi kecil sering jadi "sekalian ini, sekalian itu". Tulis batas pekerjaan dengan jelas.', 'Sedang', 'warn']);
    if (s.tukang === 'harian') risks.push(['Pekerjaan molor', 'Tukang harian dibayar per hari: lambat 2 minggu = upah tambah ±' + rpJ(laborSum * 0.1) + '. Pantau absensi dan progres mingguan.', 'Sedang', 'warn']);
    risks.push(['Harga material naik', 'BPS: bahan bangunan +9,6% setahun. Kunci harga besi & semen dengan toko, atau minta klausul eskalasi.', 'Sedang', 'warn']);
    if (scopeOn('struktur') && s.akses === 'pikul' && s.cor !== 'manual' && s.cor !== 'minimix') risks.push(['Truk ready mix tidak bisa masuk', 'Lokasi di gang yang dipikul manual. Pakai minimix (+Rp 350 rb/m³) atau aduk manual untuk mutu ≤ K-250.', 'Besar', 'bad']);
    if (scopeOn('struktur') && s.akses === 'sempit' && (s.cor === 'talang' || s.cor === 'pump')) risks.push(['Akses truk 7 m³', 'Jalan sempit: pastikan truk mixer & pompa bisa merapat. Kalau tidak, minimix lebih mahal ±Rp 350 rb/m³.', 'Sedang', 'warn']);
    if (scopeOn('struktur') && s.cor === 'manual' && s.lantai >= 2) risks.push(['Mutu beton aduk manual', 'Struktur ' + s.lantai + ' lantai biasanya K-250–K-300. Aduk manual sulit mencapainya; wajib uji kubus tiap pengecoran.', 'Besar', 'bad']);
    if (scopeOn('interior') && s.interiorBy !== 'semua') risks.push(['Pembagian interior belum tertulis', 'Siapa memasang titik listrik & air untuk kitchen set dan lemari? Tulis di kontrak supaya tidak dibayar dua kali atau tidak ada yang mengerjakan.', 'Sedang', 'warn']);
    if (scopeOn('interior')) risks.push(['Klien ubah selera', 'Interior paling sering berubah. Wajibkan persetujuan tertulis tiap perubahan.', 'Sedang', 'warn']);
    if (s.kenal === 'belum') risks.push(['Belum kenal klien', 'Cek: pernah bangun sebelumnya? Tanya kontraktor lamanya.', 'Kecil', 'grey']);
    const terms = [['Uang muka minimal ' + (capRatio > 1 ? '25%' : capRatio > 0.6 ? '20%' : '15%'), 'Untuk beli material awal tanpa pinjam.'], [s.klien === 'pemerintah' ? 'Termin bulanan sesuai opname' : 'Termin tiap 25% progres, bayar maks. 14 hari', 'Makin sering ditagih, makin kecil bunga modal.'], ['Klausul eskalasi harga material > 5%', 'Besi dan semen naik cepat tahun ini.'], ['Retensi maksimal 5%, cair 6 bulan setelah serah terima', 'Jangan terima retensi 10%.']];
    if (s.kategori === 'renov_sedang') terms.push(['Pemeriksaan struktur lama sebelum harga final', 'Hasil cek kolom & pondasi menentukan perlu perkuatan atau tidak.']);
    if (s.kategori !== 'baru' && s.kategori !== 'interior') terms.push(['Pekerjaan tak terduga saat bongkar = tambah-kurang', 'Disetujui klien lewat WhatsApp sebelum dikerjakan.']);
    if (scopeOn('struktur')) terms.push(['Mutu beton & cara cor tertulis di RAB', 'Tiket ready mix (mutu, volume, jam) dilampirkan tiap pengecoran: adil untuk klien, melindungi kontraktor.']);
    if (scopeOn('arsitektur')) terms.push([s.atap === 'kayu' ? 'Spesifikasi kayu atap tertulis' : s.atap === 'dak' ? 'Waterproofing dak + uji rendam' : 'Spesifikasi baja ringan tertulis', s.atap === 'kayu' ? 'Jenis & kelas kayu, ukuran, anti rayap. Kenaikan harga kayu di atas 10% = tambah-kurang.' : s.atap === 'dak' ? 'Uji rendam 2×24 jam sebelum serah terima; garansi bocor 1 tahun.' : 'Tebal rangka (TCT 0,75 mm), merek, garansi aplikator — bukan cuma "baja ringan".']);
    if (scopeOn('interior')) terms.push(['Daftar termasuk / tidak termasuk untuk interior', 'Furnitur, titik listrik & air: siapa pasok, siapa pasang.']);
    terms.push([s.tukang === 'harian' ? 'Absensi tukang tiap hari' : 'Kontrak borongan tukang tertulis', s.tukang === 'harian' ? 'Upah dibayar sesuai absensi, bukan klaim mandor.' : 'Harga per m², jadwal, dan potongan kalau telat atau hasil jelek.']);
    if (s.tanah !== 'keras') terms.push(['Pondasi dihitung ulang setelah tes tanah', 'Perubahan jenis pondasi = pekerjaan tambah.']);
    const vTitle = capRatio > 1 ? 'Saran saya: jangan ambil di syarat sekarang.' : labaOf(target) / target.Pr < 0.08 ? 'Bisa diambil, tapi tipis. Jangan ditawar lagi.' : 'Proyek ini layak diambil.';
    const vText = capRatio > 1 ? 'Harganya bisa untung, tapi uangnya tidak cukup untuk menalangi. Ubah cara bayar dulu, baru hitung ulang.' : 'Tawarkan ' + rpJ(target.Pr) + '. Kalau klien menawar, turun paling jauh ke ' + rpJ(compete.Pr) + '. Di bawah ' + rpJ(floorP) + ' Bapak rugi.';
    const build = [['Biaya bangun', direct, 'struktur dari rincian beton per elemen + arsitektur & listrik per m² × kondisi lapangan', 1], ['· ' + KAT[s.kategori][0], 0, KAT[s.kategori][1] + (KAT[s.kategori][5] > 1 ? '; biaya bongkar ×' + KAT[s.kategori][5] : ''), 0], ['· Upah tukang ' + TUKANG[s.tukang][0].toLowerCase() + ' ' + rpJ(laborSum), 0, TUKANG[s.tukang][4], 0], ['Cadangan risiko ' + risiko + '%', direct * risiko / 100, '5% dasar + ' + premSum + '% dari ' + prem.length + ' risiko yang Bapak sebut', 0]]
      .concat(prem.map((x) => ['· ' + x[0] + ' +' + x[1] + '%', 0, x[2], 0]))
      .concat([['Biaya kantor 5%', direct * oh, 'admin, kendaraan, kantor', 0], ['Bunga modal', target.md.I, 'menalangi ' + target.md.N + ' bulan, klien bayar ±' + KLIEN[s.klien][3] + ' hari', 0], ['PPh final 2,65%', target.Pr * PPH, 'dipotong klien saat bayar', 0], ['Laba bersih', labaOf(target), 'yang benar-benar masuk kantong', 2], ['Harga tawaran', target.Pr, '', 1]]);
    const accSteps = ['±40%', '±35%', '±28%', '±20%', '±15%', '±15%'], ai = Math.min(5, s.step - 1), accNum = parseInt(accSteps[ai].replace(/\D/g, ''), 10) / 100;
    const intV = works.filter((w) => w.key === 'kitchen' || w.key === 'dekor').reduce((a, w) => a + w.v, 0), band = PASAR[s.type][s.qual];
    const perM2 = target.Pr * (direct - intV) / direct / area, full = s.kategori === 'baru' && ['struktur', 'arsitektur', 'mep'].every(scopeOn);
    const pasar = full ? { band, perM2, pos: perM2 < band[0] ? 'low' : perM2 > band[1] ? 'high' : 'ok' } : null;
    const scopeRate = { struktur: works.filter((w) => w.key === 'persiapan' || w.key === 'pondasi' || w.key === 'struktur').reduce((a, w) => a + w.v, 0) / area || strukturCost(s, area).atas / area * 1.3, arsitektur: rate * 0.8, mep: rate * 0.2 };
    return { floors: floorsOut, pasar, scopeRate, area, direct, laborSum, base, risiko, premSum, prem, target, compete, safe, floorP, labaOf, pctOf, cap, capRatio, capacity, peak, risks: risks.slice(0, 3), terms: terms.slice(0, 6), vTitle, vText, build, works, meter: { acc: accSteps[ai], range: rpJ(target.Pr * (1 - accNum)) + ' – ' + rpJ(target.Pr * (1 + accNum)), ai }, PPH, model: target.md };
  }

  /* ---------- tampilan ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const opt = (on, label, sub, tag, onclick, tagCls) => '<button class="kopt' + (on ? ' on' : '') + '" onclick="' + onclick + '"><span class="col grow" style="gap:0"><b>' + esc(label) + '</b>' + (sub ? '<span class="tiny" style="opacity:.8">' + esc(sub) + '</span>' : '') + '</span>' + (tag ? '<span class="pill ' + (on ? 'lime' : tagCls || 'grey') + '">' + esc(tag) + '</span>' : '') + '</button>';
  const stepper = (label, hint, val, dec, inc) => '<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><span class="col grow" style="gap:0"><b class="small">' + esc(label) + '</b>' + (hint ? '<span class="tiny muted">' + esc(hint) + '</span>' : '') + '</span><span class="stepper"><button onclick="' + dec + '">−</button><b style="min-width:84px">' + esc(val) + '</b><button onclick="' + inc + '">+</button></span></div>';
  const card = (inner, cls) => '<div class="card ' + (cls || '') + '">' + inner + '</div>';
  const set = (p) => "KONSULTAN.set(" + JSON.stringify(p).replace(/"/g, '&quot;') + ")";

  // editor per lantai: tiap lantai bisa dibagi beberapa area (mis. cor ulang 12 m² di teras + renovasi ruang tengah)
  function floorEditor(s, r, next) {
    const rows = (s.floors || []).map((f, i) => ({ f, i, lt: ltOf(f, i), o: (r.floors || [])[i] || { v: 0 } })), lts = Array.from(new Set(rows.map((x) => x.lt))).sort((a, b) => a - b), top = Math.max(0, ...lts);
    const seg = (x, many) => '<div class="col" style="gap:6px;' + (many ? 'padding:8px 10px;border-left:3px solid var(--line);margin-left:2px' : '') + '"><div class="row" style="gap:8px;align-items:flex-end">' +
      (many ? '<div class="field grow"><label class="tiny">Nama area</label><input class="sm" placeholder="mis. teras depan" value="' + esc(x.f.nama || '') + '" onchange="KONSULTAN.fl(' + x.i + ',\'nama\',this.value)"></div>' : '') +
      '<div class="field" style="flex:0 0 96px"><label class="tiny">Luas (m²)</label><input class="sm num" inputmode="decimal" value="' + x.f.luas + '" onchange="KONSULTAN.fl(' + x.i + ',\'luas\',this.value)"></div>' +
      (rows.length > 1 ? '<button class="btn ghost sm" aria-label="Hapus ' + (many ? 'area ' + esc(x.f.nama || '') + ' di ' : '') + 'lantai ' + x.lt + '" onclick="KONSULTAN.fl(' + x.i + ',\'del\')">Hapus</button>' : '') + '</div>' +
      '<label class="tiny">Pekerjaan (boleh pilih lebih dari satu)</label><div class="row" style="gap:6px;flex-wrap:wrap">' + Object.keys(FJ).map((k) => { const o = jl(x.f).includes(k); return '<button class="chip sm' + (o ? ' on' : '') + '" aria-pressed="' + o + '" title="' + esc(FJ[k][1]) + '" onclick="KONSULTAN.fl(' + x.i + ',\'tog\',\'' + k + '\')">' + (o ? '✓ ' : '') + esc(FJ[k][0]) + '</button>'; }).join('') + '</div>' +
      '<span class="tiny muted">' + esc(jl(x.f).map((k) => FJ[k][1]).join(' · ')) + (many && x.o.v ? ' · <b>' + rpJ(x.o.v) + '</b>' : '') + '</span>' +
      opt(!!x.f.int, (x.f.int ? '☑ ' : '☐ ') + 'Ada interior di ' + (many ? 'area' : 'lantai') + ' ini', '', '', 'KONSULTAN.fl(' + x.i + ',\'int\',' + !x.f.int + ')') + '</div>';
    return card('<h2>Pekerjaan per lantai</h2><span class="small muted">Isi luas yang benar-benar dikerjakan. Satu lantai bisa dibagi beberapa area, mis. 12 m² dicor ulang + ruang lain direnovasi. Area yang tidak disentuh tidak perlu diisi.</span>' +
      lts.map((lt) => { const rs = rows.filter((x) => x.lt === lt), many = rs.length > 1, tot = rs.reduce((a, x) => a + x.o.v, 0), luas = rs.reduce((a, x) => a + (Number(x.f.luas) || 0), 0);
        return '<div class="col" style="gap:8px;padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><b>Lantai ' + lt + (lt === top && lts.length > 1 ? ' <span class="tiny muted">(paling atas)</span>' : '') + (many ? ' <span class="tiny muted">' + rs.length + ' area · ' + luas + ' m²</span>' : '') + '</b><b class="small">' + (tot ? rpJ(tot) : '—') + '</b></div>' +
          rs.map((x) => seg(x, many)).join('') + '<button class="btn ghost sm" onclick="KONSULTAN.fl(0,\'seg\',' + lt + ')">+ Tambah area di lantai ' + lt + '</button></div>'; }).join('') +
      '<button class="btn ghost full" onclick="KONSULTAN.fl(0,\'add\')">+ Tambah lantai</button><div class="row between"><span class="muted">Total luas dikerjakan</span><b style="font-size:18px">' + r.area.toLocaleString('id-ID') + ' m²</b></div>' + next());
  }

  function view(st, S) {
    if (S && S.matrix) MX = S.matrix;
    LAST = st;
    const s = st, r = calc(s), on = (k, v) => s[k] === v, ns = norm(s), scopeOn = (k) => ns.scope.indexOf(k) >= 0;
    const dots = '<div class="row" style="gap:4px">' + [1, 2, 3, 4, 5, 6, 7].map((i) => '<button aria-label="' + esc(LABELS[i - 1]) + '" onclick="' + set({ step: i }) + '" style="flex:1 1 0;height:6px;border:none;border-radius:3px;padding:0;cursor:pointer;background:' + (i === s.step ? 'var(--green)' : i < s.step ? '#9ADBBC' : '#D6D9D2') + '"></button>').join('') + '</div>';
    const next = (label) => '<button class="btn lime full" onclick="' + set({ step: Math.min(7, s.step + 1) }) + '">' + (label || 'Lanjut') + '</button>';
    let body = '';
    if (s.step === 1) body = card('<h2>Pekerjaannya apa?</h2><span class="small muted">Kategori menentukan harga per m², lingkup, dan risiko.</span><div class="col" style="gap:6px">' + Object.keys(KAT).map((k) => { const K = KAT[k]; return opt(on('kategori', k), K[0], K[1] + ' · mis. ' + K[8], K[7], set(Object.assign({ kategori: k, scope: K[4].concat(scopeOn('interior') ? ['interior'] : []) }, K[9])), K[3] ? 'warn' : 'grey'); }).join('') + '</div>') + card('<h2>Tambahan</h2><span class="small muted">Centang kalau klien juga minta pekerjaan interior. Pembagiannya (siapa pasok, siapa pasang) ditanyakan di pertanyaan berikutnya.</span>' + opt(scopeOn('interior'), (scopeOn('interior') ? '☑ ' : '☐ ') + 'Interior / fit-out', 'Kitchen set, lemari built-in, backdrop, wallpaper, titik listrik & air tambahan', scopeOn('interior') ? 'ditambahkan' : '', set({ scope: scopeOn('interior') ? s.scope.filter((k) => k !== 'interior') : s.scope.concat(['interior']) })) + next());
    else if (s.step === 2) body = card('<h2>' + (s.kategori === 'baru' ? 'Bangunannya apa?' : s.kategori === 'interior' ? 'Interior untuk bangunan apa?' : 'Bangunan yang direnovasi apa?') + '</h2><div class="col" style="gap:6px">' + [['rumah', 'Rumah tinggal', '1–3 lantai'], ['ruko', 'Ruko / rukan', 'deret, 2–4 lantai'], ['kos', 'Kos / kontrakan', 'banyak kamar mandi'], ['gudang', 'Gudang / pabrik', 'bentang lebar, baja']].map((t) => opt(on('type', t[0]), t[1], t[2], '', set({ type: t[0] }))).join('') + '</div>') +
      card('<h2>Hitung luas</h2><div class="row" style="gap:6px">' + opt(!s.perLantai, 'Seluruh bangunan', 'lebar × panjang × lantai', '', set({ perLantai: false })) + opt(!!s.perLantai, 'Per lantai', 'tiap lantai beda luas & pekerjaan', '', set({ perLantai: true, floors: s.floors && s.floors.length ? s.floors : Array.from({ length: s.lantai }, (_, i) => ({ luas: s.lebar * s.panjang, jenis: s.kategori === 'baru' ? 'baru' : s.kategori, int: scopeOn('interior') })) })) + '</div>') +
      (s.perLantai ? floorEditor(s, r, next) : card('<h2>' + (s.kategori === 'baru' ? 'Ukurannya kira-kira?' : 'Berapa luas area yang dikerjakan?') + '</h2><span class="small muted">' + (s.kategori === 'baru' ? 'Tidak perlu persis. Nanti bisa diteliti dari gambar.' : 'Hanya bagian yang dikerjakan. Contoh: dapur 3 × 6 m.') + '</span>' + stepper('Lebar', '', s.lebar + ' m', set({ lebar: Math.max(1, s.lebar - 1) }), set({ lebar: Math.min(60, s.lebar + 1) })) + stepper('Panjang', '', s.panjang + ' m', set({ panjang: Math.max(1, s.panjang - 1) }), set({ panjang: Math.min(120, s.panjang + 1) })) + stepper(s.kategori === 'baru' ? 'Jumlah lantai' : 'Lantai yang dikerjakan', '', String(s.lantai), set({ lantai: Math.max(1, s.lantai - 1) }), set({ lantai: Math.min(6, s.lantai + 1) })) + '<div class="row between"><span class="muted">Luas bangunan</span><b style="font-size:18px">' + r.area.toLocaleString('id-ID') + ' m²</b></div>' + next()));
    else if (s.step === 3) body = (scopeOn('interior') ? card('<h2>Pekerjaan interior dikerjakan siapa?</h2><span class="small muted">Supaya klien tidak membayar dua kali, dan tidak ada pekerjaan yang jatuh di tengah.</span><div class="col" style="gap:6px">' + Object.keys(INTBY).map((k) => opt(on('interiorBy', k), INTBY[k][0], INTBY[k][1], k === 'semua' ? 'harga penuh' : '×' + String(INTBY[k][2]).replace('.', ','), set({ interiorBy: k }), k === 'semua' ? 'grey' : 'warn')).join('') + '</div>') : '') + card('<h2>Kelas bangunan</h2><div class="col" style="gap:6px">' + [['sederhana', 'Sederhana', 'Keramik 40×40, cat standar, kusen kayu lokal'], ['menengah', 'Menengah', 'Granit 60×60 lantai bawah, kusen aluminium, plafon gypsum'], ['mewah', 'Mewah', 'Marmer / granit besar, fasad khusus, material impor']].map((q) => opt(on('qual', q[0]), q[1], q[2], 'pasar ' + PASAR[s.type][q[0]].map((x) => String(x).replace('.', ',')).join('–') + ' Jt/m²', set({ qual: q[0] }))).join('') + '</div>') +
      (s.perLantai ? card('<h2>Lingkup pekerjaan</h2><span class="small muted">Diatur per lantai di pertanyaan 2: ' + esc((s.floors || []).map((f, i) => 'Lt ' + ltOf(f, i) + (f.nama ? ' ' + f.nama : '') + ' ' + jl(f).map((k) => FJ[k][0].toLowerCase()).join(' + ') + (f.int ? ' + interior' : '')).join(' · ')) + '</span>' + next()) : card('<h2>Lingkup pekerjaan</h2><span class="small muted">Centang yang dikerjakan Bapak.</span><div class="col" style="gap:6px">' + SCOPES.filter((z) => z[0] !== 'interior').map((z) => { const o = scopeOn(z[0]); return opt(o, (o ? '☑ ' : '☐ ') + z[1], z[2], '±' + rpJ(r.scopeRate[z[0]]) + '/m²', set({ scope: o ? s.scope.filter((k) => k !== z[0]) : s.scope.concat([z[0]]) })); }).join('') + '</div>' + next()));
    else if (s.step === 4) body = (scopeOn('struktur') ? card('<h2>Cara cor beton</h2><span class="small muted">Mutu beton tetap mengikuti gambar struktur. Cara cor memengaruhi harga & risiko mutu.</span><div class="col" style="gap:6px">' + Object.keys(COR).map((k) => { const f = typeof BETON !== 'undefined' ? BETON.methodFactor(k, r.area, s.lantai) : 1; return opt(on('cor', k), COR[k][0], COR[k][1], k === 'pump' ? 'patokan' : (f > 1 ? '+' : '−') + Math.abs(Math.round((f - 1) * 1000) / 10).toString().replace('.', ',') + '% struktur', set({ cor: k }), f > 1.004 ? 'warn' : 'grey'); }).join('') + '</div>') : '') + (scopeOn('arsitektur') ? card('<h2>Rangka atap</h2><span class="small muted">Tanyakan ke klien: baja ringan, kayu, atau dak beton. Bedanya besar di harga atap & risiko.</span><div class="col" style="gap:6px">' + Object.keys(ATAP).map((k) => opt(on('atap', k), ATAP[k][0], ATAP[k][1], ATAP[k][3], set({ atap: k }), ATAP[k][2] > 1 ? 'warn' : 'grey')).join('') + '</div>') : '') + [['Kondisi tanah', 'tanah', TANAH], ['Jalan masuk ke lokasi', 'akses', AKSES], ['Waktu pengerjaan', 'waktu', WAKTU]].map((g) => card('<h3>' + g[0] + '</h3><div class="col" style="gap:6px">' + Object.keys(g[2]).map((k) => { const M = g[2][k]; return opt(on(g[1], k), M[0], M[1], M[3], set({ [g[1]]: k }), M[2] > 1 ? 'warn' : 'grey'); }).join('') + '</div>')).join('') +
      card('<h2>Cara bayar tukang</h2><div class="col" style="gap:6px">' + Object.keys(TUKANG).map((k) => { const T = TUKANG[k]; return opt(on('tukang', k), T[0], T[1], T[6], set({ tukang: k }), T[3] ? 'warn' : 'grey'); }).join('') + '</div><div class="note">' + esc(TUKANG[s.tukang][7]) + '</div><div class="row between small"><span class="muted">Perkiraan upah</span><b>' + rpJ(r.laborSum) + ' · ' + Math.round(r.laborSum / r.direct * 100) + '% biaya</b></div>' + next());
    else if (s.step === 5) body = card('<h2>Kliennya siapa?</h2><div class="col" style="gap:6px">' + Object.keys(KLIEN).map((k) => opt(on('klien', k), KLIEN[k][0], KLIEN[k][1], '', set({ klien: k }))).join('') + '</div>') +
      card('<h2>Pernah kerja bareng?</h2><div class="col" style="gap:6px">' + [['sudah', 'Sudah, lancar'], ['belum', 'Belum pernah']].map((o) => opt(on('kenal', o[0]), o[1], '', '', set({ kenal: o[0] }))).join('') + '</div><span class="small muted">' + (s.kenal === 'belum' ? 'Saya tambah premi risiko 1% dan sarankan uang muka lebih besar.' : 'Bagus, risiko bayar lebih kecil.') + '</span>') +
      card('<h2>Cara bayar yang ditawarkan klien</h2><div class="col" style="gap:6px">' + Object.keys(BAYAR).map((k) => opt(on('bayar', k), BAYAR[k][0], '', '', set({ bayar: k }))).join('') + '</div><span class="small muted">Nanti saya tunjukkan berapa laba yang hilang karena cara bayar ini.</span>' + next());
    else if (s.step === 6) body = card('<h2>Uang Bapak</h2><span class="small muted">Untuk mengecek apakah Bapak sanggup menalangi proyek ini sampai termin cair.</span>' + [['kas', 'Kas bebas perusahaan', 'Yang belum disisihkan untuk proyek lain', 100, 0, 20000], ['plafon', 'Plafon kredit bank (total)', 'Seluruh fasilitas KMK / rekening koran', 100, 0, 20000], ['plafonPakai', 'Plafon sudah terpakai', 'Dipakai proyek lain yang sedang jalan', 100, 0, 20000], ['bunga', 'Bunga pinjaman', 'Per tahun', 1, 0, 24], ['omzet', 'Omzet setahun terakhir', 'Semua proyek', 500, 500, 100000]].map((k) => stepper(k[1], k[2], k[0] === 'bunga' ? s.bunga + '%' : rpJ(s[k[0]]), set({ [k[0]]: Math.max(k[4], s[k[0]] - k[3]) }), set({ [k[0]]: Math.min(k[5], s[k[0]] + k[3]) }))).join('') + next('Lihat keputusan'));
    else {
      const t = r.target, laba = r.labaOf(t);
      body = '<div class="card ' + (r.capRatio > 1 ? 'bad' : laba / t.Pr < 0.08 ? 'warn' : 'ok') + '"><b style="font-size:18px;line-height:1.3">' + esc(r.vTitle) + '</b><span class="small">' + esc(r.vText) + '</span></div>' +
        '<div class="hero"><div class="col" style="gap:4px"><span class="lbl">Harga tawaran (belum PPN) · gambaran kasar</span><span class="big">' + rpJ(t.Pr) + '</span><span class="sub">' + rpJ(t.Pr / r.area) + '/m² · laba bersih <b style="color:var(--lime)">' + rpJ(laba) + ' (' + r.pctOf(t) + ')</b> · ketelitian ' + r.meter.acc + '</span><span class="sub">Harga minimum (batas rugi, sudah termasuk risiko): <b style="color:#FFB4AE">' + rpJ(r.floorP) + '</b>. Susun RAB rinci sebelum tanda tangan.</span>' + (r.pasar ? '<span class="sub">Dibanding harga pasar ' + esc(s.type) + ' ' + esc(s.qual) + ' (' + r.pasar.band.map((x) => String(x).replace('.', ',')).join('–') + ' Jt/m²): <b style="color:' + (r.pasar.pos === 'ok' ? 'var(--lime)' : '#FFD58A') + '">' + rpJ(r.pasar.perM2) + '/m² · ' + (r.pasar.pos === 'ok' ? 'wajar' : r.pasar.pos === 'high' ? 'di atas pasar — cek lagi kondisi lapangan, klien bisa membandingkan' : 'di bawah pasar — pastikan tidak ada pekerjaan yang terlewat') + '</b>' + (r.pasar.perM2 !== r.target.Pr / r.area ? ' (tanpa interior)' : '') + '</span>' : '') + '</div><div class="minis"><button class="mini"><span>Batas rugi</span><b style="color:#FFB4AE">' + rpJ(r.floorP) + '</b></button><button class="mini"><span>Bersaing</span><b>' + rpJ(r.compete.Pr) + '</b><span>laba ' + r.pctOf(r.compete) + '</span></button><button class="mini"><span>Aman</span><b class="lime">' + rpJ(r.safe.Pr) + '</b><span>laba ' + r.pctOf(r.safe) + '</span></button></div></div>' +
        '<div class="card ' + r.cap[2] + '"><b>' + esc(r.cap[0]) + '</b><span class="small">' + esc(r.cap[1]) + '</span><div class="bar" style="background:rgba(0,0,0,.08)"><span style="width:' + Math.min(100, r.capRatio * 100) + '%;background:currentColor"></span></div><div class="row between tiny"><span>Butuh puncak ' + rpJ(r.peak) + ' (bulan ke-' + r.model.peakM + ')</span><span>Kas + sisa plafon ' + rpJ(r.capacity) + '</span></div></div>' +
        card('<h3>3 syarat utama ke klien</h3><div class="list">' + r.terms.slice(0, 3).map((x, i) => '<div class="row" style="gap:10px;align-items:flex-start"><span class="avatar" style="width:26px;height:26px;font-size:12px;border-radius:13px">' + (i + 1) + '</span><b class="small">' + esc(x[0]) + '</b></div>').join('') + '</div>') +
        card('<h3>Simpan sebagai proyek</h3><span class="small muted">RAB awal dibuat dari rincian di atas (biaya modal per pekerjaan + margin). Admin bisa merapikan angkanya sebelum dikirim ke klien.</span><div class="field"><label>Nama proyek</label><input id="kNama" oninput="sel.kon.nama=this.value" value="' + esc(s.nama || '') + '" placeholder="mis. Ruko 3 Lantai Bekasi"></div><div class="field"><label>Klien</label><input id="kKlien" oninput="sel.kon.klienNama=this.value" value="' + esc(s.klienNama || '') + '" placeholder="mis. PT Sinar Abadi"></div><button class="btn full" onclick="KONSULTAN.save()">Simpan proyek & RAB awal</button><button class="btn ghost full" onclick="' + set(Object.assign(defaults(), { step: 1 })) + '">Hitung ulang dari awal</button>') +
        (r.floors ? card('<h3>Biaya per lantai</h3><span class="tiny muted">Biaya bangun langsung, belum termasuk risiko, kantor, bunga & laba.</span><div class="list">' + r.floors.map((f) => '<div class="row between small"><span class="col" style="gap:0"><b>Lantai ' + f.n + (f.nama ? ' · ' + esc(f.nama) : '') + '</b><span class="tiny muted">' + (f.luas ? f.luas + ' m² · ' + esc(f.jenis) + (f.int ? ' + interior' : '') : 'tidak dikerjakan') + '</span></span><b>' + (f.v ? rpJ(f.v) : '—') + '</b></div>').join('') + '</div>') : '') +
        '<button class="btn ghost full" onclick="' + set({ detail: !s.detail }) + '">' + (s.detail ? 'Sembunyikan rincian' : 'Lihat rincian (risiko, syarat lengkap, hitungan, pekerjaan)') + '</button>' +
        (s.detail ? card('<h3>Risiko terbesar</h3><div class="col" style="gap:6px">' + r.risks.map((k) => '<div class="row" style="gap:10px;align-items:flex-start"><span class="pill ' + k[3] + '" style="flex:0 0 auto">' + k[2] + '</span><span class="col" style="gap:0"><b class="small">' + esc(k[0]) + '</b><span class="tiny muted">' + esc(k[1]) + '</span></span></div>').join('') + '</div>') +
        card('<h3>Syarat kontrak yang saya sarankan</h3><div class="list">' + r.terms.map((x, i) => '<div class="row" style="gap:10px;align-items:flex-start"><span class="avatar" style="width:26px;height:26px;font-size:12px;border-radius:13px">' + (i + 1) + '</span><span class="col" style="gap:0"><b class="small">' + esc(x[0]) + '</b><span class="tiny muted">' + esc(x[1]) + '</span></span></div>').join('') + '</div>') +
        card('<h3>Dari mana angkanya</h3><div class="list">' + r.build.map((x) => '<div class="row between" style="' + (x[3] === 2 ? 'border-top:2px solid var(--ink)' : '') + '"><span class="col" style="gap:0"><span class="' + (x[3] ? 'b' : 'small') + '" style="' + (x[3] ? '' : 'color:var(--mute)') + '">' + esc(x[0]) + '</span>' + (x[2] ? '<span class="tiny muted2">' + esc(x[2]) + '</span>' : '') + '</span>' + (x[1] ? '<b style="' + (x[3] === 2 ? 'color:var(--ok)' : '') + '">' + rpJ(x[1]) + '</b>' : '') + '</div>').join('') + '</div>') +
        card('<h3>Rincian pekerjaan (jadi RAB awal)</h3><div class="list">' + r.works.map((w) => '<div class="col" style="gap:2px"><div class="row between small"><span class="b">' + esc(w.label) + '</span><b>' + rpJ(w.v) + '</b></div><div class="row between tiny muted"><span>' + esc(w.vol) + ' · material ' + Math.round(w.matShare * 100) + '% · upah ' + Math.round((1 - w.matShare) * 100) + '%</span>' + (w.flag ? '<span style="color:var(--warnink)">' + esc(w.flag) + '</span>' : '') + '</div><div class="bar"><span style="width:' + (w.v / Math.max(...r.works.map((x) => x.v)) * 100) + '%;background:' + (w.flag ? 'var(--warn)' : 'var(--green)') + '"></span></div></div>').join('') + '</div>') : '');
    }
    const meter = s.step < 7 ? '<div class="card dark" style="gap:6px"><div class="row between"><span class="tiny" style="color:#A9C7B8">Perkiraan sejauh ini · ketelitian ' + r.meter.acc + '</span><span class="tiny" style="color:#A9C7B8">' + (7 - s.step) + ' pertanyaan lagi</span></div><b style="font-size:20px;color:var(--lime)">' + r.meter.range + '</b><div class="row" style="gap:3px">' + [0, 1, 2, 3, 4, 5].map((i) => '<span style="flex:1 1 0;height:4px;border-radius:2px;background:' + (i <= r.meter.ai ? 'var(--lime)' : '#2A3530') + '"></span>').join('') + '</div></div>' : '';
    return '<div class="col" style="gap:2px"><span class="tiny b muted">' + esc(LABELS[s.step - 1]) + '</span>' + dots + '</div>' + body + meter;
  }

  function toProject(s0, nama, klien) {
    const s = norm(s0), r = calc(s0), t = r.target;
    const k = 1e6 * (1 + r.risiko / 100), divisions = [];  // cadangan risiko dimasukkan ke RAP
    const hasStruct = r.works.some((w) => w.key === 'struktur'), hasInt = r.works.some((w) => w.key === 'kitchen' || w.key === 'dekor');
    r.works.forEach((w) => {
      if (w.key === 'pondasi' && hasStruct) divisions.push({ name: 'Galian & urugan tanah', rap: Math.round((w.galian != null ? w.galian : w.v * 0.35) * k) });
      else if (w.key === 'struktur') divisions.push({ src: 'struct', name: 'Struktur beton (rincian per elemen)', rap: Math.round((w.v + (() => { const f = r.works.find((x) => x.key === 'pondasi'); return f ? f.v - (f.galian != null ? f.galian : f.v * 0.35) : 0; })()) * k) });
      else if (w.key === 'kitchen' || w.key === 'dekor') { const d = divisions.find((x) => x.src === 'interior'); if (d) d.rap += Math.round(w.v * k); else divisions.push({ src: 'interior', name: 'Interior (lihat pembagian pekerjaan)', rap: Math.round(w.v * k) }); }
      else divisions.push({ name: w.label, rap: Math.round(w.v * k) });
    });
    const struct = hasStruct && typeof BETON !== 'undefined' ? BETON.defaults(r.area, s.lantai, s.cor) : null;
    let interior = null;
    if (hasInt && typeof INTERIOR !== 'undefined') { const a = r.area, q = { kitchen: Math.round(a / 25), lemari: Math.round(a / 20), wallpaper: Math.round(a * 0.3), backdrop: Math.max(1, Math.round(a / 60)), lampu: Math.round(a / 15), stop: Math.round(a / 20), air: Math.max(1, Math.round(a / 60)) }; interior = INTERIOR.defaults(s.interiorBy).map((x) => Object.assign(x, { qty: q[x.key] || 0 })); }
    const rapSum = divisions.reduce((a, d) => a + d.rap, 0);
    const buk = Math.max(9, Math.min(25, Math.round((t.Pr * 1e6 / rapSum - 1) * 100)));
    return { name: nama, client: klien, status: 'penawaran', buk, kasAwal: Math.round(s.kas * 1e6), divisions, struct, structPerCor: Math.max(5, Math.round(r.area * 0.22 / Math.max(1, s.lantai * 2))), interior, area: r.area, lantai: s.lantai, offer: { cor: s.cor, atap: s.atap, floors: r.floors ? r.floors.map((f) => ({ n: f.n, nama: f.nama, jenis: f.jenis, luas: f.luas, int: f.int, biaya: Math.round(f.v * 1e6) })) : null, interiorBy: s.interiorBy, kategori: s.kategori, type: s.type, area: r.area, qual: s.qual, scope: s.scope, tukang: s.tukang, klien: s.klien, bayar: s.bayar, harga: Math.round(t.Pr * 1e6), floor: Math.round(r.floorP * 1e6), bersaing: Math.round(r.compete.Pr * 1e6), aman: Math.round(r.safe.Pr * 1e6), terms: r.terms.map((x) => x[0]), risks: r.risks.map((x) => x[0]), ts: new Date().toISOString() } };
  }
  return { fl, FJ, defaults, calc, view, toProject, LABELS, set: null, save: null };
})();
