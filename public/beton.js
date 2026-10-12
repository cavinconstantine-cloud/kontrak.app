/* Hitungan beton & baja per elemen (dipakai RAB, Konsultan, cek tiket ready mix).
   Harga diambil dari matriks harga bila ada (S.matrix), selebihnya angka pasar Jabodetabek Okt 2026. */
'use strict';
(typeof window !== 'undefined' ? window : globalThis).BETON = (() => {
  // mutu: fc' MPa, harga ready mix wajar per m³ (cadangan bila tidak ada di matriks)
  const MUTU = { 'K-100': [8.3, 815000], 'K-175': [14.5, 860000], 'K-225': [18.7, 910000], 'K-250': [20.8, 930000], 'K-300': [24.9, 990000], 'K-350': [29.0, 1020000], 'K-400': [33.2, 1100000] };
  // AHSP aduk manual per m³: semen kg, pasir m³, split m³ (SNI 7394 / Permen PUPR 8/2023)
  const MAN = { 'K-100': [247, 0.621, 0.740], 'K-175': [326, 0.543, 0.764], 'K-225': [371, 0.499, 0.776], 'K-250': [384, 0.494, 0.770] };
  // elemen: nama, rasio besi kg/m³, bekisting m²/m³, struktur utama?, rentang rasio
  const EL = { pondasi: ['Footplat / pondasi', 80, 2.5, true, '60–100'], sloof: ['Sloof', 125, 6.7, true, '100–150'], kolom: ['Kolom', 200, 10, true, '150–250'], balok: ['Balok', 175, 9, true, '150–200'], plat: ['Plat lantai 12 cm', 100, 8.3, true, '80–120'], tangga: ['Tangga', 120, 9, true, '100–140'], praktis: ['Kolom praktis / ring balk', 90, 13, false, '70–110'], kerja: ['Lantai kerja', 0, 0, false, 'tanpa besi'] };
  const MET = { manual: ['Aduk manual (molen)', 'volume kecil, akses sempit; mutu sulit dijamin'], talang: ['Ready mix + talang/ember', 'truk 7 m³ merapat, dicor manual'], pump: ['Ready mix + pompa', 'pompa standar, plat & balok lantai atas'], boom: ['Ready mix + long boom', 'volume besar ≥ 30 m³'], minimix: ['Minimix (truk kecil)', 'jalan < 4 m, +Rp 350 rb/m³'] };
  const BAJA = { bjts: 'Besi ulir BjTS 420', bjtp: 'Besi polos BjTP 280' };
  function prices(matrix) {
    const m = {}; (matrix && matrix.items || []).forEach((it) => { m[it.key] = it.typ; });
    const g = (k, d) => (m[k] != null ? m[k] : d);
    return { semenKg: g('semen', 72800) / 50, pasirB: g('pasirB', 346500), split: g('split', 330000), tukang: g('tukang', 210000), pekerja: g('pekerja', 160000), kepala: 230000, mandor: 250000, air: 50, molenHari: 350000,
      rm: (mutu) => g('rm' + mutu.replace('-', ''), MUTU[mutu] ? MUTU[mutu][1] : 990000), pump: g('pompa', 3500000), boom: 4600000, minimixPlus: 350000,
      bjts: g('besiU', 14350), bjtp: g('besiP', 14000), kawat: g('kawat', 25000), upahBesi: 3500, bek: 150000, bondek: g('bondek', 165000), bondekPasang: 20000, meshM8: g('wiremesh8', 690000) };
  }
  // biaya beton per m³ → [beton, alat, upah] atau null bila cara cor tidak cocok untuk mutu ini
  function pour(P, met, mutu, volPerCor) {
    const v = Math.max(1, volPerCor || 20), rm = P.rm(mutu), man = MAN[mutu];
    if (met === 'manual') { if (!man) return null; return [man[0] * P.semenKg + man[1] * P.pasirB + man[2] * P.split + 215 * P.air, 0.1 * P.molenHari, 1.65 * P.pekerja + 0.275 * P.tukang + 0.028 * P.kepala + 0.083 * P.mandor]; }
    if (met === 'talang') return [rm * 1.02, 0, 220000];
    if (met === 'pump') return [rm * 1.02, P.pump / v, 140000];
    if (met === 'boom') return [rm * 1.02, (v <= 30 ? P.boom : 5500000) / v, 120000];
    if (met === 'minimix') return [(rm + P.minimixPlus) * 1.02, 0, 220000];
    return null;
  }
  const besiKg = (P, baja) => P[baja] * 1.05 + 0.015 * P.kawat + P.upahBesi;
  // satu elemen: { el, mutu, met, baja, vol, ratio, slab } → rincian & peringatan
  function element(e, P, ctx) {
    const E = EL[e.el] || EL.kolom, ratio = e.el === 'kerja' ? 0 : (e.ratio != null && e.ratio !== '' ? Number(e.ratio) : E[1]), vol = Math.max(0, Number(e.vol) || 0);
    const p = pour(P, e.met, e.mutu, ctx && ctx.volPerCor), warn = [];
    const fc = (MUTU[e.mutu] || [0])[0];
    if (!p) warn.push(['bad', 'Aduk manual tidak disarankan untuk ' + e.mutu + ' — mutu sulit dicapai. Pakai ready mix.']);
    if (E[3] && fc < 21 && e.el !== 'tangga') warn.push(['bad', e.mutu + ' ≈ fc′ ' + String(fc).replace('.', ',') + ' MPa, di bawah fc′ 21 MPa (SNI 2847:2019 untuk struktur tahan gempa). Hanya boleh bila gambar struktur menyebutnya.']);
    else if (E[3] && fc < 24 && ctx && ctx.lantai >= 3) warn.push(['warn', 'Bangunan ' + ctx.lantai + ' lantai umumnya K-300 (fc′ 25). Cocokkan dengan gambar struktur.']);
    if (e.met === 'manual' && p && E[3] && ctx && ctx.lantai >= 2) warn.push(['warn', 'Aduk manual untuk struktur bangunan bertingkat: wajib uji kubus/silinder.']);
    if (!p) return { ok: false, perM3: 0, total: 0, parts: [], warn, ratio, vol };
    const bk = besiKg(P, e.baja || 'bjts');
    let perM3 = p[0] + p[1] + p[2] + ratio * bk + E[2] * P.bek, total = perM3 * vol, slab = null;
    if (e.el === 'plat') {
      const area = vol / 0.12, conc = p[0] + p[1] + p[2];
      const konv = 0.12 * conc + 0.12 * ratio * bk + P.bek, bond = 0.105 * conc + P.bondek * 1.05 + P.bondekPasang + P.meshM8 / 11.34 * 1.15 + 10000 + 4 * bk + 25000;
      slab = { area, konv, bond };
      if (e.slab === 'bondek') { total = bond * area; perM3 = vol ? total / vol : 0; }
    }
    const parts = [['Beton ' + e.mutu, p[0]], ['Alat (pompa/molen)', p[1]], ['Upah cor', p[2]], ['Besi ' + ratio + ' kg/m³', ratio * bk], ['Bekisting ' + E[2] + ' m²/m³', E[2] * P.bek]];
    return { ok: true, perM3, total, parts, warn, ratio, vol, slab };
  }
  function defaults(area, lantai, met) {
    const a = area || 100, L = lantai || 1, mutu = L >= 3 ? 'K-300' : 'K-250', m = met || 'pump', r1 = (x) => Math.max(0.5, Math.round(x * 10) / 10);
    const pondasi = a * 0.08, atas = a * 0.22;
    return [['pondasi', pondasi * 0.6, m === 'pump' || m === 'boom' ? 'talang' : m], ['sloof', pondasi * 0.4, m === 'pump' || m === 'boom' ? 'talang' : m], ['kolom', atas * 0.25, m], ['balok', atas * 0.30, m], ['plat', atas * 0.45, m], ['praktis', a * 0.015, 'manual'], ['kerja', a / L * 0.05, 'manual']]
      .map((x) => ({ el: x[0], mutu: x[0] === 'praktis' ? 'K-175' : x[0] === 'kerja' ? 'K-100' : mutu, met: x[2], baja: x[0] === 'praktis' ? 'bjtp' : 'bjts', vol: r1(x[1]), ratio: null, slab: 'konv' }));
  }
  // faktor biaya relatif cara cor untuk Konsultan (dibanding pompa), memakai elemen kolom K-250
  function methodFactor(met, area, lantai) {
    const P = prices(null), vpc = Math.max(5, area * 0.22 / Math.max(1, lantai * 2));
    const base = element({ el: 'balok', mutu: 'K-250', met: 'pump', baja: 'bjts', vol: 1 }, P, { volPerCor: vpc }).perM3;
    const x = element({ el: 'balok', mutu: 'K-250', met, baja: 'bjts', vol: 1 }, P, { volPerCor: vpc });
    return x.ok ? x.perM3 / base : 1;
  }
  // cek tiket ready mix: mutu sesuai rencana & lama di jalan
  function ticketCheck(rm, struct) {
    const planned = Array.from(new Set((struct || []).filter((e) => e.met !== 'manual').map((e) => e.mutu)));
    const mins = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const a = mins(rm.out), b = mins(rm.arrive); let late = null; if (a != null && b != null) late = (b - a + 1440) % 1440;
    return { mutuOk: !planned.length || planned.includes(rm.mutu), planned, minutes: late, late: late != null && late > 90 };
  }
  return { MUTU, EL, MET, BAJA, prices, pour, element, defaults, methodFactor, ticketCheck };
})();
if (typeof module !== 'undefined') module.exports = globalThis.BETON;
