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
    }
    setupRoleTabs();
    setupBottomNav();
    navigate(defaultRouteFor(activeRole));
  });
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
      { route: 'dashboard',          icon: '📅', label: 'Hari Ini' },
      { route: 'jurnal-saya',        icon: '📋', label: 'Jurnal Saya' },
      { route: 'jadwal-kelas-lihat', icon: '🏫', label: 'Jadwal Kelas' },
    ];
  } else if (activeRole === 'WALI_KELAS') {
    items = [
      { route: 'jurnal-kelas',       icon: '🏫', label: 'Jurnal Kelas' },
      { route: 'jadwal-kelas-lihat', icon: '🗓️', label: 'Jadwal Kelas' },
    ];
  } else if (activeRole === 'ADMIN') {
    items = [
      { route: 'admin-home',   icon: '⚙️', label: 'Beranda' },
      { route: 'admin-jurnal', icon: '📚', label: 'Jurnal' },
      { route: 'admin-guru',   icon: '👤', label: 'Guru' },
      { route: 'admin-log',    icon: '🕒', label: 'Log' },
    ];
  }

  if (items.length <= 1) { $nav.style.display = 'none'; return; }

  $nav.style.display = 'flex';
  $nav.innerHTML = items.map(function(it) {
    return '<button class="nav-item" data-route="' + it.route + '">'
      + '<span class="nav-icon">' + it.icon + '</span>' + it.label + '</button>';
  }).join('');

  $nav.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.addEventListener('click', function() { navigate(btn.dataset.route); });
  });
}

function setActiveNav(route) {
  $nav.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
}

// ── Router ───────────────────────────────────────────────────

function navigate(route, params) {
  setActiveNav(route);
  params = params || {};

  var routes = {
    'dashboard':          viewDashboard,
    'jurnal-saya':        viewJurnalSaya,
    'jurnal-form':        viewJurnalForm,
    'jurnal-detail':      viewJurnalDetail,
    'jurnal-edit':        viewJurnalEdit,
    'jurnal-kelas':       viewJurnalKelas,
    'jadwal-kelas-lihat': viewJadwalKelasLihat,
    'admin-home':         viewAdminHome,
    'admin-jurnal':       viewAdminJurnal,
    'admin-guru':         viewAdminGuru,
    'admin-log':          viewAdminLog,
  };

  if (routes[route]) routes[route](params);
  else $main.innerHTML = '<div class="empty"><div class="empty-icon">🚧</div><div class="empty-text">Halaman tidak ditemukan</div></div>';
}

// ── Helper: loading & toast ─────────────────────────────────────

function showLoading(msg) {
  $main.innerHTML = '<div class="loading-box"><div class="spinner"></div><br>' + (msg || 'Memuat...') + '</div>';
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

function viewDashboard(params) {
  if (params.tanggal) dashTanggal = params.tanggal;
  showLoading('Memuat jadwal...');

  API.call('getJadwalHariIni', { tanggal: dashTanggal }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }

    var d = res.data;
    STATE.jadwalHariIni = d;

    var html = '';
    html += dateBarHtml(dashTanggal, 'dashboard');
    html += '<div class="sec-title">Jadwal Mengajar — ' + fmtTanggalIndo(dashTanggal) + '</div>';

    if (d.jadwal.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Tidak ada jam pelajaran pada hari ini</div></div>';
    } else {
      d.jadwal.forEach(function(j) {
        html += jadwalCardHtml(j);
      });
    }

    $main.innerHTML = html;
    bindDateBar('dashboard');
    bindJadwalCards();
  });
}

function dateBarHtml(tanggal, route) {
  return '<div class="date-bar">'
    + '<input type="date" id="datePicker" value="' + tanggal + '">'
    + '<button class="date-today-btn" id="btnToday">Hari Ini</button>'
    + '</div>';
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
    API.call('getSiswa', { kelas_id: blok.kelas_id }, 'GET'),
    API.call('getJam', {}, 'GET'),
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

    var html = '<button class="btn-back" onclick="navigate(\'dashboard\', {tanggal:\'' + blok.tanggal + '\'})">← Kembali</button>';
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
      navigate('dashboard', { tanggal: blok.tanggal });
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

    var html = '<button class="btn-back" onclick="history.back()">← Kembali</button>';
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

  API.call('getSiswa', { kelas_id: j.kelas_id }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var siswa = res.data;

    // Peta status kehadiran existing per NIS (hanya berisi yang TIDAK hadir)
    var khMap = {};
    (j.tidak_hadir || []).forEach(function(k) { khMap[String(k.nis)] = k.status; });

    var html = '<button class="btn-back" onclick="navigate(\'jurnal-detail\', {jurnal_id:\'' + j.jurnal_id + '\'})">← Batal, kembali ke detail</button>';
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
      navigate('jurnal-detail', { jurnal_id: jurnalId });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Jurnal Saya (Riwayat Guru) — PAKAI PAGINATION
// ══════════════════════════════════════════════════════════════

var jurnalSayaPage = 1;

function viewJurnalSaya(params) {
  if (params.page) jurnalSayaPage = params.page;
  else jurnalSayaPage = 1;
  showLoading('Memuat riwayat jurnal...');

  API.call('getJurnalSaya', { page: jurnalSayaPage }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    var html = '<div class="sec-title">Riwayat Jurnal Saya (' + d.totalItems + ')</div>';

    if (d.items.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Belum ada jurnal yang dibuat</div></div>';
    } else {
      d.items.forEach(function(j) {
        html += '<div class="admin-list-item" data-id="' + j.jurnal_id + '" style="cursor:pointer">'
          + '<div><div class="admin-list-main">' + esc(j.nama_mapel) + ' — ' + esc(j.nama_kelas) + '</div>'
          + '<div class="admin-list-sub">' + fmtTanggalIndo(j.tanggal) + ' · ' + esc(j.jam_label) + '</div></div>'
          + '<span class="badge badge-done">✓</span></div>';
      });
    }
    html += paginationHtml(d);

    $main.innerHTML = html;
    document.querySelectorAll('.admin-list-item[data-id]').forEach(function(item) {
      item.addEventListener('click', function() {
        navigate('jurnal-detail', { jurnal_id: item.dataset.id });
      });
    });
    bindPagination(d, function(newPage) { navigate('jurnal-saya', { page: newPage }); });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Jurnal Kelas (Wali Kelas) — badge "Wali Kelas: X"
// ══════════════════════════════════════════════════════════════

var jurnalKelasTanggal = todayStr();

function viewJurnalKelas(params) {
  if (params.tanggal) jurnalKelasTanggal = params.tanggal;
  var kelasId = params.kelas_id || STATE.waliKelasId;

  if (!kelasId) {
    $main.innerHTML = '<div class="empty"><div class="empty-icon">🏫</div><div class="empty-text">Anda belum ditugaskan sebagai wali kelas</div></div>';
    return;
  }
  STATE._kelasIdCtx = kelasId;

  showLoading('Memuat jurnal kelas...');

  API.call('getJadwalKelas', { kelas_id: kelasId, tanggal: jurnalKelasTanggal }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    var html = '<div class="wali-info-badge">👤 Wali Kelas: ' + esc(d.nama_kelas) + '</div>';
    html += dateBarHtml(jurnalKelasTanggal, 'jurnal-kelas');
    html += '<div class="sec-title">Jurnal Kelas · ' + fmtTanggalIndo(jurnalKelasTanggal) + '</div>';

    if (d.mapel.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Tidak ada jadwal pada hari ini</div></div>';
    } else {
      d.mapel.forEach(function(m) {
        html += mapelCardHtml(m);
      });
    }

    $main.innerHTML = html;
    bindDateBar('jurnal-kelas');
  });
}

function mapelCardHtml(m) {
  var cls = m.sudah_diisi ? 'done' : '';
  var html = '<div class="jadwal-card ' + cls + '">';
  html += '<div class="jadwal-top"><div class="jadwal-info">';
  html += '<div class="jadwal-mapel">' + esc(m.nama_mapel) + '</div>';
  html += '<div class="jadwal-meta">' + esc(m.jam_label) + ' · Guru: ' + esc(m.nama_guru) + '</div>';
  html += '</div>';
  html += m.sudah_diisi ? '<span class="badge badge-done">✓ Diisi</span>' : '<span class="badge badge-todo">Belum diisi</span>';
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
// ══════════════════════════════════════════════════════════════

var jadwalLihatState = { kelas_id: '', hari: hariIniIndo() };
var HARI_OPSI = ['SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];

function viewJadwalKelasLihat(params) {
  showLoading('Memuat daftar kelas...');

  var kelasPromise = STATE.kelasList ? Promise.resolve({ ok: true, data: STATE.kelasList }) : API.call('getKelas', {}, 'GET');

  kelasPromise.then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    STATE.kelasList = res.data.slice().sort(function(a, b) { return String(a.nama_kelas).localeCompare(String(b.nama_kelas)); });

    if (!jadwalLihatState.kelas_id && STATE.kelasList.length > 0) {
      jadwalLihatState.kelas_id = STATE.kelasList[0].kelas_id;
    }

    var html = '<div class="sec-title">Jadwal Kelas</div>';
    html += '<div class="form-grid-2">';
    html += '<div class="form-group"><span class="form-label">Pilih Kelas</span>';
    html += '<select class="select-input" id="selKelas">';
    STATE.kelasList.forEach(function(k) {
      html += '<option value="' + k.kelas_id + '"' + (k.kelas_id === jadwalLihatState.kelas_id ? ' selected' : '') + '>' + esc(k.nama_kelas) + '</option>';
    });
    html += '</select></div>';

    html += '<div class="form-group"><span class="form-label">Pilih Hari</span>';
    html += '<select class="select-input" id="selHari">';
    HARI_OPSI.forEach(function(h) {
      html += '<option value="' + h + '"' + (h === jadwalLihatState.hari ? ' selected' : '') + '>' + capitalizeHari(h) + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<div id="jadwalLihatHasil"></div>';

    $main.innerHTML = html;

    document.getElementById('selKelas').addEventListener('change', function(e) {
      jadwalLihatState.kelas_id = e.target.value;
      loadJadwalKelasLihat();
    });
    document.getElementById('selHari').addEventListener('change', function(e) {
      jadwalLihatState.hari = e.target.value;
      loadJadwalKelasLihat();
    });

    loadJadwalKelasLihat();
  });
}

function loadJadwalKelasLihat() {
  var $hasil = document.getElementById('jadwalLihatHasil');
  if (!$hasil) return;
  $hasil.innerHTML = '<div class="loading-box"><div class="spinner"></div></div>';

  API.call('getJadwalKelasPublik', { kelas_id: jadwalLihatState.kelas_id, hari: jadwalLihatState.hari }, 'GET').then(function(res) {
    if (!res.ok) { $hasil.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    if (d.jadwal.length === 0) {
      $hasil.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Tidak ada jadwal pada hari ini</div></div>';
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
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Beranda
// ══════════════════════════════════════════════════════════════

function viewAdminHome(params) {
  var html = '<div class="sec-title">Ringkasan</div>';
  html += '<div class="admin-list-item"><div><div class="admin-list-main">' + esc(session.nama) + '</div>'
    + '<div class="admin-list-sub">Admin — akses penuh sistem</div></div></div>';

  html += '<div class="sec-title">Menu</div>';
  html += '<div class="admin-list-item" id="goJurnal" style="cursor:pointer"><div class="admin-list-main">📚 Semua Jurnal</div></div>';
  html += '<div class="admin-list-item" id="goGuru" style="cursor:pointer"><div class="admin-list-main">👤 Jadwal per Guru</div></div>';
  html += '<div class="admin-list-item" id="goLog" style="cursor:pointer"><div class="admin-list-main">🕒 Log Aktivitas</div></div>';

  html += '<div class="sec-title">Catatan</div>';
  html += '<div class="admin-list-item"><div class="admin-list-sub" style="line-height:1.6">'
    + 'Data master (Guru, Kelas, Siswa, Mapel, Jadwal, User) dikelola langsung di Google Spreadsheet. '
    + 'Konfigurasi sekolah ada di sheet 01_CONFIG.</div></div>';

  $main.innerHTML = html;
  document.getElementById('goJurnal').addEventListener('click', function() { navigate('admin-jurnal'); });
  document.getElementById('goGuru').addEventListener('click', function() { navigate('admin-guru'); });
  document.getElementById('goLog').addEventListener('click', function() { navigate('admin-log'); });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Semua Jurnal (filter tanggal wajib + guru + mapel, pagination)
// ══════════════════════════════════════════════════════════════

var adminJurnalFilter = { tanggal: todayStr(), guru_id: '', mapel_id: '', page: 1 };

function viewAdminJurnal(params) {
  showLoading('Memuat data guru & mapel...');

  Promise.all([
    STATE.guruList ? Promise.resolve({ ok: true, data: STATE.guruList }) : API.call('getGuru', {}, 'GET'),
    STATE.mapelList ? Promise.resolve({ ok: true, data: STATE.mapelList }) : API.call('getMapel', {}, 'GET'),
  ]).then(function(results) {
    var resGuru = results[0], resMapel = results[1];
    if (!resGuru.ok) { $main.innerHTML = errorBox(resGuru.error); return; }
    if (!resMapel.ok) { $main.innerHTML = errorBox(resMapel.error); return; }
    STATE.guruList = resGuru.data;
    STATE.mapelList = resMapel.data;

    var html = '<div class="sec-title">Filter Jurnal (maks. 1 hari per pencarian)</div>';
    html += '<div class="form-grid-2">';
    html += '<div class="form-group"><span class="form-label">Tanggal *</span>';
    html += '<input type="date" class="select-input" id="filterTanggal" value="' + adminJurnalFilter.tanggal + '"></div>';
    html += '<div class="form-group"><span class="form-label">Guru</span>';
    html += '<select class="select-input" id="filterGuru"><option value="">Semua Guru</option>';
    STATE.guruList.forEach(function(g) {
      html += '<option value="' + g.guru_id + '"' + (g.guru_id === adminJurnalFilter.guru_id ? ' selected' : '') + '>' + esc(g.nama) + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<div class="form-group"><span class="form-label">Mapel</span>';
    html += '<select class="select-input" id="filterMapel"><option value="">Semua Mapel</option>';
    STATE.mapelList.forEach(function(m) {
      html += '<option value="' + m.mapel_id + '"' + (m.mapel_id === adminJurnalFilter.mapel_id ? ' selected' : '') + '>' + esc(m.nama) + '</option>';
    });
    html += '</select></div>';

    html += '<button class="btn-primary" id="btnCariJurnal">Cari</button>';
    html += '<div id="adminJurnalHasil" style="margin-top:16px"></div>';

    $main.innerHTML = html;

    document.getElementById('btnCariJurnal').addEventListener('click', function() {
      adminJurnalFilter.tanggal = document.getElementById('filterTanggal').value;
      adminJurnalFilter.guru_id = document.getElementById('filterGuru').value;
      adminJurnalFilter.mapel_id = document.getElementById('filterMapel').value;
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
  $hasil.innerHTML = '<div class="loading-box"><div class="spinner"></div></div>';

  var params = { tanggal: adminJurnalFilter.tanggal, page: adminJurnalFilter.page };
  if (adminJurnalFilter.guru_id) params.guru_id = adminJurnalFilter.guru_id;
  if (adminJurnalFilter.mapel_id) params.mapel_id = adminJurnalFilter.mapel_id;

  API.call('getAllJurnal', params, 'GET').then(function(res) {
    if (!res.ok) { $hasil.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    var html = '<div class="sec-title">Hasil (' + d.totalItems + ')</div>';
    if (d.items.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">Tidak ada jurnal untuk filter ini</div></div>';
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

var adminGuruState = { guru_id: '' };

function viewAdminGuru(params) {
  showLoading('Memuat daftar guru...');

  var guruPromise = STATE.guruList ? Promise.resolve({ ok: true, data: STATE.guruList }) : API.call('getGuru', {}, 'GET');

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
      loadAdminGuru();
    });

    loadAdminGuru();
  });
}

function loadAdminGuru() {
  var $hasil = document.getElementById('adminGuruHasil');
  if (!$hasil) return;
  $hasil.innerHTML = '<div class="loading-box"><div class="spinner"></div></div>';

  API.call('getJadwalPerGuru', { guru_id: adminGuruState.guru_id }, 'GET').then(function(res) {
    if (!res.ok) { $hasil.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    var html = '';
    d.jadwal_per_hari.forEach(function(hariBlok) {
      html += '<div class="sec-title">' + capitalizeHari(hariBlok.hari) + '</div>';
      if (hariBlok.jadwal.length === 0) {
        html += '<div class="jadwal-card kosong"><div class="jadwal-top"><div class="jadwal-info">'
          + '<div class="jadwal-mapel muted">Tidak ada jadwal</div></div></div></div>';
      } else {
        hariBlok.jadwal.forEach(function(j) {
          html += '<div class="jadwal-card"><div class="jadwal-top"><div class="jadwal-info">'
            + '<div class="jadwal-mapel">' + esc(j.nama_mapel) + '</div>'
            + '<div class="jadwal-meta">' + esc(j.nama_kelas) + ' · ' + esc(j.jam_label) + '</div>'
            + '</div></div></div>';
        });
      }
    });

    $hasil.innerHTML = html;
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Log Aktivitas — PAKAI PAGINATION
// ══════════════════════════════════════════════════════════════

var adminLogPage = 1;

function viewAdminLog(params) {
  if (params.page) adminLogPage = params.page;
  else adminLogPage = 1;
  showLoading('Memuat log...');

  API.call('getLog', { page: adminLogPage }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    var html = '<div class="sec-title">Log Aktivitas (' + d.totalItems + ' total)</div>';

    if (d.items.length === 0) {
      html += '<div class="empty"><div class="empty-icon">🕒</div><div class="empty-text">Belum ada log</div></div>';
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
  });
}

// ── Start ────────────────────────────────────────────────────

init();
