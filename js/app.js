/* ============================================
   APP — state, navigasi SPA, tema, notifikasi, data & antrian kirim
   Prinsip gas-instant-ux:
   1. SPA      : pindah menu = tampil/sembunyi section, render hanya saat dibutuhkan
   2. Optimis  : data terakhir dari localStorage tampil seketika; input & pengaturan
                 langsung terlihat, dikirim ke server di latar belakang (antrian)
   3. Cache    : server memakai CacheService; browser memakai localStorage
   4. Batch    : satu permintaan getData untuk semua menu
   ============================================ */

const STATE = {
  headers: [], rows: [], ponds: [], pengaturan: {},
  dataTerbaru: null, dataTerlama: null, dimuatPada: null,
  siap: false, sidik: '', modeImpor: false, sheetInput: 'Input Aplikasi'
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ── Penyimpanan lokal (aman bila localStorage diblokir) ── */
const KUNCI = { data: 'inspeksi-data-v1', antrian: 'inspeksi-antrian-v1', draft: 'inspeksi-draft-v1', tema: 'inspeksi-tema' };
const simpanan = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
};

/* ── Debounce ── */
function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ── Ambil data sedini mungkin, sebelum DOM selesai (paralel dengan render awal) ── */
const fetchAwal = gasUrlSiap() ? apiGet('getData') : null;
if (fetchAwal) fetchAwal.catch(() => { /* ditangani di segarkan() */ });

/* ── Notifikasi & loading ── */
let toastTimer;
function notif(pesan, jenis = 'ok') {
  const t = $('#toast');
  t.textContent = pesan;
  t.className = `toast show ${jenis === 'error' ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), jenis === 'error' ? 6000 : 3000);
}
function loading(tampil, teks = 'Memuat data…') {
  $('#loading-text').textContent = teks;
  $('#loading').hidden = !tampil;
}

/* ── Tema ── */
function setTema(t) {
  document.documentElement.setAttribute('data-theme', t);
  $('#btn-theme i').className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
  simpanan.set(KUNCI.tema, t);
  if (STATE.siap) { kotor.add('dashboard'); renderJikaAktif('dashboard'); } // warna grafik ikut tema
}
function temaAwal() {
  let t = simpanan.get(KUNCI.tema);
  if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTema(t);
}

/* ══════════ Prinsip 1 — SPA + render malas ══════════ */
const SECTIONS = ['dashboard', 'laporan', 'input', 'pengaturan'];
const kotor = new Set();     // menu yang perlu digambar ulang karena data berubah
let sectionAktif = 'dashboard';

const PENGGAMBAR = {
  dashboard: () => Dashboard.siapkan(),
  laporan: () => Laporan.siapkan(),
  input: () => Input.siapkan(),
  pengaturan: () => Pengaturan.isi()
};

function renderSection(id) {
  if (!STATE.siap || !kotor.has(id)) return;
  kotor.delete(id);
  PENGGAMBAR[id]();
}
function renderJikaAktif(id) { if (id === sectionAktif) renderSection(id); }

/** Data berubah → gambar menu aktif sekarang, menu lain saat browser senggang */
function tandaiSemuaKotor() {
  SECTIONS.forEach(s => kotor.add(s));
  renderSection(sectionAktif);
  const senggang = window.requestIdleCallback || (fn => setTimeout(fn, 120));
  SECTIONS.filter(s => s !== sectionAktif).forEach(s => senggang(() => renderSection(s)));
}

function navigasi(id) {
  if (!SECTIONS.includes(id)) id = 'dashboard';
  sectionAktif = id;
  $$('.section').forEach(s => s.classList.toggle('active', s.dataset.section === id));
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === id));
  window.scrollTo({ top: 0 });
  renderSection(id);                                   // biasanya sudah tergambar → 0 ms
  if (id === 'dashboard' && STATE.siap) requestAnimationFrame(() => Dashboard.resizeCharts());
}
window.addEventListener('hashchange', () => navigasi(location.hash.slice(1)));

/* ══════════ Olah data API ══════════ */
function hashTeks(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); }

function barisDariMentah(x) {
  const v = [fmtWaktu(x[1]), fmtTgl(x[2])].concat(x.slice(3).map(s => String(s ?? '')));
  while (v.length < 19) v.push('');
  const s = parseSampling(v[KOL.SAMPLING]);
  return { r: x[0], ts: x[1], tgl: x[2], v, pondRaw: v[KOL.POND], pond: normPond(v[KOL.POND]), ph: s.ph, tss: s.tss, sStatus: s.status };
}

function urutkanBaris() {
  STATE.rows.sort((a, b) => (a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : (a.ts < b.ts ? -1 : 1)));
}

function hitungTurunan() {
  const ada = new Set(STATE.rows.map(r => r.pond));
  const utama = APP_CONFIG.POND_ALIAS.map(p => p.nama).filter(n => ada.has(n));
  STATE.ponds = utama.concat([...ada].filter(n => !utama.includes(n)).sort());
  STATE.dataTerlama = STATE.rows.length ? STATE.rows[0].tgl : hariIni();
  STATE.dataTerbaru = STATE.rows.length ? STATE.rows.reduce((m, r) => (r.tgl > m ? r.tgl : m), STATE.rows[0].tgl) : hariIni();
}

function olahPengaturan(p = {}) {
  return {
    judulLokasi: p.judulLokasi || 'POND CHARLIE UTARA PT. PAP',
    jabatanTtd: p.jabatanTtd || 'Supervisor Charlie Utara',
    namaTtd: p.namaTtd || '',
    phMin: Number(p.phMin ?? 6),
    phMax: Number(p.phMax ?? 9),
    tssMax: Number(p.tssMax ?? 200),
    marginPdf: Number(p.marginPdf || 6),
    orientasiPdf: p.orientasiPdf === 'portrait' ? 'portrait' : 'landscape',
    pinDiatur: !!p.pinDiatur
  };
}

function olahData(d) {
  STATE.headers = d.headers;
  STATE.modeImpor = !!d.modeImpor;
  STATE.sheetInput = d.sheetInput || 'Input Aplikasi';
  STATE.pengaturan = olahPengaturan(d.pengaturan);
  STATE.rows = d.rows.filter(x => x[2]).map(barisDariMentah);
  gabungkanAntrian();          // kiriman yang belum sampai server tetap terlihat
  urutkanBaris();
  hitungTurunan();
  STATE.siap = true;
}

/* ══════════ Prinsip 2 & 3 — tampil dari cache, segarkan di latar ══════════ */
function setSync(teks, kelas = '') {
  const el = $('#sync-status');
  el.textContent = teks;
  el.dataset.state = kelas;
}
function teksSync() {
  const jam = STATE.dimuatPada ? new Date(STATE.dimuatPada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–';
  const n = antrian().length;
  return `${STATE.rows.length} entri · ${jam}${n ? ` · ${n} belum terkirim` : ''}`;
}
function perbaruiSync() { setSync(teksSync(), antrian().length ? 'warn' : ''); }

let sedangSegar = null;
async function segarkan({ awal = false, umumkan = false } = {}) {
  if (sedangSegar) return sedangSegar;
  const btn = $('#btn-refresh');
  btn.classList.add('spin');
  if (STATE.siap) setSync('Memperbarui…', 'sync');
  sedangSegar = (async () => {
    try {
      const d = await (awal && fetchAwal ? fetchAwal : apiGet('getData'));
      const sidik = hashTeks(JSON.stringify([d.headers, d.rows, d.pengaturan, d.modeImpor]));
      STATE.dimuatPada = Date.now();
      simpanan.set(KUNCI.data, { d, waktu: STATE.dimuatPada });
      if (sidik !== STATE.sidik || !STATE.siap) {     // gambar ulang hanya bila ada perubahan
        STATE.sidik = sidik;
        olahData(d);
        $('#brand-sub').textContent = STATE.pengaturan.judulLokasi;
        tandaiSemuaKotor();
      }
      perbaruiSync();
      if (umumkan) notif('Data sudah yang terbaru.');
      kirimAntrian();
    } catch (err) {
      if (STATE.siap) {
        setSync(`Offline · ${teksSync()}`, 'warn');
        notif('Tidak bisa menghubungi server. Menampilkan data tersimpan.', 'error');
      } else {
        tampilkanGagal(err);
      }
    } finally {
      btn.classList.remove('spin');
      loading(false);
      sedangSegar = null;
    }
  })();
  return sedangSegar;
}

function tampilkanGagal(err) {
  setSync('Gagal memuat', 'warn');
  notif('Gagal memuat data: ' + err.message, 'error');
  const pesan = gasUrlSiap()
    ? `<b>Data belum bisa dimuat.</b><br>${esc(err.message)}<br><span class="small">Cek: Web App sudah di-deploy (Execute as: Me, Who has access: Anyone) dan URL di <code>js/config.js</code> benar.</span>`
    : `<b>Aplikasi belum tersambung ke spreadsheet.</b><br>Isi <code>GAS_URL</code> di file <code>js/config.js</code> dengan URL <code>/exec</code> dari Apps Script, lalu push ulang ke GitHub.`;
  $('#kpi-grid').innerHTML = `<div class="alert" style="grid-column:1/-1">${pesan}</div>`;
}

/* ══════════ Antrian kirim (input optimis) ══════════ */
function antrian() { return simpanan.get(KUNCI.antrian) || []; }
function setAntrian(a) { simpanan.set(KUNCI.antrian, a); perbaruiSync(); }

/** Baris lokal untuk kiriman yang belum dikonfirmasi server */
function barisDariAntrian(item) {
  const d = item.data, now = item.waktu;
  const sampling = d.ph !== '' && d.tss !== '' ? `pH ${Number(String(d.ph).replace(',', '.')).toFixed(2)} TSS ${d.tss}`
    : d.ph !== '' ? `pH ${Number(String(d.ph).replace(',', '.')).toFixed(2)}` : d.tss !== '' ? `TSS ${d.tss}` : '-';
  const isi = [d.pond, d.lv, d.sop, d.alkon, d.phMeter, d.tssMeter, d.buffer, d.jaket, d.boot, d.sarungTangan, d.apar,
    d.radio, d.eyeWash, d.apron, sampling, d.pekerjaTidakMasuk || '-', d.keterangan || '-'];
  const row = barisDariMentah(['Menunggu', now, d.tanggal].concat(isi.map(x => x ?? '')));
  row.pending = true;
  row.idKlien = item.idKlien;
  return row;
}

function gabungkanAntrian() {
  STATE.rows = STATE.rows.filter(r => !r.pending).concat(antrian().map(barisDariAntrian));
}

let sedangKirim = false;
async function kirimAntrian() {
  if (sedangKirim || !gasUrlSiap()) return;
  sedangKirim = true;
  let adaTerkirim = false;
  try {
    for (const item of antrian()) {
      let res;
      try {
        res = await apiPost('simpanInspeksi', { data: Object.assign({}, item.data, { idKlien: item.idKlien }) });
      } catch (e) {
        break; // jaringan putus → coba lagi nanti (tombol ⟳, kembali online, atau buka ulang)
      }
      // Berhasil atau ditolak validasi server → keluarkan dari antrian
      setAntrian(antrian().filter(x => x.idKlien !== item.idKlien));
      if (res.success) {
        adaTerkirim = true;
        notif(res.message || 'Terkirim ke spreadsheet.');
      } else {
        notif('Ditolak server: ' + res.message, 'error');
        gabungkanAntrian(); hitungTurunan(); tandaiSemuaKotor();
      }
    }
  } finally {
    sedangKirim = false;
    perbaruiSync();
  }
  if (adaTerkirim) segarkan(); // ambil nomor baris asli dari server, di latar
}

/* ── Mulai ── */
document.addEventListener('DOMContentLoaded', () => {
  temaAwal();
  $('#btn-theme').addEventListener('click', () => setTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  $('#btn-refresh').addEventListener('click', () => { kirimAntrian(); segarkan({ umumkan: true }); });
  Dashboard.init();
  Laporan.init();
  Input.init();
  Pengaturan.init();
  navigasi(location.hash.slice(1) || 'dashboard');

  // 1) Tampilkan data terakhir dari browser SEKETIKA (tanpa menunggu server)
  const cache = simpanan.get(KUNCI.data);
  if (cache && cache.d) {
    STATE.dimuatPada = cache.waktu;
    STATE.sidik = hashTeks(JSON.stringify([cache.d.headers, cache.d.rows, cache.d.pengaturan, cache.d.modeImpor]));
    olahData(cache.d);
    $('#brand-sub').textContent = STATE.pengaturan.judulLokasi;
    tandaiSemuaKotor();
    perbaruiSync();
  } else {
    loading(true, 'Mengambil data dari spreadsheet…'); // hanya saat pertama kali dibuka
  }
  // 2) Segarkan dari server di latar belakang
  segarkan({ awal: true });

  // 3) Segarkan otomatis saat tab dibuka lagi (> 1 menit) dan kirim antrian saat kembali online
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (STATE.dimuatPada || 0) > 60000) segarkan();
  });
  window.addEventListener('online', () => { kirimAntrian(); segarkan(); });
});
