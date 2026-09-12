// ============================================================
// app.js — Router & Semua Tampilan
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
// Versi: rombakan performa + fitur baru (jam 1-9 selalu tampil,
// grid form, skema kehadiran hanya-tidak-hadir, pagination,
// Jadwal Kelas, admin filter & lihat jadwal guru)
// ============================================================

if (!Auth.requireLogin()) { /* redirect sudah jalan */ }

var session = Auth.getSession();
var roles = Auth.getRoles();
var activeRole = roles[0]; // role aktif saat ini (untuk switching tampilan)
var appConfig = null;

var $main = document.getElementById('mainContent');
var $nav  = document.getElementById('bottomNav');
var $roleTabs = document.getElementById('roleTabs');

// ── Riwayat navigasi dalam-app (BUKAN browser history) ──────────
// Dipakai goBack() supaya tombol "Kembali" selalu balik ke halaman
// sebelumnya DI DALAM APLIKASI, bukan ke browser history (yang bisa
// berisi halaman login.html sebelum redirect ke app.html).
var navStack = [];
var currentRoute = null;
var currentParams = null;

// ── State cache sederhana ──────────────────────────────────────
var STATE = {
  jadwalHariIni: null,
  jurnalSaya: null,
  kelasList: null,
  guruList: null,
  mapelList: null,
  waliKelasId: (session.kelas_wali ? session.kelas_wali.kelas_id : null),
};

// ── Init ─────────────────────────────────────────────────────

function init() {
  document.getElementById('hdrUser').textContent = session.nama + ' · ' + roleLabel(activeRole);

  API.call('getConfig', {}, 'GET', false).then(function(res) {
    if (res.ok) {
      appConfig = res.data;
      document.getElementById('hdrAppName').textContent = appConfig.nama_aplikasi;
      // Cek versi data master (guru/kelas/siswa/mapel/jadwal). Kalau beda
      // dari yang tersimpan di perangkat ini, cache lokal dibersihkan
      // otomatis — data akan di-fetch ulang secara lazy saat dibutuhkan.
      DataCache.syncIfNeeded(appConfig.data_version);
    }
    setupRoleTabs();
    setupBottomNav();
    navigate(defaultRouteFor(activeRole));
  });
}

// [BARU] Cache data master (guru/kelas/mapel/jam/siswa/jadwal-per-guru) di
// localStorage perangkat ini. HANYA dipakai untuk data yang TIDAK mengandung
// status transaksional (sudah_diisi/konflik dsb.) — lihat catatan di cache.js.
function cachedApiCall(cacheKey, action, params) {
  var cached = DataCache.get(cacheKey);
  if (cached !== null) return Promise.resolve({ ok: true, data: cached });
  return API.call(action, params, 'GET').then(function(res) {
    if (res.ok) DataCache.set(cacheKey, res.data);
    return res;
  });
}

// Tombol 🔄 di header — paksa sinkronisasi kapan saja, dipakai SEMUA role.
function forceSyncData() {
  var $btn = document.getElementById('btnSync');
  if ($btn) $btn.classList.add('syncing');
  document.querySelectorAll('.refresh-block-btn').forEach(function(b) { b.classList.add('syncing'); });

  API.call('getConfig', {}, 'GET', false).then(function(res) {
    // Reset semua cache in-memory (BUKAN localStorage — itu ditangani
    // DataCache.clearAll() di bawah). Tanpa ini, view yang sedang tidak
    // aktif tetap menyimpan data lama walau tombol ini ditekan.
    dashboardCache = {};
    jurnalSayaCache = {};
    jurnalKelasCache = {};
    adminLogCache = {};
    adminGuruDataCache = null;
    jadwalSayaGuruCache = null;
    if (res.ok) {
      appConfig = res.data;
      DataCache.clearAll();
      DataCache.setLocalVersion(appConfig.data_version || 0);
    } else {
      DataCache.clearAll(); // tetap bersihkan meski getConfig gagal, biar aman
    }
    if ($btn) $btn.classList.remove('syncing');
    showToast('Data berhasil disinkronkan ✓');
    // Muat ulang halaman yang sedang dibuka supaya langsung pakai data baru
    navigate(currentRoute || defaultRouteFor(activeRole), currentParams || {}, { isBack: true });
  });
}

// [BARU] Tombol refresh berbentuk BLOK besar (bukan ikon kecil) — dipasang
// di halaman-halaman utama tiap role (Dashboard, Jurnal Kelas, Admin
// Beranda) supaya jelas terlihat dan mudah disentuh di HP.
function refreshBlockButtonHtml() {
  return '<button class="refresh-block-btn" onclick="forceSyncData()">'
    + '<span class="icon" aria-hidden="true"><i class="fa-solid fa-rotate"></i></span> Perbarui Data</button>';
}

function roleLabel(r) {
  return { ADMIN: 'Admin', GURU: 'Guru', WALI_KELAS: 'Wali Kelas' }[r] || r;
}

function defaultRouteFor(role) {
  if (role === 'GURU') return 'dashboard';
  if (role === 'WALI_KELAS') return 'jurnal-kelas';
  if (role === 'ADMIN') return 'admin-home';
  return 'dashboard';
}

// ── Role Tabs (jika multi-role) ────────────────────────────────

function setupRoleTabs() {
  if (roles.length <= 1) return;
  $roleTabs.style.display = 'flex';
  $roleTabs.innerHTML = roles.map(function(r) {
    return '<button class="role-tab' + (r === activeRole ? ' active' : '') + '" data-role="' + r + '">'
      + roleLabel(r) + '</button>';
  }).join('');

  $roleTabs.querySelectorAll('.role-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeRole = btn.dataset.role;
      document.getElementById('hdrUser').textContent = session.nama + ' · ' + roleLabel(activeRole);
      $roleTabs.querySelectorAll('.role-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      setupBottomNav();
      navigate(defaultRouteFor(activeRole));
    });
  });
}

// ── Bottom Nav (per role, ringkas) ─────────────────────────────

function setupBottomNav() {
  var items = [];
  if (activeRole === 'GURU') {
    items = [
      { route: 'dashboard',          icon: 'fa-solid fa-house',          label: 'Hari Ini' },
      { route: 'jurnal-saya',        icon: 'fa-solid fa-book-bookmark',  label: 'Jurnal Saya' },
      { route: 'jadwal-saya',        icon: 'fa-solid fa-calendar-days',  label: 'Jadwal Saya' },
      { route: 'jadwal-kelas-lihat', icon: 'fa-solid fa-chalkboard',     label: 'Jadwal Kelas' },
    ];
  } else if (activeRole === 'WALI_KELAS') {
    items = [
      { route: 'jurnal-kelas',       icon: 'fa-solid fa-book-open-reader', label: 'Jurnal Kelas' },
      { route: 'jadwal-kelas-lihat', icon: 'fa-solid fa-chalkboard',       label: 'Jadwal Kelas' },
    ];
  } else if (activeRole === 'ADMIN') {
    items = [
      { route: 'admin-home',         icon: 'fa-solid fa-house',              label: 'Beranda' },
      { route: 'admin-jurnal',       icon: 'fa-solid fa-user-pen',           label: 'Jurnal Guru' },
      { route: 'admin-guru',         icon: 'fa-solid fa-user-clock',         label: 'Jadwal Guru' },
      { route: 'admin-jadwal-kelas', icon: 'fa-solid fa-chalkboard',         label: 'Jadwal Kelas' },
      { route: 'admin-log',          icon: 'fa-solid fa-clock-rotate-left',  label: 'Log Aktivitas' },
    ];
  }

  if (items.length <= 1) {
    $nav.style.display = 'none';
    document.documentElement.style.setProperty('--bottom-nav-height', '0px');
    return;
  }

  $nav.style.display = 'flex';
  $nav.innerHTML = items.map(function(it) {
    return '<button class="nav-item" data-route="' + it.route + '" aria-label="' + esc(it.label) + '">'
      + '<span class="nav-icon"><i class="' + it.icon + '" aria-hidden="true"></i></span>'
      + '<span class="nav-label">' + it.label + '</span></button>';
  }).join('');

  $nav.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.addEventListener('click', function() { navigate(btn.dataset.route); });
  });

  measureBottomNavHeight();
}

// [BARU] Ukur tinggi bottom-nav SESUNGGUHNYA (bukan tebakan) dan simpan ke
// CSS var --bottom-nav-height, dipakai .container untuk padding-bottom.
// Ini akar perbaikan bug "bottom nav menutupi content" — sebelumnya pakai
// angka tetap (100px) yang bisa meleset di perangkat dengan safe-area
// berbeda (notch/home-indicator).
function measureBottomNavHeight() {
  requestAnimationFrame(function() {
    var h = ($nav && $nav.style.display !== 'none') ? $nav.offsetHeight : 0;
    document.documentElement.style.setProperty('--bottom-nav-height', h + 'px');
  });
}

window.addEventListener('resize', measureBottomNavHeight);
window.addEventListener('orientationchange', measureBottomNavHeight);

function setActiveNav(route) {
  $nav.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
}

// ── Router ───────────────────────────────────────────────────

function navigate(route, params, opts) {
  opts = opts || {};
  params = params || {};

  // Simpan halaman saat ini ke stack SEBELUM pindah (kecuali saat ini
  // sendiri adalah hasil dari goBack/replace, supaya stack tidak muter balik)
  if (!opts.isBack && currentRoute) {
    navStack.push({ route: currentRoute, params: currentParams });
    if (navStack.length > 30) navStack.shift();
  }
  currentRoute = route;
  currentParams = params;

  setActiveNav(route);

  var routes = {
    'dashboard':          viewDashboard,
    'jurnal-saya':        viewJurnalSaya,
    'jadwal-saya':        viewJadwalSayaGuru,
    'jurnal-form':        viewJurnalForm,
    'jurnal-detail':      viewJurnalDetail,
    'jurnal-edit':        viewJurnalEdit,
    'jurnal-kelas':       viewJurnalKelas,
    'jadwal-kelas-lihat': viewJadwalKelasLihat,
    'admin-home':         viewAdminHome,
    'admin-jurnal':       viewAdminJurnal,
    'admin-guru':         viewAdminGuru,
    'admin-log':          viewAdminLog,
    'admin-jadwal-kelas': viewJadwalKelasLihat,
  };

  if (routes[route]) routes[route](params);
  else $main.innerHTML = '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="empty-text">Halaman tidak ditemukan</div></div>';
}

// Tombol "Kembali" di semua form/detail SELALU pakai fungsi ini,
// TIDAK PERNAH pakai history.back() (itu penyebab bug kembali ke login).
function goBack(fallbackRoute, fallbackParams) {
  var prev = navStack.pop();
  if (prev) navigate(prev.route, prev.params, { isBack: true });
  else navigate(fallbackRoute || defaultRouteFor(activeRole), fallbackParams || {}, { isBack: true });
}

// ── Helper: loading, skeleton & toast ───────────────────────────

// [BARU] Kutipan ringan ditampilkan sambil menunggu data pertama kali
// (belum ada cache sama sekali) — supaya terasa "hidup", bukan sekadar
// ikon spinner kosong.
var LOADING_QUOTES = [
  'Menyiapkan data terbaru untuk Anda...',
  'Sabar sebentar, hampir selesai...',
  'Sedang mengambil jadwal terkini...',
  'Menata data supaya rapi dilihat...',
  'Tunggu sebentar, hampir siap...',
];

function pickLoadingQuote() {
  return LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)];
}

function showLoading(msg) {
  $main.innerHTML = '<div class="loading-box"><div class="spinner"></div><br>' + (msg || pickLoadingQuote()) + '</div>';
}

// [BARU] Skeleton kartu (dipakai saat BENAR-BENAR belum ada cache sama
// sekali — first load) — terasa lebih hidup dibanding spinner polos, dan
// memberi gambaran bentuk konten yang akan muncul.
function skeletonListHtml(quote, count) {
  count = count || 3;
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="skeleton-card"><div class="skeleton-line w60"></div><div class="skeleton-line w35"></div></div>';
  }
  html += '<div class="loading-quote">' + esc(quote || pickLoadingQuote()) + '</div>';
  return html;
}

function showToast(msg, isError) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(function() { t.className = 'toast'; }, 2600);
}

function fmtTanggalIndo(tanggalStr) {
  var bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var d = new Date(tanggalStr + 'T00:00:00');
  var hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
  return hari + ', ' + d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function hariIniIndo() {
  var days = ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
  return days[new Date().getDay()];
}

function capitalizeHari(h) {
  h = String(h || '').toLowerCase();
  return h.charAt(0).toUpperCase() + h.slice(1);
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function errorBox(msg) {
  return '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">' + esc(msg || 'Terjadi kesalahan') + '</div></div>';
}

// ── Helper: Pagination (dipakai jurnal-saya, admin-jurnal, admin-log) ──

function paginationHtml(pageInfo) {
  if (!pageInfo || pageInfo.totalPages <= 1) return '';
  return '<div class="pagination-bar">'
    + '<button class="page-btn" id="pgPrev"' + (pageInfo.page <= 1 ? ' disabled' : '') + '>‹ Sebelumnya</button>'
    + '<span class="page-info">Hal ' + pageInfo.page + ' / ' + pageInfo.totalPages + ' · ' + pageInfo.totalItems + ' data</span>'
    + '<button class="page-btn" id="pgNext"' + (pageInfo.page >= pageInfo.totalPages ? ' disabled' : '') + '>Selanjutnya ›</button>'
    + '</div>';
}

function bindPagination(pageInfo, onNavigate) {
  if (!pageInfo || pageInfo.totalPages <= 1) return;
  var prev = document.getElementById('pgPrev');
  var next = document.getElementById('pgNext');
  if (prev) prev.addEventListener('click', function() { if (pageInfo.page > 1) onNavigate(pageInfo.page - 1); });
  if (next) next.addEventListener('click', function() { if (pageInfo.page < pageInfo.totalPages) onNavigate(pageInfo.page + 1); });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Dashboard Guru (Jadwal Hari Ini / Tanggal Pilihan)
// ══════════════════════════════════════════════════════════════

var dashTanggal = todayStr();

// [BARU — poin 8] Cache IN-MEMORY (bukan localStorage/DataCache) per tanggal,
// hilang saat reload halaman. Tujuannya murni kesan performa: begitu guru
// balik ke tanggal yang baru saja dilihat (mis. Hari Ini -> tanggal lain ->
// Hari Ini lagi), tampilan langsung terisi dari data terakhir alih-alih
// skeleton kosong, SAMBIL tetap selalu fetch ulang ke server di background
// karena status "sudah_diisi"/konflik transaksional dan bisa berubah kapan
// saja (guru lain, edit dari device lain, dst). Data lama TIDAK PERNAH jadi
// sumber kebenaran akhir — hanya dipakai sebagai placeholder sementara.
var dashboardCache = {};

function viewDashboard(params) {
  if (params.tanggal) dashTanggal = params.tanggal;
  var tanggalDiminta = dashTanggal;
  var cached = dashboardCache[tanggalDiminta];

  if (cached) {
    renderDashboardHtml(cached, true);
  } else {
    $main.innerHTML = refreshBlockButtonHtml() + skeletonListHtml('Menyiapkan jadwal hari ini...');
  }

  API.call('getJadwalHariIni', { tanggal: tanggalDiminta }, 'GET').then(function(res) {
    // Kalau user sudah pindah ke tanggal lain sebelum respons ini datang,
    // buang saja hasilnya — render tanggal itu sudah ditangani request-nya sendiri.
    if (dashTanggal !== tanggalDiminta) return;

    if (!res.ok) { if (!cached) $main.innerHTML = errorBox(res.error); return; }

    var d = res.data;
    STATE.jadwalHariIni = d;
    dashboardCache[tanggalDiminta] = d;
    renderDashboardHtml(d, false);
  });
}

function renderDashboardHtml(d, updating) {
  var html = '';
  html += refreshBlockButtonHtml();
  html += dateBarHtml(dashTanggal, 'dashboard', true);
  if (updating) {
    html += '<div class="quiet-sync-note"><span class="dot"></span>Memperbarui data terbaru…</div>';
  }
  html += '<div class="sec-title">Jadwal Mengajar — ' + fmtTanggalIndo(dashTanggal) + '</div>';

  if (d.jadwal.length === 0) {
    html += '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-inbox"></i></div><div class="empty-text">Tidak ada jam pelajaran pada hari ini</div></div>';
  } else {
    d.jadwal.forEach(function(j) {
      html += jadwalCardHtml(j);
    });
  }

  $main.innerHTML = html;
  bindDateBar('dashboard');
  bindJadwalCards();
}

function dateBarHtml(tanggal, route, showJadwalKelasLink) {
  var isHariIni = tanggal === todayStr();
  var html = '<div class="date-bar">'
    + '<input type="date" id="datePicker" value="' + tanggal + '">'
    + '<button class="date-today-btn" id="btnToday">Hari Ini</button>'
    + '</div>';
  html += '<div class="hint-text">'
    + (isHariIni ? 'Menampilkan data hari ini.' : 'Menampilkan data ' + fmtTanggalIndo(tanggal) + '.')
    + ' Pilih tanggal lain di atas untuk melihat data pada tanggal tersebut.</div>';
  if (showJadwalKelasLink) {
    html += '<div class="quick-link-row"><a class="quick-link" onclick="navigate(\'jadwal-kelas-lihat\')"><i class="fa-solid fa-chalkboard"></i> Lihat Jadwal Kelas Lain</a></div>';
  }
  return html;
}

function bindDateBar(route) {
  var picker = document.getElementById('datePicker');
  var btnToday = document.getElementById('btnToday');
  if (picker) {
    picker.addEventListener('change', function() {
      navigate(route, { tanggal: picker.value, kelas_id: STATE._kelasIdCtx });
    });
  }
  if (btnToday) {
    btnToday.addEventListener('click', function() {
      navigate(route, { tanggal: todayStr(), kelas_id: STATE._kelasIdCtx });
    });
  }
}

function jadwalCardHtml(j) {
  if (j.tidak_mengajar) {
    return '<div class="jadwal-card kosong">'
      + '<div class="jadwal-top"><div class="jadwal-info">'
      + '<div class="jadwal-mapel muted">' + esc(j.jam_label) + ' — Tidak Mengajar</div>'
      + '</div></div></div>';
  }

  var cls = j.sudah_diisi ? 'done' : (j.konflik ? 'konflik' : '');
  var badge = j.sudah_diisi
    ? '<span class="badge badge-done">✓ Sudah diisi</span>'
    : '<span class="badge badge-todo">Belum diisi</span>';

  var html = '<div class="jadwal-card ' + cls + '" data-blok=\'' + JSON.stringify(j).replace(/'/g, "&apos;") + '\'>';
  html += '<div class="jadwal-top">';
  html += '<div class="jadwal-info">';
  html += '<div class="jadwal-mapel">' + esc(j.nama_mapel) + '</div>';
  html += '<div class="jadwal-meta">' + esc(j.nama_kelas) + ' · ' + esc(j.jam_label) + '</div>';
  html += '</div>' + badge;
  html += '</div>';

  if (j.konflik) {
    html += '<div class="jadwal-warn">⚠ ' + esc(j.konflik_info) + '</div>';
  }

  html += '</div>';
  return html;
}

function bindJadwalCards() {
  document.querySelectorAll('.jadwal-card:not(.kosong)').forEach(function(card) {
    card.addEventListener('click', function() {
      var data = JSON.parse(card.dataset.blok.replace(/&apos;/g, "'"));
      if (data.sudah_diisi) {
        navigate('jurnal-detail', { jurnal_id: data.jurnal_id });
      } else {
        navigate('jurnal-form', { blok: data });
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Form Isi Jurnal (grid 2 kolom, jam bisa pilih lebih banyak,
// kehadiran default HADIR, hanya kirim yang TIDAK hadir)
// ══════════════════════════════════════════════════════════════

function viewJurnalForm(params) {
  var blok = params.blok;
  if (!blok) { navigate('dashboard'); return; }

  showLoading('Memuat data siswa & jam...');

  Promise.all([
    cachedApiCall('siswa_' + blok.kelas_id, 'getSiswa', { kelas_id: blok.kelas_id }),
    cachedApiCall('jam', 'getJam', {}),
  ]).then(function(results) {
    var resSiswa = results[0], resJam = results[1];
    if (!resSiswa.ok) { $main.innerHTML = errorBox(resSiswa.error); return; }
    if (!resJam.ok) { $main.innerHTML = errorBox(resJam.error); return; }

    var siswa = resSiswa.data;
    var maxJam = (appConfig && appConfig.jam_maks && appConfig.jam_maks[blok.hari])
      ? appConfig.jam_maks[blok.hari] : 9;
    var jamOpsi = resJam.data.filter(function(j) { return j.nomor <= maxJam; });
    var jamTerpilih = {};
    (blok.jam_ids || []).forEach(function(id) { jamTerpilih[id] = true; });

    var html = '<button class="btn-back" onclick="goBack(\'dashboard\', {tanggal:\'' + blok.tanggal + '\'})">← Kembali</button>';
    html += '<div class="form-box">';

    html += '<div class="form-grid-2">';
    html += '<div class="form-group"><span class="form-label">Kelas</span>';
    html += '<div class="form-readonly">' + esc(blok.nama_kelas) + '</div></div>';
    html += '<div class="form-group"><span class="form-label">Tanggal</span>';
    html += '<div class="form-readonly">' + fmtTanggalIndo(blok.tanggal) + '</div></div>';
    html += '</div>';

    html += '<div class="form-group"><span class="form-label">Mapel</span>';
    html += '<div class="form-readonly">' + esc(blok.nama_mapel) + '</div></div>';

    html += '<div class="form-group"><span class="form-label">Jam Pelajaran (bisa pilih lebih dari 1)</span>';
    html += '<div class="jam-check-row" id="jamCheckRow">';
    jamOpsi.forEach(function(j) {
      var sel = jamTerpilih[j.jam_id] ? ' selected' : '';
      html += '<button type="button" class="jam-check' + sel + '" data-jam="' + j.jam_id + '">Jam ' + j.nomor + '</button>';
    });
    html += '</div></div>';

    html += '<div class="form-group"><span class="form-label">Ringkasan Kegiatan *</span>';
    html += '<textarea id="ringkasan" rows="3" placeholder="Contoh: Algoritma dan flowchart dasar" required></textarea></div>';

    html += '<div class="form-group"><span class="form-label">Catatan (opsional)</span>';
    html += '<textarea id="catatan" rows="2" placeholder="Catatan tambahan..."></textarea></div>';

    html += '<div class="form-group"><span class="form-label">Kehadiran (' + siswa.length + ' siswa, default Hadir — klik yang tidak hadir)</span>';
    html += '<div id="siswaList">';
    if (siswa.length === 0) {
      html += '<div class="empty" style="padding:20px"><div class="empty-text">Belum ada data siswa untuk kelas ini</div></div>';
    } else {
      siswa.forEach(function(s) { html += siswaRowHtml(s); });
    }
    html += '</div></div>';

    html += '<button class="btn-primary" id="btnSimpan">Simpan Jurnal</button>';
    html += '<div class="form-bottom-space"></div>';
    html += '</div>';

    $main.innerHTML = html;

    bindJamCheckboxes();
    bindStatusButtons();
    bindSimpanJurnal(blok);
  });
}

function siswaRowHtml(s) {
  return '<div class="siswa-row" data-nis="' + s.nis + '" data-status="HADIR">'
    + '<div><div class="siswa-nama">' + esc(s.nama) + '</div><div class="siswa-nis">' + esc(s.nis) + '</div></div>'
    + '<div class="status-btns">'
    + '<button type="button" class="status-btn active-h" data-status="HADIR">H</button>'
    + '<button type="button" class="status-btn" data-status="SAKIT">S</button>'
    + '<button type="button" class="status-btn" data-status="IZIN">I</button>'
    + '<button type="button" class="status-btn" data-status="ALPA">A</button>'
    + '</div></div>';
}

function bindJamCheckboxes() {
  document.querySelectorAll('.jam-check').forEach(function(btn) {
    btn.addEventListener('click', function() {
      btn.classList.toggle('selected');
    });
  });
}

var statusClassMap = { HADIR: 'active-h', SAKIT: 'active-s', IZIN: 'active-i', ALPA: 'active-a' };

function bindStatusButtons() {
  document.querySelectorAll('.siswa-row').forEach(function(row) {
    row.querySelectorAll('.status-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        row.dataset.status = btn.dataset.status;
        row.querySelectorAll('.status-btn').forEach(function(b) {
          b.className = 'status-btn';
        });
        btn.className = 'status-btn ' + statusClassMap[btn.dataset.status];
      });
    });
  });
}

// Ambil hanya siswa yang BUKAN HADIR — sesuai skema baru (database ringan)
function kumpulkanTidakHadir() {
  return Array.from(document.querySelectorAll('.siswa-row'))
    .filter(function(row) { return row.dataset.status !== 'HADIR'; })
    .map(function(row) { return { nis: row.dataset.nis, status: row.dataset.status, keterangan: '' }; });
}

function bindSimpanJurnal(blok) {
  document.getElementById('btnSimpan').addEventListener('click', function() {
    var jamIds = Array.from(document.querySelectorAll('.jam-check.selected')).map(function(b) { return b.dataset.jam; });
    var ringkasan = document.getElementById('ringkasan').value.trim();
    var catatan = document.getElementById('catatan').value.trim();

    if (jamIds.length === 0) { showToast('Pilih minimal 1 jam', true); return; }
    if (ringkasan.length < 5) { showToast('Ringkasan kegiatan wajib diisi (min 5 karakter)', true); return; }

    var tidakHadir = kumpulkanTidakHadir();

    var btn = document.getElementById('btnSimpan');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    API.call('createJurnal', {
      tanggal: blok.tanggal,
      kelas_id: blok.kelas_id,
      mapel_id: blok.mapel_id,
      jam_ids: jamIds,
      ringkasan_kegiatan: ringkasan,
      catatan: catatan,
      kehadiran: tidakHadir
    }, 'POST').then(function(res) {
      if (!res.ok) {
        showToast(res.error || 'Gagal menyimpan', true);
        btn.disabled = false;
        btn.textContent = 'Simpan Jurnal';
        return;
      }
      showToast('Jurnal berhasil disimpan ✓');
      navigate('dashboard', { tanggal: blok.tanggal }, { isBack: true });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Detail Jurnal (sudah diisi) — pakai field j.tidak_hadir
// ══════════════════════════════════════════════════════════════

function viewJurnalDetail(params) {
  showLoading('Memuat detail jurnal...');

  API.call('getDetailJurnal', { jurnal_id: params.jurnal_id }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var j = res.data;

    var html = '<button class="btn-back" onclick="goBack()">← Kembali</button>';
    html += '<div class="form-box">';

    html += '<div class="form-grid-2">';
    html += '<div class="form-group"><span class="form-label">Kelas</span>';
    html += '<div class="form-readonly">' + esc(j.nama_kelas) + '</div></div>';
    html += '<div class="form-group"><span class="form-label">Tanggal</span>';
    html += '<div class="form-readonly">' + fmtTanggalIndo(j.tanggal) + '</div></div>';
    html += '</div>';

    html += '<div class="form-group"><span class="form-label">Mapel & Jam</span>';
    html += '<div class="form-readonly">' + esc(j.nama_mapel) + ' · ' + esc(j.jam_label) + '</div></div>';

    html += '<div class="form-group"><span class="form-label">Ringkasan Kegiatan</span>';
    html += '<div class="form-readonly" style="font-weight:400">' + esc(j.ringkasan) + '</div></div>';

    if (j.catatan) {
      html += '<div class="form-group"><span class="form-label">Catatan</span>';
      html += '<div class="form-readonly" style="font-weight:400">' + esc(j.catatan) + '</div></div>';
    }

    var rk = j.rekap_kehadiran;
    html += '<div class="form-group"><span class="form-label">Kehadiran (' + rk.total + ' siswa)</span>';
    html += '<div class="pill-row">';
    html += '<span class="pill pill-g">' + rk.hadir + ' Hadir</span>';
    if (rk.sakit) html += '<span class="pill pill-s">' + rk.sakit + ' Sakit</span>';
    if (rk.izin) html += '<span class="pill pill-i">' + rk.izin + ' Izin</span>';
    if (rk.alpa) html += '<span class="pill pill-a">' + rk.alpa + ' Alpa</span>';
    html += '</div></div>';

    if (j.tidak_hadir.length > 0) {
      html += '<div class="form-group"><span class="form-label">Tidak Hadir</span>';
      j.tidak_hadir.forEach(function(k) {
        html += '<div class="siswa-row"><div><div class="siswa-nama">' + esc(k.nama) + '</div>'
          + '<div class="siswa-nis">' + esc(k.keterangan || '') + '</div></div>'
          + '<span class="pill pill-' + k.status.charAt(0).toLowerCase() + '">' + esc(k.status) + '</span></div>';
      });
      html += '</div>';
    }

    if (j.bisa_edit && (Auth.hasRole('GURU') || Auth.hasRole('ADMIN'))) {
      html += '<button class="btn-secondary" id="btnEdit">Edit Jurnal Ini</button>';
    }

    html += '<div class="form-bottom-space"></div>';
    html += '</div>';
    $main.innerHTML = html;

    var btnEdit = document.getElementById('btnEdit');
    if (btnEdit) {
      btnEdit.addEventListener('click', function() {
        navigate('jurnal-edit', { jurnal: j });
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Edit Jurnal (ringkasan, catatan, kehadiran — jam & kelas/mapel tetap)
// Pakai j.tidak_hadir sebagai sumber status existing.
// ══════════════════════════════════════════════════════════════

function viewJurnalEdit(params) {
  var j = params.jurnal;
  if (!j) { navigate('jurnal-saya'); return; }

  showLoading('Memuat data siswa...');

  cachedApiCall('siswa_' + j.kelas_id, 'getSiswa', { kelas_id: j.kelas_id }).then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var siswa = res.data;

    // Peta status kehadiran existing per NIS (hanya berisi yang TIDAK hadir)
    var khMap = {};
    (j.tidak_hadir || []).forEach(function(k) { khMap[String(k.nis)] = k.status; });

    var html = '<button class="btn-back" onclick="goBack()">← Batal, kembali ke detail</button>';
    html += '<div class="form-box">';

    html += '<div class="form-grid-2">';
    html += '<div class="form-group"><span class="form-label">Kelas</span>';
    html += '<div class="form-readonly">' + esc(j.nama_kelas) + '</div></div>';
    html += '<div class="form-group"><span class="form-label">Tanggal</span>';
    html += '<div class="form-readonly">' + fmtTanggalIndo(j.tanggal) + '</div></div>';
    html += '</div>';

    html += '<div class="form-group"><span class="form-label">Mapel & Jam</span>';
    html += '<div class="form-readonly">' + esc(j.nama_mapel) + ' · ' + esc(j.jam_label) + '</div>';
    html += '<div style="font-size:11px;color:var(--gray-400);margin-top:6px">ℹ Tanggal, kelas, mapel, dan jam tidak bisa diubah. Buat jurnal baru jika salah sesi.</div></div>';

    html += '<div class="form-group"><span class="form-label">Ringkasan Kegiatan *</span>';
    html += '<textarea id="ringkasan" rows="3" required>' + esc(j.ringkasan) + '</textarea></div>';

    html += '<div class="form-group"><span class="form-label">Catatan (opsional)</span>';
    html += '<textarea id="catatan" rows="2">' + esc(j.catatan || '') + '</textarea></div>';

    html += '<div class="form-group"><span class="form-label">Kehadiran (' + siswa.length + ' siswa)</span>';
    html += '<div id="siswaList">';
    if (siswa.length === 0) {
      html += '<div class="empty" style="padding:20px"><div class="empty-text">Belum ada data siswa untuk kelas ini</div></div>';
    } else {
      siswa.forEach(function(s) {
        html += siswaRowHtmlWithStatus(s, khMap[String(s.nis)] || 'HADIR');
      });
    }
    html += '</div></div>';

    html += '<button class="btn-primary" id="btnUpdate">Simpan Perubahan</button>';
    html += '<div class="form-bottom-space"></div>';
    html += '</div>';

    $main.innerHTML = html;

    bindStatusButtons();
    bindUpdateJurnal(j.jurnal_id);
  });
}

function siswaRowHtmlWithStatus(s, status) {
  var cls = { HADIR: 'active-h', SAKIT: 'active-s', IZIN: 'active-i', ALPA: 'active-a' };
  var btn = function(st, label) {
    return '<button type="button" class="status-btn' + (status === st ? ' ' + cls[st] : '') + '" data-status="' + st + '">' + label + '</button>';
  };
  return '<div class="siswa-row" data-nis="' + s.nis + '" data-status="' + status + '">'
    + '<div><div class="siswa-nama">' + esc(s.nama) + '</div><div class="siswa-nis">' + esc(s.nis) + '</div></div>'
    + '<div class="status-btns">' + btn('HADIR','H') + btn('SAKIT','S') + btn('IZIN','I') + btn('ALPA','A') + '</div></div>';
}

function bindUpdateJurnal(jurnalId) {
  document.getElementById('btnUpdate').addEventListener('click', function() {
    var ringkasan = document.getElementById('ringkasan').value.trim();
    var catatan = document.getElementById('catatan').value.trim();

    if (ringkasan.length < 5) { showToast('Ringkasan kegiatan wajib diisi (min 5 karakter)', true); return; }

    var tidakHadir = kumpulkanTidakHadir();

    var btn = document.getElementById('btnUpdate');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    API.call('updateJurnal', {
      jurnal_id: jurnalId,
      ringkasan_kegiatan: ringkasan,
      catatan: catatan,
      kehadiran: tidakHadir
    }, 'POST').then(function(res) {
      if (!res.ok) {
        showToast(res.error || 'Gagal menyimpan perubahan', true);
        btn.disabled = false;
        btn.textContent = 'Simpan Perubahan';
        return;
      }
      showToast('Perubahan berhasil disimpan ✓');
      navigate('jurnal-detail', { jurnal_id: jurnalId }, { isBack: true });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Jurnal Saya (Riwayat Guru) — PAKAI PAGINATION
// ══════════════════════════════════════════════════════════════

// [BARU] Helper generik "stale-while-revalidate" IN-MEMORY (BUKAN
// localStorage/DataCache) — dipakai semua menu berisi data TRANSAKSIONAL
// (status bisa berubah live) yang tetap ingin terasa instan saat dibuka
// ulang/difilter ulang: Hari Ini, Jurnal Saya, Jurnal Kelas (Wali Kelas),
// Log (Admin). Data lama HANYA placeholder sementara — selalu di-refresh
// dari server segera setelah render dan TIDAK PERNAH jadi sumber
// kebenaran akhir (beda sifat dari cache master data di cache.js).
//   store          objek in-memory biasa {}, key -> data terakhir
//   key            string unik utk kombinasi state saat ini (tanggal/hal/filter)
//   fetchFn        function() -> Promise<{ok, data, error}>
//   renderFn       function(data, updating) — bangun & pasang HTML + binding
//   isStillCurrent function() -> boolean, dicek SETELAH fetch selesai supaya
//                  respons yang telat untuk state lama tidak menimpa
//                  tampilan state yang sedang aktif sekarang (guard race-condition)
function staleWhileRevalidate(store, key, fetchFn, renderFn, isStillCurrent) {
  var cached = store[key];
  if (cached) renderFn(cached, true);

  fetchFn().then(function(res) {
    if (!isStillCurrent()) return;
    if (!res.ok) { if (!cached) $main.innerHTML = errorBox(res.error); return; }
    store[key] = res.data;
    renderFn(res.data, false);
  });

  return !!cached;
}

var jurnalSayaPage = 1;
var jurnalSayaBulan = '';
var jurnalSayaCache = {}; // in-memory per "bulan_page" — lihat staleWhileRevalidate
var BULAN_NAMA = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function viewJurnalSaya(params) {
  if (params.page) jurnalSayaPage = params.page;
  else jurnalSayaPage = 1;

  var reqBulan = jurnalSayaBulan;
  var reqPage = jurnalSayaPage;
  var key = reqBulan + '_' + reqPage;

  if (!jurnalSayaCache[key]) $main.innerHTML = skeletonListHtml('Mengambil riwayat jurnal Anda...');

  staleWhileRevalidate(
    jurnalSayaCache, key,
    function() {
      var apiParams = { page: reqPage };
      if (reqBulan) apiParams.bulan = reqBulan;
      return API.call('getJurnalSaya', apiParams, 'GET');
    },
    function(d, updating) { renderJurnalSayaHtml(d, updating); },
    function() { return jurnalSayaBulan === reqBulan && jurnalSayaPage === reqPage; }
  );
}

function renderJurnalSayaHtml(d, updating) {
  var html = '<div class="sec-title">Riwayat Jurnal Saya (' + d.totalItems + ')</div>';
  if (updating) html += '<div class="quiet-sync-note"><span class="dot"></span>Memperbarui data terbaru…</div>';
  html += '<div class="month-filter">';
  html += '<button type="button" id="btnSemuaBulan" class="month-filter-all' + (jurnalSayaBulan === '' ? ' active' : '') + '">Semua Bulan</button>';
  html += '<div class="month-filter-select-wrap"><span class="form-label">Bulan</span><select class="select-input" id="selBulanSaya">';
  html += '<option value=""' + (jurnalSayaBulan === '' ? ' selected' : '') + '>Pilih bulan</option>';
  for (var b = 1; b <= 12; b++) {
    var bStr = String(b).padStart(2, '0');
    html += '<option value="' + bStr + '"' + (bStr === jurnalSayaBulan ? ' selected' : '') + '>' + BULAN_NAMA[b] + '</option>';
  }
  html += '</select></div></div>';

  if (d.items.length === 0) {
    html += '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-book-bookmark"></i></div><div class="empty-text">Belum ada jurnal yang dibuat</div></div>';
  } else {
    d.items.forEach(function(j) {
      html += '<div class="admin-list-item" data-id="' + j.jurnal_id + '" style="cursor:pointer">'
        + '<div><div class="admin-list-main">' + esc(j.nama_mapel) + ' — ' + esc(j.nama_kelas) + '</div>'
        + '<div class="admin-list-sub">' + fmtTanggalIndo(j.tanggal) + ' · ' + esc(j.jam_label) + '</div></div>'
        + '<span class="badge badge-done"><i class="fa-solid fa-check"></i></span></div>';
    });
  }
  html += paginationHtml(d);

  $main.innerHTML = html;
  document.getElementById('btnSemuaBulan').addEventListener('click', function() {
    jurnalSayaBulan = '';
    navigate('jurnal-saya', { page: 1 });
  });
  document.getElementById('selBulanSaya').addEventListener('change', function(e) {
    jurnalSayaBulan = e.target.value;
    navigate('jurnal-saya', { page: 1 });
  });
  document.querySelectorAll('.admin-list-item[data-id]').forEach(function(item) {
    item.addEventListener('click', function() {
      navigate('jurnal-detail', { jurnal_id: item.dataset.id });
    });
  });
  bindPagination(d, function(newPage) { navigate('jurnal-saya', { page: newPage }); });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Jurnal Kelas (Wali Kelas) — badge "Wali Kelas: X"
// ══════════════════════════════════════════════════════════════

var jurnalKelasTanggal = todayStr();

var jurnalKelasCache = {}; // in-memory per "kelasId_tanggal" — lihat staleWhileRevalidate

function viewJurnalKelas(params) {
  if (params.tanggal) jurnalKelasTanggal = params.tanggal;
  var kelasId = params.kelas_id || STATE.waliKelasId;

  if (!kelasId) {
    $main.innerHTML = '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-chalkboard"></i></div><div class="empty-text">Anda belum ditugaskan sebagai wali kelas</div></div>';
    return;
  }
  STATE._kelasIdCtx = kelasId;

  var reqKelasId = kelasId;
  var reqTanggal = jurnalKelasTanggal;
  var key = reqKelasId + '_' + reqTanggal;

  if (!jurnalKelasCache[key]) {
    $main.innerHTML = refreshBlockButtonHtml() + skeletonListHtml('Mengambil data jurnal kelas...');
  }

  staleWhileRevalidate(
    jurnalKelasCache, key,
    function() { return API.call('getJadwalKelas', { kelas_id: reqKelasId, tanggal: reqTanggal }, 'GET'); },
    function(d, updating) { renderJurnalKelasHtml(d, updating); },
    function() { return STATE._kelasIdCtx === reqKelasId && jurnalKelasTanggal === reqTanggal; }
  );
}

function renderJurnalKelasHtml(d, updating) {
  var html = refreshBlockButtonHtml();
  html += '<div class="wali-info-badge"><i class="fa-solid fa-user"></i> Wali Kelas: ' + esc(d.nama_kelas) + '</div>';
  html += dateBarHtml(jurnalKelasTanggal, 'jurnal-kelas', true);
  if (updating) html += '<div class="quiet-sync-note"><span class="dot"></span>Memperbarui data terbaru…</div>';
  html += tidakHadirSummaryHtml(d.mapel);
  html += '<div class="sec-title">Jurnal Kelas · ' + fmtTanggalIndo(jurnalKelasTanggal) + '</div>';

  if (d.mapel.length === 0) {
    html += '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-inbox"></i></div><div class="empty-text">Tidak ada jadwal pada hari ini</div></div>';
  } else {
    d.mapel.forEach(function(m) {
      html += mapelCardHtml(m);
    });
  }

  $main.innerHTML = html;
  bindDateBar('jurnal-kelas');
}

// [BARU] Ringkasan siswa tidak hadir hari itu (gabungan dari semua mapel yang
// sudah diisi) — supaya wali kelas bisa lihat cepat tanpa buka satu-satu.
function tidakHadirSummaryHtml(mapelList) {
  var map = {}; // nis -> { nama, entries: [{mapel, status, keterangan}] }
  mapelList.forEach(function(m) {
    if (!m.sudah_diisi || !m.tidak_hadir) return;
    m.tidak_hadir.forEach(function(t) {
      var key = String(t.nis);
      if (!map[key]) map[key] = { nama: t.nama, entries: [] };
      map[key].entries.push({ mapel: m.nama_mapel, status: t.status, keterangan: t.keterangan || '' });
    });
  });

  var nisList = Object.keys(map);
  if (nisList.length === 0) return '';

  var html = '<div class="absent-summary">';
  html += '<div class="absent-summary-title"><i class="fa-solid fa-user-xmark"></i> Siswa Tidak Hadir Hari Ini (' + nisList.length + ')</div>';
  nisList.forEach(function(nis) {
    var s = map[nis];
    html += '<div class="absent-row"><div class="absent-nama">' + esc(s.nama) + '</div><div class="absent-tags">';
    s.entries.forEach(function(e) {
      var cls = 'pill-' + e.status.charAt(0).toLowerCase();
      html += '<span class="pill ' + cls + '" title="' + esc(e.mapel) + (e.keterangan ? ' — ' + esc(e.keterangan) : '') + '">'
        + esc(e.status) + ' · ' + esc(e.mapel) + '</span>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function mapelCardHtml(m) {
  var cls = m.sudah_diisi ? 'done' : '';
  var html = '<div class="jadwal-card ' + cls + '">';
  html += '<div class="jadwal-top"><div class="jadwal-info">';
  html += '<div class="jadwal-mapel">' + esc(m.nama_mapel) + '</div>';
  html += '<div class="jadwal-meta">' + esc(m.jam_label) + ' · Guru: ' + esc(m.nama_guru) + '</div>';
  html += '</div>';
  html += m.sudah_diisi ? '<span class="badge badge-done"><i class="fa-solid fa-check"></i> Diisi</span>' : '<span class="badge badge-todo">Belum diisi</span>';
  html += '</div>';

  if (m.sudah_diisi) {
    var k = m.kehadiran;
    html += '<div class="jadwal-preview">';
    html += '<div>' + esc(m.ringkasan) + '</div>';
    html += '<div class="pill-row">';
    html += '<span class="pill pill-g">' + k.hadir + ' Hadir</span>';
    if (k.sakit) html += '<span class="pill pill-s">' + k.sakit + ' Sakit</span>';
    if (k.izin) html += '<span class="pill pill-i">' + k.izin + ' Izin</span>';
    if (k.alpa) html += '<span class="pill pill-a">' + k.alpa + ' Alpa</span>';
    html += '</div>';
    if (m.tidak_hadir.length > 0) {
      html += '<div style="margin-top:8px;font-size:12px">Tidak hadir: ' +
        m.tidak_hadir.map(function(t) { return esc(t.nama); }).join(', ') + '</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ══════════════════════════════════════════════════════════════
// VIEW BARU: Jadwal Kelas (lihat jadwal kelas manapun, tanpa kehadiran)
// Dipakai GURU & WALI_KELAS dari bottom nav. Panggil getJadwalKelasPublik.
// [DIPERBAIKI] cache-first (kelas list + jadwal per kelas+hari), tab hari
// (bukan dropdown lagi), skeleton loading di awal, TIDAK reload spinner
// tiap ganti tab kalau kombinasi kelas+hari itu sudah pernah dibuka.
// ══════════════════════════════════════════════════════════════

var jadwalLihatState = { kelas_id: '', hari: '' };

function viewJadwalKelasLihat(params) {
  var cachedKelas = DataCache.get('kelas');

  if (cachedKelas !== null) {
    // Cache hit — render UI LANGSUNG, tanpa spinner sama sekali.
    renderJadwalKelasLihatShell(cachedKelas);
  } else {
    // Belum pernah ada cache — tampilkan skeleton (bukan spinner kosong).
    $main.innerHTML = skeletonListHtml('Menyiapkan daftar kelas...');
  }

  cachedApiCall('kelas', 'getKelas', {}).then(function(res) {
    if (!res.ok) { if (cachedKelas === null) $main.innerHTML = errorBox(res.error); return; }
    // Kalau tadinya sudah render dari cache DAN data baru identik, tidak
    // perlu render ulang (hindari flicker). Render ulang hanya kalau ini
    // load pertama (belum ada cache) — background refresh untuk kelas
    // jarang sekali benar-benar berubah dalam satu sesi pemakaian.
    if (cachedKelas === null) renderJadwalKelasLihatShell(res.data);
  });
}

function renderJadwalKelasLihatShell(kelasData) {
  STATE.kelasList = kelasData.slice().sort(function(a, b) { return String(a.nama_kelas).localeCompare(String(b.nama_kelas)); });

  if (!jadwalLihatState.kelas_id && STATE.kelasList.length > 0) {
    jadwalLihatState.kelas_id = STATE.kelasList[0].kelas_id;
  }
  if (!jadwalLihatState.hari) {
    var hi = hariIniIndo();
    jadwalLihatState.hari = (hi === 'MINGGU') ? 'SENIN' : hi;
  }

  var html = '<div class="sec-title">Jadwal Kelas</div>';
  html += '<div class="select-wrap"><span class="form-label">Pilih Kelas</span>';
  html += '<select class="select-input" id="selKelas">';
  STATE.kelasList.forEach(function(k) {
    html += '<option value="' + k.kelas_id + '"' + (k.kelas_id === jadwalLihatState.kelas_id ? ' selected' : '') + '>' + esc(k.nama_kelas) + '</option>';
  });
  html += '</select></div>';

  html += '<span class="form-label">Pilih Hari</span>';
  html += '<div class="day-tabs" id="hariTabs">';
  hariAktifList().forEach(function(h) {
    html += '<button class="day-tab' + (h === jadwalLihatState.hari ? ' active' : '') + '" data-hari="' + h + '">' + capitalizeHari(h).substring(0, 3) + '</button>';
  });
  html += '</div>';

  html += '<div id="jadwalLihatHasil"></div>';

  $main.innerHTML = html;

  document.getElementById('selKelas').addEventListener('change', function(e) {
    jadwalLihatState.kelas_id = e.target.value;
    loadJadwalKelasLihat();
  });
  document.querySelectorAll('#hariTabs .day-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.hari === jadwalLihatState.hari) return;
      jadwalLihatState.hari = btn.dataset.hari;
      document.querySelectorAll('#hariTabs .day-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      loadJadwalKelasLihat();
    });
  });

  loadJadwalKelasLihat();
}

function loadJadwalKelasLihat() {
  var $hasil = document.getElementById('jadwalLihatHasil');
  if (!$hasil) return;

  var cacheKey = 'jadwalKelasLihat_' + jadwalLihatState.kelas_id + '_' + jadwalLihatState.hari;
  var cached = DataCache.get(cacheKey);

  if (cached !== null) {
    renderJadwalLihatHasil($hasil, cached); // instan, tanpa loading sama sekali
  } else {
    $hasil.innerHTML = skeletonListHtml(pickLoadingQuote());
  }

  cachedApiCall(cacheKey, 'getJadwalKelasPublik', { kelas_id: jadwalLihatState.kelas_id, hari: jadwalLihatState.hari }).then(function(res) {
    if (!res.ok) { if (cached === null) $hasil.innerHTML = errorBox(res.error); return; }
    renderJadwalLihatHasil($hasil, res.data);
  });
}

function renderJadwalLihatHasil($hasil, d) {
  if (d.jadwal.length === 0) {
    $hasil.innerHTML = '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-inbox"></i></div><div class="empty-text">Tidak ada jadwal pada hari ini</div></div>';
    return;
  }
  var html = '';
  d.jadwal.forEach(function(j) {
    html += '<div class="jadwal-card">'
      + '<div class="jadwal-top"><div class="jadwal-info">'
      + '<div class="jadwal-mapel">' + esc(j.nama_mapel) + '</div>'
      + '<div class="jadwal-meta">' + esc(j.jam_label) + ' · Guru: ' + esc(j.nama_guru) + '</div>'
      + '</div></div></div>';
  });
  $hasil.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Beranda
// ══════════════════════════════════════════════════════════════

function viewAdminHome(params) {
  var html = refreshBlockButtonHtml();
  html += '<div class="sec-title">Ringkasan</div>';
  html += '<div class="admin-list-item"><div><div class="admin-list-main">' + esc(session.nama) + '</div>'
    + '<div class="admin-list-sub">Admin — akses penuh sistem</div></div></div>';

  html += '<div class="sec-title">Menu</div>';
  html += '<div class="admin-list-item" id="goJurnal" style="cursor:pointer"><div class="admin-list-main"><i class="fa-solid fa-user-pen"></i> Jurnal Guru</div></div>';
  html += '<div class="admin-list-item" id="goGuru" style="cursor:pointer"><div class="admin-list-main"><i class="fa-solid fa-user-clock"></i> Jadwal Guru</div></div>';
  html += '<div class="admin-list-item" id="goJadwalKelas" style="cursor:pointer"><div class="admin-list-main"><i class="fa-solid fa-chalkboard"></i> Jadwal Kelas</div></div>';
  html += '<div class="admin-list-item" id="goLog" style="cursor:pointer"><div class="admin-list-main"><i class="fa-solid fa-clock-rotate-left"></i> Log Aktivitas</div></div>';

  html += '<div class="sec-title">Catatan</div>';
  html += '<div class="admin-list-item"><div class="admin-list-sub" style="line-height:1.6">'
    + 'Data master (Guru, Kelas, Siswa, Mapel, Jadwal, User) dikelola langsung di Google Spreadsheet. '
    + 'Konfigurasi sekolah ada di sheet 01_CONFIG.</div></div>';

  $main.innerHTML = html;
  document.getElementById('goJurnal').addEventListener('click', function() { navigate('admin-jurnal'); });
  document.getElementById('goGuru').addEventListener('click', function() { navigate('admin-guru'); });
  document.getElementById('goJadwalKelas').addEventListener('click', function() { navigate('admin-jadwal-kelas'); });
  document.getElementById('goLog').addEventListener('click', function() { navigate('admin-log'); });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Semua Jurnal (filter tanggal wajib + guru + mapel, pagination)
// ══════════════════════════════════════════════════════════════

var adminJurnalFilter = { tanggal: todayStr(), guru_id: '', mapel_id: '', kelas_id: '', page: 1 };

function viewAdminJurnal(params) {
  showLoading('Memuat data guru, kelas & mapel...');

  Promise.all([
    cachedApiCall('guru', 'getGuru', {}),
    cachedApiCall('mapel', 'getMapel', {}),
    cachedApiCall('kelas', 'getKelas', {}),
  ]).then(function(results) {
    var resGuru = results[0], resMapel = results[1], resKelas = results[2];
    if (!resGuru.ok) { $main.innerHTML = errorBox(resGuru.error); return; }
    if (!resMapel.ok) { $main.innerHTML = errorBox(resMapel.error); return; }
    if (!resKelas.ok) { $main.innerHTML = errorBox(resKelas.error); return; }
    STATE.guruList = resGuru.data;
    STATE.mapelList = resMapel.data;
    STATE.kelasList = resKelas.data.slice().sort(function(a, b) { return String(a.nama_kelas).localeCompare(String(b.nama_kelas)); });

    var html = '<div class="sec-title">Filter Jurnal (maks. 1 hari per pencarian)</div>';
    html += '<div class="filter-card">';
    html += '<div class="form-grid-2">';
    html += '<div class="form-group"><span class="form-label">Tanggal *</span>';
    html += '<input type="date" class="select-input" id="filterTanggal" value="' + adminJurnalFilter.tanggal + '"></div>';
    html += '<div class="form-group"><span class="form-label">Kelas</span>';
    html += '<select class="select-input" id="filterKelas"><option value="">Semua Kelas</option>';
    STATE.kelasList.forEach(function(k) {
      html += '<option value="' + k.kelas_id + '"' + (k.kelas_id === adminJurnalFilter.kelas_id ? ' selected' : '') + '>' + esc(k.nama_kelas) + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<div class="form-grid-2" style="margin-top:14px">';
    html += '<div class="form-group"><span class="form-label">Guru</span>';
    html += '<select class="select-input" id="filterGuru"><option value="">Semua Guru</option>';
    STATE.guruList.forEach(function(g) {
      html += '<option value="' + g.guru_id + '"' + (g.guru_id === adminJurnalFilter.guru_id ? ' selected' : '') + '>' + esc(g.nama) + '</option>';
    });
    html += '</select></div>';

    html += '<div class="form-group"><span class="form-label">Mapel</span>';
    html += '<select class="select-input" id="filterMapel"><option value="">Semua Mapel</option>';
    STATE.mapelList.forEach(function(m) {
      html += '<option value="' + m.mapel_id + '"' + (m.mapel_id === adminJurnalFilter.mapel_id ? ' selected' : '') + '>' + esc(m.nama) + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<button class="btn-primary" id="btnCariJurnal" style="margin-top:14px">Cari</button>';
    html += '</div>';
    html += '<div id="adminJurnalHasil" style="margin-top:16px"></div>';

    $main.innerHTML = html;

    document.getElementById('btnCariJurnal').addEventListener('click', function() {
      adminJurnalFilter.tanggal = document.getElementById('filterTanggal').value;
      adminJurnalFilter.guru_id = document.getElementById('filterGuru').value;
      adminJurnalFilter.mapel_id = document.getElementById('filterMapel').value;
      adminJurnalFilter.kelas_id = document.getElementById('filterKelas').value;
      adminJurnalFilter.page = 1;
      if (!adminJurnalFilter.tanggal) { showToast('Tanggal wajib diisi', true); return; }
      loadAdminJurnal();
    });

    loadAdminJurnal();
  });
}

function loadAdminJurnal() {
  var $hasil = document.getElementById('adminJurnalHasil');
  if (!$hasil) return;
  $hasil.innerHTML = skeletonListHtml('Mencari data jurnal...');

  var params = { tanggal: adminJurnalFilter.tanggal, page: adminJurnalFilter.page };
  if (adminJurnalFilter.guru_id) params.guru_id = adminJurnalFilter.guru_id;
  if (adminJurnalFilter.mapel_id) params.mapel_id = adminJurnalFilter.mapel_id;
  if (adminJurnalFilter.kelas_id) params.kelas_id = adminJurnalFilter.kelas_id;

  API.call('getAllJurnal', params, 'GET').then(function(res) {
    if (!res.ok) { $hasil.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    var html = '<div class="sec-title">Hasil (' + d.totalItems + ')</div>';
    if (d.items.length === 0) {
      html += '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-inbox"></i></div><div class="empty-text">Tidak ada jurnal untuk filter ini</div></div>';
    } else {
      d.items.forEach(function(j) {
        html += '<div class="admin-list-item" data-id="' + j.jurnal_id + '" style="cursor:pointer">'
          + '<div><div class="admin-list-main">' + esc(j.nama_mapel) + ' — ' + esc(j.nama_kelas) + '</div>'
          + '<div class="admin-list-sub">' + esc(j.nama_guru) + ' · ' + fmtTanggalIndo(j.tanggal) + '</div></div>'
          + '<span class="badge badge-done">' + esc(j.status) + '</span></div>';
      });
    }
    html += paginationHtml(d);

    $hasil.innerHTML = html;
    document.querySelectorAll('#adminJurnalHasil .admin-list-item[data-id]').forEach(function(item) {
      item.addEventListener('click', function() {
        navigate('jurnal-detail', { jurnal_id: item.dataset.id });
      });
    });
    bindPagination(d, function(newPage) { adminJurnalFilter.page = newPage; loadAdminJurnal(); });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW BARU: Admin — Jadwal per Guru
// ══════════════════════════════════════════════════════════════

var adminGuruState = { guru_id: '', activeHari: '' };
var adminGuruDataCache = null; // hasil getJadwalPerGuru guru yg sedang aktif, dipakai ulang saat ganti tab hari

function viewAdminGuru(params) {
  showLoading('Memuat daftar guru...');

  var guruPromise = cachedApiCall('guru', 'getGuru', {});

  guruPromise.then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    STATE.guruList = res.data;

    if (!adminGuruState.guru_id && STATE.guruList.length > 0) {
      adminGuruState.guru_id = STATE.guruList[0].guru_id;
    }

    var html = '<div class="sec-title">Jadwal Mengajar per Guru</div>';
    html += '<div class="form-group"><span class="form-label">Pilih Guru</span>';
    html += '<select class="select-input" id="selGuru">';
    STATE.guruList.forEach(function(g) {
      html += '<option value="' + g.guru_id + '"' + (g.guru_id === adminGuruState.guru_id ? ' selected' : '') + '>' + esc(g.nama) + '</option>';
    });
    html += '</select></div>';

    html += '<div id="adminGuruHasil"></div>';

    $main.innerHTML = html;

    document.getElementById('selGuru').addEventListener('change', function(e) {
      adminGuruState.guru_id = e.target.value;
      adminGuruState.activeHari = ''; // reset tab hari saat ganti guru
      adminGuruDataCache = null;
      loadAdminGuru();
    });

    loadAdminGuru();
  });
}

// Hari "aktif" = hari yang punya jam pelajaran di konfigurasi sekolah
// (appConfig.jam_maks) — biasanya SENIN..JUMAT. SABTU tidak disertakan
// getConfig kalau JAM_MAKS_SABTU = 0, jadi otomatis tersaring di sini.
function hariAktifList() {
  if (appConfig && appConfig.jam_maks) return Object.keys(appConfig.jam_maks);
  return ['SENIN','SELASA','RABU','KAMIS','JUMAT'];
}

function loadAdminGuru() {
  var $hasil = document.getElementById('adminGuruHasil');
  if (!$hasil) return;

  // Kalau data guru ini sudah pernah diambil, langsung render dari cache
  // (ganti tab hari TIDAK memanggil API lagi — sesuai permintaan).
  if (adminGuruDataCache) { renderAdminGuruTabs($hasil); return; }

  $hasil.innerHTML = skeletonListHtml('Mengambil jadwal guru...');

  cachedApiCall('jadwalGuru_' + adminGuruState.guru_id, 'getJadwalPerGuru', { guru_id: adminGuruState.guru_id }).then(function(res) {
    if (!res.ok) { $hasil.innerHTML = errorBox(res.error); return; }
    adminGuruDataCache = res.data;
    renderAdminGuruTabs($hasil);
  });
}

function renderAdminGuruTabs($hasil) {
  var d = adminGuruDataCache;
  var hariAktif = hariAktifList();
  var jadwalByHari = {};
  d.jadwal_per_hari.forEach(function(hb) { jadwalByHari[hb.hari] = hb.jadwal; });

  if (!adminGuruState.activeHari || hariAktif.indexOf(adminGuruState.activeHari) === -1) {
    adminGuruState.activeHari = hariAktif[0] || 'SENIN';
  }

  var html = '<div class="day-tabs">';
  hariAktif.forEach(function(h) {
    html += '<button class="day-tab' + (h === adminGuruState.activeHari ? ' active' : '') + '" data-hari="' + h + '">'
      + capitalizeHari(h).substring(0, 3) + '</button>';
  });
  html += '</div>';

  html += '<div id="adminGuruHariContent">' + renderAdminGuruHariContent(jadwalByHari, adminGuruState.activeHari) + '</div>';

  $hasil.innerHTML = html;

  $hasil.querySelectorAll('.day-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      adminGuruState.activeHari = btn.dataset.hari;
      $hasil.querySelectorAll('.day-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      // Ganti isi konten saja dari data yang SUDAH ADA — tidak panggil API lagi
      document.getElementById('adminGuruHariContent').innerHTML = renderAdminGuruHariContent(jadwalByHari, adminGuruState.activeHari);
    });
  });
}

function renderAdminGuruHariContent(jadwalByHari, hari) {
  var jadwal = jadwalByHari[hari] || [];
  if (jadwal.length === 0) {
    return '<div class="jadwal-card kosong"><div class="jadwal-top"><div class="jadwal-info">'
      + '<div class="jadwal-mapel muted">Tidak ada jadwal</div></div></div></div>';
  }
  var html = '';
  jadwal.forEach(function(j) {
    html += '<div class="jadwal-card"><div class="jadwal-top"><div class="jadwal-info">'
      + '<div class="jadwal-mapel">' + esc(j.nama_mapel) + '</div>'
      + '<div class="jadwal-meta">' + esc(j.nama_kelas) + ' · ' + esc(j.jam_label) + '</div>'
      + '</div></div></div>';
  });
  return html;
}

// ══════════════════════════════════════════════════════════════
// VIEW BARU: Guru — Jadwal Saya (jadwal mengajar mingguan milik sendiri,
// TIDAK sama dengan "Hari Ini" yang cuma tampilkan hari berjalan).
// Datanya sama sifatnya dengan "Jadwal per Guru" di Admin (master/jarang
// berubah) sehingga dipakaikan pola cache yang sama: cachedApiCall +
// localStorage, BUKAN staleWhileRevalidate (itu untuk data transaksional).
// guru_id dikunci ke akun yang sedang login — tanpa dropdown pilih guru.
// ══════════════════════════════════════════════════════════════

var jadwalSayaGuruState = { activeHari: '' };
var jadwalSayaGuruCache = null; // hasil getJadwalPerGuru milik sendiri, dipakai ulang saat ganti tab hari

function viewJadwalSayaGuru(params) {
  if (!session.guru_id) {
    $main.innerHTML = '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-user-slash"></i></div><div class="empty-text">Akun ini belum terhubung ke data guru</div></div>';
    return;
  }

  var html = '<div class="sec-title">Jadwal Mengajar Saya</div>';
  html += '<div id="jadwalSayaGuruHasil"></div>';
  $main.innerHTML = html;

  loadJadwalSayaGuru();
}

function loadJadwalSayaGuru() {
  var $hasil = document.getElementById('jadwalSayaGuruHasil');
  if (!$hasil) return;

  // Sama seperti Admin — ganti tab hari TIDAK memanggil API lagi kalau
  // data sudah pernah diambil.
  if (jadwalSayaGuruCache) { renderJadwalSayaGuruTabs($hasil); return; }

  $hasil.innerHTML = skeletonListHtml('Mengambil jadwal mengajar Anda...');

  cachedApiCall('jadwalGuru_' + session.guru_id, 'getJadwalPerGuru', { guru_id: session.guru_id }).then(function(res) {
    if (!res.ok) { $hasil.innerHTML = errorBox(res.error); return; }
    jadwalSayaGuruCache = res.data;
    renderJadwalSayaGuruTabs($hasil);
  });
}

function renderJadwalSayaGuruTabs($hasil) {
  var d = jadwalSayaGuruCache;
  var hariAktif = hariAktifList();
  var jadwalByHari = {};
  d.jadwal_per_hari.forEach(function(hb) { jadwalByHari[hb.hari] = hb.jadwal; });

  if (!jadwalSayaGuruState.activeHari || hariAktif.indexOf(jadwalSayaGuruState.activeHari) === -1) {
    jadwalSayaGuruState.activeHari = hariAktif[0] || 'SENIN';
  }

  var html = '<div class="day-tabs">';
  hariAktif.forEach(function(h) {
    html += '<button class="day-tab' + (h === jadwalSayaGuruState.activeHari ? ' active' : '') + '" data-hari="' + h + '">'
      + capitalizeHari(h).substring(0, 3) + '</button>';
  });
  html += '</div>';

  html += '<div id="jadwalSayaGuruHariContent">' + renderAdminGuruHariContent(jadwalByHari, jadwalSayaGuruState.activeHari) + '</div>';

  $hasil.innerHTML = html;

  $hasil.querySelectorAll('.day-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      jadwalSayaGuruState.activeHari = btn.dataset.hari;
      $hasil.querySelectorAll('.day-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('jadwalSayaGuruHariContent').innerHTML = renderAdminGuruHariContent(jadwalByHari, jadwalSayaGuruState.activeHari);
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Log Aktivitas — PAKAI PAGINATION
// ══════════════════════════════════════════════════════════════

var adminLogPage = 1;
var adminLogCache = {}; // in-memory per nomor halaman — lihat staleWhileRevalidate

function viewAdminLog(params) {
  if (params.page) adminLogPage = params.page;
  else adminLogPage = 1;

  var reqPage = adminLogPage;

  if (!adminLogCache[reqPage]) $main.innerHTML = skeletonListHtml('Mengambil log aktivitas...');

  staleWhileRevalidate(
    adminLogCache, reqPage,
    function() { return API.call('getLog', { page: reqPage }, 'GET'); },
    function(d, updating) { renderAdminLogHtml(d, updating); },
    function() { return adminLogPage === reqPage; }
  );
}

function renderAdminLogHtml(d, updating) {
  var html = '<div class="sec-title">Log Aktivitas (' + d.totalItems + ' total)</div>';
  if (updating) html += '<div class="quiet-sync-note"><span class="dot"></span>Memperbarui data terbaru…</div>';

  if (d.items.length === 0) {
    html += '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-clock-rotate-left"></i></div><div class="empty-text">Belum ada log</div></div>';
  } else {
    d.items.forEach(function(l) {
      html += '<div class="admin-list-item"><div>'
        + '<div class="admin-list-main">' + esc(l.aksi) + ' — ' + esc(l.tabel) + '</div>'
        + '<div class="admin-list-sub">' + esc(l.keterangan) + '</div>'
        + '<div class="admin-list-sub">' + esc(l.waktu) + '</div></div></div>';
    });
  }
  html += paginationHtml(d);

  $main.innerHTML = html;
  bindPagination(d, function(newPage) { navigate('admin-log', { page: newPage }); });
}

// ── Start ────────────────────────────────────────────────────

init();
