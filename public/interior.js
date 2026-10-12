/* Pembagian pekerjaan interior: siapa memasok, siapa memasang, apa yang tidak termasuk.
   Supaya klien tidak membayar dua kali dan tidak ada pekerjaan yang jatuh di tengah. */
'use strict';
(typeof window !== 'undefined' ? window : globalThis).INTERIOR = (() => {
  // key, nama, satuan, harga kontraktor pasok+pasang, harga jasa pasang saja, butuh (titik sambungan)
  const ITEMS = [
    ['plafon', 'Plafon gypsum + rangka hollow', 'm²', 165000, 55000, []],
    ['dropceil', 'Drop ceiling / list plafon', "m'", 120000, 45000, ['lampu']],
    ['partisi', 'Partisi gypsum', 'm²', 260000, 90000, []],
    ['cat', 'Cat dinding interior', 'm²', 38000, 18000, []],
    ['lantai', 'Lantai vinyl / parket', 'm²', 280000, 60000, []],
    ['wallpaper', 'Wallpaper', 'm²', 150000, 35000, []],
    ['kitchen', 'Kitchen set atas + bawah (HPL)', "m'", 3500000, 600000, ['air', 'stop']],
    ['lemari', 'Lemari built-in (HPL)', 'm² tampak', 2800000, 500000, ['lampu']],
    ['backdrop', 'Backdrop TV / panel dinding', 'm²', 1600000, 350000, ['stop', 'lampu']],
    ['lampu', 'Titik lampu tambahan', 'titik', 420000, 150000, []],
    ['stop', 'Titik stop kontak tambahan', 'titik', 380000, 140000, []],
    ['air', 'Titik air bersih + buangan (kitchen/sink)', 'titik', 650000, 250000, []]
  ];
  const BY = { k: ['Kontraktor', 'pasok & pasang', 'ok'], j: ['Jasa saja', 'material dari pemilik', 'blue'], x: ['Tidak termasuk', 'oleh pemilik / vendor lain', 'grey'] };
  const defaults = (mode) => ITEMS.map((x) => ({ key: x[0], by: mode === 'jasa' ? 'j' : mode === 'sipil' ? (['kitchen', 'lemari', 'backdrop', 'wallpaper', 'lantai'].includes(x[0]) ? 'x' : 'k') : 'k', qty: 0 }));
  const info = (key) => ITEMS.find((x) => x[0] === key);
  function calc(list) {
    const rows = (list || []).map((r) => { const it = info(r.key); if (!it) return null; const rate = r.by === 'k' ? it[3] : r.by === 'j' ? it[4] : 0; return { key: r.key, name: it[1], unit: it[2], by: r.by, qty: Number(r.qty) || 0, rate, total: rate * (Number(r.qty) || 0), needs: it[5] }; }).filter(Boolean);
    const total = rows.reduce((a, r) => a + r.total, 0);
    // celah: pekerjaan yang butuh titik listrik/air tapi titiknya tidak ada yang mengerjakan
    const gaps = [];
    rows.filter((r) => r.qty > 0 && r.needs.length).forEach((r) => r.needs.forEach((n) => { const d = rows.find((x) => x.key === n); if (!d || d.qty <= 0) gaps.push(r.name + ' butuh ' + info(n)[1].toLowerCase() + (r.by === 'x' ? ' — vendor pemilik yang memasang furnitur, tapi titiknya siapa?' : ' — belum dihitung.')); }));
    const termasuk = rows.filter((r) => r.qty > 0 && r.by !== 'x'), tidak = rows.filter((r) => r.by === 'x' && r.qty > 0);
    return { rows, total, gaps, termasuk, tidak };
  }
  return { ITEMS, BY, defaults, calc, info };
})();
if (typeof module !== 'undefined') module.exports = globalThis.INTERIOR;
