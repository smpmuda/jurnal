// ============================================================
// dashboard-kegiatan.js — Dashboard Kegiatan (statistik sekolah)
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// [BARU — 2026-09-26] Sengaja file & halaman TERPISAH dari app.js/app.html
// (keputusan eksplisit user) — dashboard ini murni tampilan baca-saja,
// dipakai SEMUA role (GURU/WALI_KELAS/ADMIN) setelah login, tidak masuk
// ke router SPA app.js supaya app.js tidak makin membengkak.
//
// Reuse dari file yang SUDAH ADA (tidak duplikasi): config.js (CONFIG),
// auth.js (Auth — sessionStorage token, namespaced per deployment),
// api.js (API.call — wrapper fetch ke Apps Script). Endpoint baru:
// getDashboardStats (lihat Dashboard.gs), read-only, semua role.
// Helper todayStr/mondayOfWeek/addDaysStr disalin dari app.js (bukan
// di-import) supaya file ini tetap 100% mandiri.
//
// [UBAH — 2026-09-26] Tab ke-3 semula "Minggu Lalu" (rentang tetap H-7..H-1).
// Diganti permintaan user: date-picker mingguan PERSIS seperti pola "Export
// Jurnal Mingguan" (pilih 1 tanggal → di-snap ke Senin-Sabtu minggu itu),
// tapi dibatasi maksimal 90 hari (12 minggu) ke belakang dari hari ini —
// endpoint backend (Dashboard.gs) yang menegakkan batas ini, frontend cuma
// menampilkan validasi & batas tanggal picker senada supaya user tidak
// perlu coba-coba.
//
// CACHE (keputusan eksplisit user, 2026-09-26): localStorage, TTL beda-beda
// sesuai seberapa cepat data itu berubah:
//   hari_ini              → 2 jam
//   kemarin                → 1 hari
//   minggu (custom, sudah lewat total) → 1 minggu
//   minggu (custom, termasuk hari ini) → 2 jam (masih bisa berubah)
// Pola cache mengikuti gaya cache.js yang sudah ada (namespaced,
// try-catch gagal-aman) — file terpisah karena cache.js khusus data MASTER,
// bukan data agregat dashboard ini.
// ============================================================

(function () {

  if (!Auth.requireLogin()) return; // redirect ke login.html kalau belum login

  var session = Auth.getSession();

  // ── Helper tanggal (salinan dari app.js, biar file ini mandiri) ──
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDaysStr(dateStr, n) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function mondayOfWeek(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var day = d.getDay(); // 0=Minggu .. 6=Sabtu
    var diffKeSenin = (day === 0) ? -6 : (1 - day);
    d.setDate(d.getDate() + diffKeSenin);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtTanggalIndo(tanggalStr) {
    var bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    var d = new Date(tanggalStr + 'T00:00:00');
    return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
  }

  var MAKS_HARI_MUNDUR = 90; // samakan dengan DASHBOARD_MAX_HARI_MUNDUR di Dashboard.gs
  var BATAS_MUNDUR = addDaysStr(todayStr(), -MAKS_HARI_MUNDUR);

  // ── Cache kecil khusus dashboard (localStorage, TTL disimpan per-entry) ──
  var DashCache = (function () {
    var LS_PREFIX = 'jm_dashcache_' + CONFIG.STORAGE_NS + '_';

    function get(key) {
      try {
        var raw = localStorage.getItem(LS_PREFIX + key);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        var umur = Date.now() - parsed.cachedAt;
        if (umur > parsed.ttlMs) return null; // basi
        return parsed;
      } catch (e) {
        return null;
      }
    }

    function set(key, data, ttlMs) {
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data: data, cachedAt: Date.now(), ttlMs: ttlMs }));
      } catch (e) { /* penuh/nonaktif — diamkan, gagal-aman */ }
    }

    return { get: get, set: set };
  })();

  var TTL_2JAM  = 2  * 60 * 60 * 1000;
  var TTL_1HARI = 24 * 60 * 60 * 1000;
  var TTL_1MINGGU = 7 * 24 * 60 * 60 * 1000;

  // ── State ──
  var TAB_LABEL = { hari_ini: 'Hari Ini', kemarin: 'Kemarin', minggu: 'Pilih Minggu' };
  var activeTab = 'hari_ini';
  var mingguAnchor = todayStr(); // tanggal yang dipilih di date-picker tab "minggu"
  var chartDonut = null, chartTren = null, chartKehadiran = null;

  // ── DOM refs ──
  var $tabs = document.getElementById('dashTabs');
  var $mingguPicker = document.getElementById('dashMingguPicker');
  var $mingguInput = document.getElementById('dashMingguInput');
  var $mingguPeriode = document.getElementById('dashMingguPeriode');
  var $content = document.getElementById('dashContent');
  var $skeleton = document.getElementById('dashSkeleton');
  var $empty = document.getElementById('dashEmpty');
  var $err = document.getElementById('dashError');
  var $errMsg = document.getElementById('dashErrorMsg');
  var $cacheInfo = document.getElementById('dashCacheInfo');
  var $btnRefresh = document.getElementById('btnDashRefresh');
  var $hdrUser = document.getElementById('hdrUser');

  $hdrUser.textContent = session.nama + ' · ' + roleLabelSingkat(session.role);

  function roleLabelSingkat(roleStr) {
    var roles = String(roleStr || '').split(',').map(function (r) { return r.trim(); });
    if (roles.indexOf('ADMIN') >= 0) return 'Admin';
    if (roles.indexOf('WALI_KELAS') >= 0) return 'Wali Kelas';
    return 'Guru';
  }

  // ── Init tabs ──
  $tabs.innerHTML = Object.keys(TAB_LABEL).map(function (m) {
    return '<button class="dtab' + (m === activeTab ? ' active' : '') + '" data-tab="' + m + '">' + TAB_LABEL[m] + '</button>';
  }).join('');
  $tabs.querySelectorAll('.dtab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.tab === activeTab) return;
      activeTab = btn.dataset.tab;
      $tabs.querySelectorAll('.dtab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      $mingguPicker.style.display = (activeTab === 'minggu') ? 'flex' : 'none';
      loadActiveTab(false);
    });
  });

  // ── Date picker "Pilih Minggu" ──
  $mingguInput.min = BATAS_MUNDUR;
  $mingguInput.max = todayStr();
  $mingguInput.value = mingguAnchor;
  updateMingguPeriodeLabel();
  $mingguInput.addEventListener('change', function () {
    mingguAnchor = $mingguInput.value || todayStr();
    updateMingguPeriodeLabel();
    loadActiveTab(false);
  });

  function rentangMinggu() {
    var senin = mondayOfWeek(mingguAnchor);
    var sabtuRaw = addDaysStr(senin, 5);
    var selesai = sabtuRaw > todayStr() ? todayStr() : sabtuRaw;
    return { mulai: senin, selesai: selesai };
  }

  function updateMingguPeriodeLabel() {
    var r = rentangMinggu();
    $mingguPeriode.textContent = 'Periode: ' + fmtTanggalIndo(r.mulai) + ' – ' + fmtTanggalIndo(r.selesai);
  }

  $btnRefresh.addEventListener('click', function () {
    if ($btnRefresh.classList.contains('spinning')) return;
    loadActiveTab(true);
  });

  // ── Tentukan rentang tanggal aktif + kunci cache + TTL ──
  function rentangAktif() {
    if (activeTab === 'hari_ini') {
      var t = todayStr();
      return { mulai: t, selesai: t, cacheKey: 'hari_ini', ttlMs: TTL_2JAM };
    }
    if (activeTab === 'kemarin') {
      var y = addDaysStr(todayStr(), -1);
      return { mulai: y, selesai: y, cacheKey: 'kemarin', ttlMs: TTL_1HARI };
    }
    // minggu (custom)
    var r = rentangMinggu();
    var termasukHariIni = (r.selesai === todayStr());
    return {
      mulai: r.mulai,
      selesai: r.selesai,
      cacheKey: 'minggu_' + r.mulai + '_' + r.selesai,
      ttlMs: termasukHariIni ? TTL_2JAM : TTL_1MINGGU,
    };
  }

  // ── Load ──
  function loadActiveTab(forceRefresh) {
    var r = rentangAktif();

    if (r.mulai < BATAS_MUNDUR) {
      setState('error', 'Rentang tanggal melebihi ' + MAKS_HARI_MUNDUR + ' hari (12 minggu) ke belakang. Pilih tanggal yang lebih baru.');
      return;
    }

    setState('loading');

    if (!forceRefresh) {
      var cached = DashCache.get(r.cacheKey);
      if (cached) {
        render(r, cached.data, cached.cachedAt);
        return;
      }
    }

    $btnRefresh.classList.add('spinning');
    API.call('getDashboardStats', { tanggal_mulai: r.mulai, tanggal_selesai: r.selesai }, 'GET', true).then(function (res) {
      $btnRefresh.classList.remove('spinning');
      if (!res.ok) {
        setState('error', res.error);
        return;
      }
      DashCache.set(r.cacheKey, res.data, r.ttlMs);
      render(r, res.data, Date.now());
    });
  }

  function setState(state, msg) {
    $skeleton.style.display = state === 'loading' ? 'block' : 'none';
    $content.style.display  = state === 'ok' ? 'block' : 'none';
    $empty.style.display    = state === 'empty' ? 'block' : 'none';
    $err.style.display      = state === 'error' ? 'block' : 'none';
    if (state === 'error') $errMsg.textContent = msg || 'Terjadi kesalahan';
  }

  // ── Render ──
  function render(r, data, cachedAt) {
    var masihAktif = rentangAktif();
    if (masihAktif.cacheKey !== r.cacheKey) return; // hasil fetch tab/tanggal lama yang sudah ditinggalkan

    if (!data.ringkasan || data.ringkasan.total_jadwal_sesi === 0) {
      setState('empty');
      return;
    }
    setState('ok');

    renderCacheInfo(r, cachedAt);
    renderStatCards(data.ringkasan);
    renderDonut(data.ringkasan);
    renderTren(data.tren, data.tren_tipe);
    renderKehadiran(data.kehadiran);
    renderGuruBelum(data.guru_belum_isi);
  }

  function renderCacheInfo(r, cachedAt) {
    var jam = new Date(cachedAt);
    var jamStr = jam.getHours().toString().padStart(2, '0') + ':' + jam.getMinutes().toString().padStart(2, '0');
    var ttlLabel = r.ttlMs >= TTL_1MINGGU ? '1 minggu' : (r.ttlMs >= TTL_1HARI ? '1 hari' : '2 jam');
    $cacheInfo.textContent = 'Diperbarui pukul ' + jamStr + ' · cache ' + ttlLabel;
  }

  function animateNumber($el, target) {
    var start = 0;
    var dur = 600;
    var t0 = performance.now();
    function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      $el.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderStatCards(r) {
    animateNumber(document.getElementById('statTotalSesi'), r.total_jadwal_sesi);
    animateNumber(document.getElementById('statTerisi'), r.total_jurnal_terisi);
    document.getElementById('statPersen').textContent = r.persentase_terisi + '%';
    animateNumber(document.getElementById('statGuruBelum'), r.jumlah_guru_belum_isi);
    document.getElementById('statGuruTotal').textContent = r.jumlah_guru_dijadwalkan + ' guru dijadwalkan';
  }

  function renderDonut(r) {
    var ctx = document.getElementById('chartDonut').getContext('2d');
    var belum = Math.max(0, r.total_jadwal_sesi - r.total_jurnal_terisi);
    document.getElementById('donutBigNum').textContent = r.persentase_terisi + '%';
    if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Terisi', 'Belum'],
        datasets: [{
          data: [r.total_jurnal_terisi, belum],
          backgroundColor: ['#0d8f4f', '#e5e9e6'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '72%',
        animation: { animateRotate: true, duration: 700 },
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });
  }

  function renderTren(tren, tipe) {
    var ctx = document.getElementById('chartTren').getContext('2d');
    var labels = tren.map(function (t) { return t.label; });
    var values = tren.map(function (t) { return t.jumlah; });
    // 'jam' (1 hari, ~12 titik) → bar; 'harian' (rentang minggu, bisa banyak titik) → line, lebih enak dibaca
    var pakaiBar = (tipe === 'jam');
    if (chartTren) chartTren.destroy();
    chartTren = new Chart(ctx, {
      type: pakaiBar ? 'bar' : 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jurnal',
          data: values,
          borderColor: '#2563eb',
          backgroundColor: pakaiBar ? '#93b7fb' : 'rgba(37,99,235,.12)',
          fill: !pakaiBar,
          tension: 0.35,
          pointRadius: pakaiBar ? 0 : 3,
          pointBackgroundColor: '#2563eb',
          borderRadius: pakaiBar ? 6 : 0,
        }],
      },
      options: {
        animation: { duration: 700 },
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef1ef' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderKehadiran(k) {
    var ctx = document.getElementById('chartKehadiran').getContext('2d');
    if (chartKehadiran) chartKehadiran.destroy();
    chartKehadiran = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Hadir', 'Sakit', 'Izin', 'Alpa'],
        datasets: [{
          data: [k.hadir, k.sakit, k.izin, k.alpa],
          backgroundColor: ['#0d8f4f', '#f59e0b', '#2563eb', '#dc2626'],
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        animation: { duration: 700 },
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef1ef' } },
          y: { grid: { display: false } },
        },
      },
    });
    document.getElementById('kehadiranTotal').textContent = k.total + ' data kehadiran tercatat';
  }

  function renderGuruBelum(list) {
    var $wrap = document.getElementById('guruBelumList');
    var $count = document.getElementById('guruBelumCount');
    $count.textContent = list.length;

    if (list.length === 0) {
      $wrap.innerHTML = '<div class="dash-empty-mini"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Semua guru sudah mengisi jurnal.</div>';
      return;
    }

    $wrap.innerHTML = list.map(function (g) {
      var initial = (g.nama || '?').trim().charAt(0).toUpperCase();
      var detailRows = g.detail.map(function (d) {
        var labelTgl = d.hari ? (d.hari.charAt(0) + d.hari.substring(1, 3).toLowerCase() + ' ' + d.tanggal.substring(8, 10) + '/' + d.tanggal.substring(5, 7)) : '';
        return '<div class="gb-detail-row"><span>' + esc(d.nama_kelas) + ' · ' + esc(d.nama_mapel) + '</span><span class="gb-detail-jam">' + esc(d.jam_label) + (labelTgl ? ' · ' + esc(labelTgl) : '') + '</span></div>';
      }).join('');
      var lebih = g.jumlah_sesi_belum > g.detail.length ? '<div class="gb-detail-more">+' + (g.jumlah_sesi_belum - g.detail.length) + ' sesi lainnya</div>' : '';

      return '<details class="gb-item">'
        + '<summary><span class="gb-avatar">' + initial + '</span>'
        + '<span class="gb-name">' + esc(g.nama) + '</span>'
        + '<span class="gb-badge">' + g.jumlah_sesi_belum + ' sesi</span></summary>'
        + '<div class="gb-detail">' + detailRows + lebih + '</div>'
        + '</details>';
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ── Mulai ──
  loadActiveTab(false);

})();
