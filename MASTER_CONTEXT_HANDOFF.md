# MASTER CONTEXT HANDOFF — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Diperbarui: 2026-09-18 — RESUME UNTUK CHAT BARU

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

**[PALING BARU 2026-09-18 lanjutan]** Setelah lihat prototipe grid
2-kolom, user kasih feedback: terlalu banyak ruang kosong. Diganti jadi
**1 baris penuh per sesi** (bukan 2 kartu berdampingan), dalam baris itu
dibagi kolom kiri 70% (materi+catatan) / kanan 30% (kehadiran), tinggi
baris dihitung DINAMIS dari isi — user minta LANGSUNG diterapkan ke kode
PDF asli (skip prototipe lagi). **SUDAH DIKERJAKAN & SELESAI** — lihat
`Master_Progress.md` bagian **"2026-09-18 (lanjutan) — Layout PDF v2
LANGSUNG diterapkan"**. Hanya `frontend/js/app.js` yang berubah (mesin
PDF, fungsi `_bangunRekapPdfKartu` cs.) — interface `buildRekapPdfGuru`/
`buildRekapPdfKelas` tidak berubah, jadi tidak ada file lain yang perlu
disentuh. Prototipe HTML grid 2-kolom sebelumnya (`prototype_pdf_portrait_grid.html`)
sudah TIDAK relevan lagi (sudah digantikan pendekatan baru ini) — jangan
bingung kalau masih terlihat di folder project, itu cuma riwayat diskusi.

**Belum dites render sungguhan** (di sini tidak ada browser) — hal
PERTAMA yang perlu dicek di chat baru: apakah user sudah coba export PDF
setelah deploy, terutama sesi dengan materi mendekati 700 karakter
(kemungkinan gagal: teks kepotong/tumpang-tindih dengan kolom kehadiran
atau baris sesi berikutnya — kalau ada laporan begini, cek dulu apakah
estimasi `lineH`/`fontSize` di `_pdfUkurBarisSesi` perlu diperbesar
sedikit, sebelum mengubah struktur lagi).

Bagian batas karakter 700/200 (frontend+backend validasi) dari sesi
2026-09-18 sebelumnya (di atas bagian ini) TIDAK berubah, masih berlaku.

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

1. Timpa `frontend/js/app.js` di GitHub Pages (satu-satunya file yang
   berubah untuk redesain layout PDF v2 — portrait, 1 baris/sesi, 70/30).
2. Test export PDF di ketiga tempat (Jurnal Saya, Jurnal Kelas, Admin→Jurnal
   Guru): cek portrait A4 margin sempit, header rata tengah, tiap sesi 1
   baris penuh (bukan 2 kartu berdampingan), kolom kiri materi+catatan /
   kolom kanan kehadiran, dan yang PALING PENTING — coba minimal 1 sesi
   dengan materi mendekati 700 karakter untuk pastikan teksnya tidak
   terpotong atau tumpang tindih.
3. Kalau belum sempat deploy update sebelumnya di hari yang sama (batas
   karakter 700/200): timpa juga `apps-script/Jurnal.gs`.
4. Kalau belum deploy update 2026-09-17 (fix nama siswa + fix test palsu):
   timpa juga `apps-script/TestSuite.gs`.
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
