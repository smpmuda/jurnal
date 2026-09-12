# MASTER CONTEXT HANDOFF — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Diperbarui: 2026-09-12 (lanjutan — perluasan lazy loading + menu "Jadwal Saya" — TUNTAS)

---

## Status

Dua task berurutan pada tanggal yang sama sudah TUNTAS:

**Task 1 — UI/UX & performance frontend overhaul (10 poin)**: lihat
`Master_Progress.md` bagian "2026-09-12 (UI/UX & performance frontend
overhaul — 10 poin, murni frontend)". Menghasilkan pola
stale-while-revalidate pertama kali di Dashboard Guru (Hari Ini), filter
chip, redesign visual fintech.

**Task 2 — lanjutan, sesi sama hari**: pola stale-while-revalidate dari
Task 1 diminta diperluas ke semua menu transaksional lain (bukan cuma
Dashboard Guru), plus menu baru untuk Guru. Detail lengkap ada di
`Master_Progress.md` bagian "2026-09-12 (lanjutan, sesi sama hari) —
Perluasan lazy loading ke semua menu + menu baru 'Jadwal Saya' (Guru)".
Skenario uji ada di `Panduan_Deploy_dan_Uji.md` bagian **C9.6**.

Ringkasan Task 2:
- Helper generik `staleWhileRevalidate()` ditambahkan, dipakai ulang di
  Jurnal Saya (Guru), Jurnal Kelas (Wali Kelas), Log Aktivitas (Admin) —
  selain Dashboard Guru yang sudah pakai pola ini sejak Task 1.
- **Sengaja TIDAK** diterapkan ke "Jadwal Guru" (Admin) — itu data
  master/jarang berubah, sudah punya pola cache yang benar sendiri
  (`cachedApiCall` + localStorage + `DATA_VERSION`). Menyamakan pola
  akan melanggar arsitektur cache yang sudah disepakati.
- Bug lama ditemukan & diperbaiki: `forceSyncData()` (tombol sinkron
  manual) tidak mengosongkan cache in-memory `adminGuruDataCache`,
  sehingga tombol itu tidak benar-benar memaksa refresh halaman Jadwal
  Guru. Sekarang semua cache in-memory ikut direset.
- Menu baru **"Jadwal Saya"** (route `jadwal-saya`) untuk role GURU —
  jadwal mengajar mingguan milik sendiri dengan tab hari, meniru
  tampilan "Jadwal per Guru" Admin tapi `guru_id` dikunci ke akun
  sendiri. Ditambahkan ke bottom nav Guru (sekarang 4 item).

**File backend (`apps-script/*.gs`) TIDAK diubah** di kedua task —
semua perubahan murni di `frontend/js/app.js` dan `frontend/app.html`.

## Yang Masih Perlu Dilakukan User (bukan tugas Claude)

1. Upload ulang `frontend/js/app.js` (dan `frontend/app.html` kalau belum
   dari Task 1) ke repo `smpmuda/jurnal` (GitHub Pages). Tidak ada file
   backend yang perlu diupload ulang.
2. Uji manual mengikuti `Panduan_Deploy_dan_Uji.md` bagian **C9.5** (Task 1)
   dan **C9.6** (Task 2), ditambah regresi umum C1–C10.
3. Kalau ditemukan area lain yang masih terasa berat, atau menu baru
   lain yang diinginkan, itu task baru — tanyakan dulu detailnya
   (area/menu mana persisnya) sebelum implementasi, seperti pola yang
   sudah dipakai di kedua task ini.

## Catatan Arsitektur yang Tetap Berlaku (JANGAN diubah tanpa diskusi)

- Cache localStorage (`cache.js` / `DataCache`) HANYA untuk data master
  (guru/kelas/mapel/jam/siswa/jadwal-per-guru) — invalidasi lewat
  `DATA_VERSION` + trigger `onEdit`. TIDAK PERNAH untuk data transaksional.
- Cache in-memory (`dashboardCache`, `jurnalSayaCache`, `jurnalKelasCache`,
  `adminLogCache`, via helper `staleWhileRevalidate`) HANYA untuk kesan
  performa data transaksional — hilang saat reload, selalu di-refresh dari
  server segera setelah render, TIDAK PERNAH jadi sumber kebenaran akhir.
- Kalau menambah cache in-memory BARU di masa depan, JANGAN lupa daftarkan
  juga di `forceSyncData()` supaya tombol sinkron manual tetap benar-benar
  memaksa refresh (lihat bug yang baru diperbaiki di atas).
- Data master tetap dikelola langsung di spreadsheet, bukan lewat web.

