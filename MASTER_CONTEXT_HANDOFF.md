# MASTER CONTEXT HANDOFF — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Diperbarui: 2026-09-19 — RESUME UNTUK CHAT BARU

---

## BACA INI DULU — cara pakai dokumen ini

Ini BUKAN ringkasan biasa — perlakukan sebagai fakta yang sudah terjadi,
tidak perlu diverifikasi ulang dari nol. Kalau lanjut chat baru, cukup
baca dokumen ini + `Master_Progress.md` (bagian tanggal terbaru di paling
atas/akhir) — TIDAK perlu baca ulang seluruh riwayat chat sebelumnya.

Backend HANYA boleh diubah dengan izin eksplisit dari user (aturan
proyek). Frontend juga sebaiknya konfirmasi kalau perubahan cukup besar.

---

## STATUS SAAT INI: kode sudah selesai & lolos cek syntax, BELUM di-deploy/dites user

**[PALING BARU 2026-09-19]** User bilang aplikasi sudah OK, minta 4
perbaikan kecil — SEMUA SUDAH DIKERJAKAN & SELESAI, lihat `Master_Progress.md`
bagian **"2026-09-19 — Kehadiran dikelompokkan+fade, 2-tab UI, noindex,
login lebih cepat"** untuk detail lengkap:
1. Kehadiran di PDF dikelompokkan per status (Sakit/Izin/Alpa: nama-nama)
   + efek fade kalau kepanjangan, kolom kanan sekarang tinggi TETAP
   (tidak dihitung dari isi lagi).
2. 3 halaman (Jurnal Saya, Jurnal Kelas, Admin Jurnal Guru) diubah jadi
   **2-tab**: daftar jurnal | export mingguan — sebelumnya digabung
   atas-bawah (dianggap membingungkan).
3. `robots.txt` + meta `noindex` di semua halaman — supaya tidak
   terindeks mesin pencari.
4. Login dipercepat — hapus 2 dari 3 Sheets API call yang sebelumnya
   terjadi tiap login (update kolom `last_login` yang ternyata tidak
   pernah dipakai di manapun).

File yang berubah sesi ini: `apps-script/Auth.gs`, `frontend/app.html`,
`frontend/js/app.js`, file baru `frontend/robots.txt`.

**Belum dites render/deploy sungguhan.** Hal PERTAMA yang perlu dicek di
chat baru: apakah user sudah coba deploy & kasih feedback soal 4 hal di
atas — terutama efek fade di kolom kehadiran PDF (pakai `doc.GState`,
belum pernah dites di PDF asli) dan tampilan 2-tab di 3 halaman.

**1. Bug ditemukan & diperbaiki** — `apps-script/Jurnal.gs`,
`actionUpdateJurnal` (~baris 190): sisa 1 titik pola lama
`String(configVal('IZIN_EDIT_JURNAL')) !== 'TRUE'` yang KEBAL dari fix
`isAktif` 13 Sept (levelnya beda — bukan kolom `aktif`, tapi config
`IZIN_EDIT_JURNAL`, dan pakai `!==` bukan `===` jadi sempat lolos dari
pencarian manual sebelumnya). Root cause SAMA PERSIS: kalau admin mengisi
`IZIN_EDIT_JURNAL` di `01_CONFIG` sebagai checkbox boolean asli, guru
non-admin SELALU diblokir edit jurnal walau admin sudah mengaktifkannya.
Sudah diperbaiki jadi `!isAktif(configVal('IZIN_EDIT_JURNAL'))`.

**2. Fitur baru: Export Rekap Jurnal Mingguan → PDF** (2 jenis: Jurnal
Guru & Jurnal Kelas), lengkap dengan tombol Export PDF di 3 tempat
(Jurnal Saya/Guru, Jurnal Kelas/Wali Kelas, Admin→Jurnal Guru). Detail
teknis lengkap ada di `Master_Progress.md` bagian **"2026-09-15 — Bug
sisa isAktif di edit-jurnal + Fitur Export Rekap Jurnal Mingguan (PDF)"**
— baca itu untuk detail endpoint, field, dan file yang berubah.

## YANG HARUS USER LAKUKAN SELANJUTNYA (aksi pertama di chat baru)

1. Timpa `apps-script/Auth.gs` (login lebih cepat) + `frontend/app.html`
   (CSS tab baru + meta noindex) + `frontend/js/app.js` (kehadiran
   dikelompokkan+fade, 2-tab UI) + tambahkan file baru `frontend/robots.txt`
   di root GitHub Pages.
2. Deploy Apps Script: Manage deployments → Edit → New version → Deploy.
3. Test: (a) login — apakah terasa lebih cepat, (b) buka Jurnal Saya/Jurnal
   Kelas/Admin Jurnal Guru — pastikan tab "Jurnal ..." | "Export Mingguan"
   muncul & berfungsi, (c) export PDF untuk minggu dengan banyak siswa
   tidak hadir (5+ di 1 sesi) — cek kehadiran dikelompokkan per status
   dengan benar & kalau kepanjangan ada efek fade (bukan box makin tinggi
   / teks tumpang tindih), (d) cek `https://<domain-github-pages>/robots.txt`
   bisa diakses & isinya `Disallow: /`.
4. Jalankan `runFullTest()` di Apps Script editor — pastikan section 7
   ("REKAP JURNAL MINGGUAN") semua PASS.
5. Test manual di browser sungguhan (BELUM PERNAH dicoba end-to-end oleh
   siapapun) — langkah detail ada di `Panduan_Deploy_dan_Uji.md` bagian
   "CATATAN UPDATE 2026-09-15". Intinya: coba tombol Export PDF di
   halaman Jurnal Saya (Guru), Jurnal Kelas (Wali Kelas), dan Admin →
   Jurnal Guru — pastikan PDF ke-download, isinya benar sesuai minggu
   yang dipilih, dan tabel rapi/tidak terpotong kalau datanya banyak.
6. Kalau ada guru yang tadinya mengeluh tidak bisa edit jurnal padahal
   fitur edit sudah diaktifkan admin — minta mereka coba lagi, seharusnya
   sudah beres oleh fix bug di atas.

## KALAU MASIH ADA BUG/MASALAH SETELAH DEPLOY — cara lapor yang efisien

Sebutkan: (a) halaman mana, (b) role yang login, (c) langkah persis yang
dilakukan, (d) pesan error persis (screenshot kalau bisa), (e) hasil
`runFullTest()` kalau relevan. Tidak perlu mengulang cerita dari sesi-sesi
sebelumnya — cukup rujuk dokumen ini + `Master_Progress.md`.

## DAFTAR GEJALA LAMA (dari sesi 13 Sept) — MASIH PERLU DIVERIFIKASI USER, belum ada laporan baru

Sesi ini TIDAK menyentuh area berikut sama sekali (tidak ada perubahan
kode terkait), jadi statusnya masih sama seperti diserahkan sesi 13 Sept
— PERLU dikonfirmasi user apakah sudah benar-benar hilang setelah deploy
fix `isAktif`:
- Login: "loading lama setelah lama keluar", beberapa kali gagal login
  padahal password/username benar — kemungkinan terkait `DURASI_SESSION`
  atau race condition banyak user login bersamaan. BELUM dianalisis.
- Admin → "Jurnal Guru": "Memuat data guru, kelas & mapel..." koneksi
  sering gagal, perlu beberapa kali percobaan. BELUM dianalisis — cek
  kemungkinan N+1 query/loop lambat di `Data.gs` kalau masih terjadi.
- Menu "Jurnal Saya" (Guru): alur isi jurnal end-to-end perlu dites user
  langsung (belum ada laporan sukses/gagal terbaru).

Kemungkinan besar SUDAH beres oleh fix `isAktif()` 13 Sept (perlu
konfirmasi user, jangan diasumsikan): jadwal publik kosong, Jadwal Saya
kosong, Jadwal Kelas kosong, filter guru kosong di Admin, dsb. — lihat
`Master_Progress.md` bagian 13 Sept untuk detail lengkap kalau perlu
diulang analisisnya.

## KONTEKS DATA PRODUKSI (dari file Excel `JurnalMengajar_v3__2_.xlsx`, masih berlaku)

13 sheet: `01_CONFIG`, `02_TAHUN_AJARAN`, `03_USER` (40 baris user),
`04_GURU` (44 baris, target 36 guru aktif), `05_KELAS`, `06_SISWA` (~1000
baris), `07_MAPEL`, `08_JAM`, `09_JADWAL` (1278 baris jadwal — sangat
besar), `10_JURNAL`, `11_JURNAL_JAM`, `12_KEHADIRAN`, `13_LOG`.

Perlu diperbaiki manual di spreadsheet (belum dikonfirmasi sudah
dilakukan atau belum): `04_GURU` baris **G004 (SITI SUNDARI)** kolom
`aktif` berisi teks `"AKTIF"` (typo, harus `TRUE`/checkbox). Baris
G039–G042 (guru_id ada, nama kosong) sebaiknya dihapus/diisi.

## CATATAN ARSITEKTUR YANG TETAP BERLAKU (JANGAN diubah tanpa diskusi)

- Kolom `aktif` di SEMUA sheet boleh berisi BOOLEAN (checkbox) ATAU teks
  `"TRUE"`/`"FALSE"` — SELALU pakai `isAktif(val)` dari `Utils.gs`, jangan
  pernah tulis `=== 'TRUE'` atau `!== 'TRUE'` manual lagi di kode manapun
  (baik untuk kolom `aktif` MAUPUN config lain seperti `IZIN_EDIT_JURNAL`
  — pelajaran dari bug 2026-09-15).
- Cache localStorage (`cache.js`/`DataCache`) HANYA untuk data master,
  invalidasi via `DATA_VERSION` + trigger `onEdit`. Cache in-memory
  (`dashboardCache`, `jurnalSayaCache`, dll via `staleWhileRevalidate()`)
  HANYA untuk kesan performa data transaksional, hilang saat reload.
  Endpoint rekap PDF baru (`getRekapJurnalGuru`/`getRekapJurnalKelas`)
  SENGAJA TIDAK pakai cache sama sekali (selalu fetch fresh saat tombol
  Export PDF ditekan) — datanya sekali pakai per-export, tidak perlu
  didaftarkan di `forceSyncData()`.
- `actionGetJadwalPerGuru` (Data.gs) mengizinkan ADMIN (lihat siapa saja)
  ATAU user melihat `guru_id` miliknya sendiri — jangan kembalikan ke
  ADMIN-only.
- Bottom nav & ikon menu pakai Font Awesome Solid (`fa-solid fa-*`), CDN
  di `app.html` — bukan emoji lagi.
- **[BARU 2026-09-15]** `app.html` sekarang juga memuat jsPDF +
  jsPDF-AutoTable dari CDN (cdnjs) — dipakai fungsi `buildRekapPdfGuru`/
  `buildRekapPdfKelas` di `app.js`. Kalau nanti nambah jenis export PDF
  lain, pakai ulang pola `exportPdfCardHtml`/`bindExportPdfCard` yang
  sudah ada, jangan bikin library/pola baru.
- Deploy Apps Script Web App WAJIB "Execute as: Me" + "Who has access:
  Anyone" (bukan "Anyone with Google account").
- Redeploy harus "Manage deployments → Edit → New version", BUKAN "New
  deployment" (supaya URL `/exec` tidak berubah).

## FILE YANG DISERTAKAN DI ZIP INI

`apps-script/*.gs` (6 file — `Jurnal.gs`, `Code.gs`, `TestSuite.gs`
berubah sesi ini; `Auth.gs`, `Data.gs`, `Utils.gs` tidak berubah dari
sesi 13 Sept), semua `frontend/*` (`app.html` dan `js/app.js` berubah
sesi ini, file lain tidak berubah), dan dokumentasi (`Master_Progress.md`
paling lengkap — baca bagian tanggal terbaru dulu, `Panduan_Deploy_dan_Uji.md`,
`Master_Specification.md`).
