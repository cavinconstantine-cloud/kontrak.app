# Buku Proyek — draft aplikasi (v0.1)

Aplikasi pembukuan proyek untuk kontraktor kecil. Web ringan, bisa dibuka di HP lama lewat browser. Tiga pengguna: **Owner**, **Admin – Finance**, **Mandor**.

## Menjalankan

Butuh Node.js 18 atau lebih baru (https://nodejs.org). Tidak ada paket tambahan.

```
node server.js
```

Buka http://localhost:3000 di komputer. Dari HP di jaringan Wi-Fi yang sama, buka `http://<IP komputer>:3000`.

Password awal (ganti segera):

| Peran  | Password awal |
|--------|---------------|
| owner  | owner123      |
| admin  | admin123      |
| mandor | mandor123     |

Ganti password:

```
node setpass.js owner PasswordBaru
```

atau dari menu **Menu → Ganti password** di aplikasi.

## Apa yang sudah ada

**Mandor (HP)** — hanya lapangan, tanpa angka uang
- Absen masuk/pulang: selfie + lokasi GPS. Dicek jaraknya ke titik proyek (radius 300 m).
- Lapor progres per pekerjaan (±5%) dengan foto wajib. Hanya bisa setelah absen di lokasi.
- Kirim nota: foto nota, jenis barang, jumlah, nominal. Status nota (menunggu/disetujui/ditolak + alasan).

**Admin – Finance (desktop / HP)**
- RAB per pekerjaan (RAP = biaya modal, tidak pernah dikirim ke klien), margin BUK dengan pengaman laba: tidak bisa di bawah batas impas.
- Matriks harga pasar (rendah / wajar / tinggi) — bisa diedit, versi naik otomatis.
- Nota mandor dibandingkan otomatis dengan matriks: ditandai *tinggi / wajar / rendah* dan kelebihan harganya dihitung.
- Persetujuan nota sampai Rp 10 Jt; di atas itu diteruskan ke Owner.
- Verifikasi laporan progres dan absensi (foto, jarak GPS).
- Tagihan termin: DP, termin 1–3 hanya bisa dibuat kalau progres **terverifikasi** sudah mencapai syarat. Hitungan: bruto − potongan DP − retensi + PPN − PPh final.
- Laporan keuangan proyek (PSAK 72) dan unduh CSV (bisa dibuka di Excel).

**Owner (HP)**
- Ringkasan semua proyek: kontrak, kas, proyeksi laba, zona aman/tipis/rugi.
- Setujui nota di atas Rp 10 Jt.
- Detail proyek, progres, laporan keuangan.

## Pasang di internet (HTTPS, bisa dibuka mandor dari HP)

Kamera dan GPS di HP hanya jalan lewat HTTPS, jadi untuk dipakai di lapangan aplikasi harus di-hosting. Tiga pilihan, semua sudah ada file konfigurasinya di repo ini:

| Hosting | Cara | Biaya |
|---|---|---|
| **Render** (paling mudah) | Dashboard → New → **Blueprint** → pilih repo `kontrak.app` → Apply. `render.yaml` sudah mengatur semuanya termasuk disk 1 GB. | ± US$7/bulan (paket free tidak punya disk, data hilang saat restart) |
| **Railway** | New Project → Deploy from GitHub → pilih repo. Lalu di service: Variables → `STORAGE_DIR=/storage`; Volumes → tambah volume, mount `/storage`. | mulai ± US$5/bulan |
| **Fly.io** | `fly launch --copy-config --no-deploy` → `fly volumes create buku_data --size 1` → `fly deploy`. | free tier cukup untuk 1 mesin kecil |

Setelah hidup, buka alamat yang diberikan hosting (mis. `https://buku-proyek.onrender.com`), masuk sebagai Owner, **langsung ganti ketiga password** dari Menu.

Variabel lingkungan yang dipakai server:
- `PORT` — port (hosting mengisinya sendiri).
- `STORAGE_DIR` — folder penyimpanan tetap untuk `data/` dan `uploads/`. Wajib menunjuk ke disk/volume, kalau tidak data hilang saat aplikasi di-restart.

## Data

Semua data ada di folder `data/` (file JSON) dan foto di `uploads/`. Cadangkan dua folder itu. Hapus `data/db.json` untuk mulai dari kosong (proyek contoh "Ruko 3 Lantai" akan dibuat lagi).

Pengaturan di `data/config.json`: batas persetujuan Admin (`approvalLimit`), radius absen (`siteRadiusM`), tarif PPN/PPh/overhead/bunga.

## Belum ada (tahap berikutnya)

- Dokumen RAB PDF versi klien / bank dan Excel lengkap (sekarang baru CSV ringkasan).
- Pencatatan WhatsApp otomatis (sekarang lewat aplikasi web).
- Lebih dari satu mandor dengan proyek berbeda (sekarang satu akun mandor).
- Kalkulator beton & baja per elemen (sudah ada di mockup, belum di aplikasi).
- HTTPS. Untuk dipakai lewat internet, pasang di belakang Nginx/Caddy dengan HTTPS. Kamera dan GPS di HP hanya jalan di HTTPS atau `localhost`.
