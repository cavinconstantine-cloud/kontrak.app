// Matriks harga awal (v15, 12 Okt 2026) — harga pasar Jabodetabek, bisa diubah dari menu Admin
// key, nama, satuan, rendah, wajar (dipakai), tinggi, sumber
const R = (key, name, unit, low, typ, high, src) => ({ key, name, unit, low, typ, high, src, date: '2026-10-12' });
module.exports = [
  R('semen', 'Semen PC 50 kg', 'sak', 66000, 72800, 78000, 'sampel toko Bekasi'),
  R('pasirB', 'Pasir beton', 'm³', 300000, 346500, 380000, 'CV Pasir Galunggung'),
  R('pasirP', 'Pasir pasang', 'm³', 235000, 260000, 290000, 'nota proyek'),
  R('split', 'Batu split 1–2', 'm³', 300000, 330000, 360000, 'sampel toko'),
  R('bata', 'Bata merah', 'buah', 600, 750, 950, 'UD Bata Jaya'),
  R('hebel', 'Bata ringan 10 cm', 'm³', 600000, 650000, 720000, 'sampel toko'),
  R('besiU', 'Besi ulir BjTS 420', 'kg', 12750, 14350, 16000, 'bangun.com Sep 2026, toko Jaktim'),
  R('besiP', 'Besi polos BjTP 280', 'kg', 12000, 14000, 15500, 'toko Jaktim'),
  R('kawat', 'Kawat bendrat', 'kg', 22000, 25000, 28000, 'sampel toko'),
  R('rmK225', 'Ready mix K-225', 'm³', 850000, 910000, 980000, 'Indojaya, Solusi Beton'),
  R('rmK250', 'Ready mix K-250', 'm³', 840000, 930000, 980000, 'konstruksi.online Okt 2026'),
  R('rmK300', 'Ready mix K-300', 'm³', 925000, 990000, 1060000, 'Indojaya, Solusi Beton'),
  R('rmK350', 'Ready mix K-350', 'm³', 935000, 1020000, 1095000, 'Jayabeton, Signal, Solusi'),
  R('pompa', 'Sewa pompa beton standar', '8 jam', 3000000, 3500000, 4500000, 'mitrareadymix, arthamix'),
  R('wiremesh8', 'Wiremesh M8 (2,1×5,4)', 'lembar', 643500, 690000, 780000, 'Hagane Jul 2026'),
  R('bondek', 'Bondek 0,75 mm', 'm', 130000, 165000, 235000, 'Sentrabaja, Blibli'),
  R('wf', 'Baja WF (material)', 'kg', 15850, 18500, 23300, 'Dua Putra Petir Okt 2026'),
  R('ply', 'Multiplek film 12 mm', 'lembar', 219000, 260000, 380000, 'Tokopedia 2026'),
  R('granit', 'Granit 60×60', 'm²', 200000, 238000, 280000, 'Qhome Bekasi'),
  R('keramik', 'Keramik 40×40', 'm²', 45000, 65000, 110000, 'sampel toko'),
  R('gypsum', 'Gypsum 9 mm', 'lembar', 65000, 72000, 85000, 'sampel toko'),
  R('cat', 'Cat tembok 25 kg', 'pail', 450000, 620000, 900000, 'sampel toko'),
  R('bajaRingan', 'Baja ringan C75', 'batang', 85000, 95000, 110000, 'sampel toko'),
  R('tukang', 'Upah tukang', 'hari', 190000, 210000, 250000, 'absensi proyek'),
  R('pekerja', 'Upah pekerja / kenek', 'hari', 140000, 160000, 180000, 'absensi proyek')
];
