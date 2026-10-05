/* ============================================
   APP — state, navigasi SPA, tema, notifikasi, pemuatan data
   Prinsip gas-instant-ux:
   1. SPA     : pindah menu = tampil/sembunyi section, digambar hanya saat perlu
   2. Optimis : data terakhir dari localStorage tampil seketika; pengaturan
                langsung diterapkan lalu disimpan di latar
   3. Cache   : server mengirim paket JSON jadi dari CacheService; browser localStorage
   4. Batch   : satu permintaan getData untuk semua menu, dimulai di <head>
   ============================================ */

const STATE = {
  headers: [], rows: [], ponds: [], pengaturan: {},
  dataTerbaru: null, dataTerlama: null, dimuatPada: null,
  siap: false, sidik: '', modeImpor: false,
  logo: null            // { dataUrl, versi, w, h }
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ── Penyimpanan lokal (aman bila localStorage diblokir) ── */
const KUNCI = { data: 'inspeksi-data-v1', tema: 'inspeksi-tema' };
const simpanan = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
};
// Bersihkan sisa fitur Input versi lama
['inspeksi-antrian-v1', 'inspeksi-draft-v1'].forEach(k => simpanan.del(k));

function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ── Data pertama: pakai fetch yang SUDAH dimulai di <head> (index.html) ── */
const fetchAwal = window.__dataAwal
  ? window.__dataAwal.then(dataDariRespons)
  : (gasUrlSiap() ? apiGet('getData') : null);
if (fetchAwal) fetchAwal.catch(() => { /* ditangani di segarkan() */ });

/* ── Notifikasi ── */
let toastTimer;
function notif(pesan, jenis = 'ok') {
  const t = $('#toast');
  t.textContent = pesan;
  t.className = `toast show ${jenis === 'error' ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), jenis === 'error' ? 6000 : 3000);
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
const SECTIONS = ['dashboard', 'laporan', 'pengaturan'];
const kotor = new Set();     // menu yang perlu digambar ulang karena data berubah
let sectionAktif = 'dashboard';

const PENGGAMBAR = {
  dashboard: () => Dashboard.siapkan(),
  laporan: () => Laporan.siapkan(),
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
  if (id === 'pengaturan' && !Admin.aktif()) {          // Pengaturan khusus admin
    id = 'dashboard';
    if (location.hash === '#pengaturan') history.replaceState(null, '', '#dashboard');
  }
  sectionAktif = id;
  $$('.section').forEach(s => s.classList.toggle('active', s.dataset.section === id));
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === id));
  window.scrollTo({ top: 0 });
  renderSection(id);                                   // biasanya sudah tergambar → 0 ms
  if (id === 'dashboard' && STATE.siap) requestAnimationFrame(() => Dashboard.resizeCharts());
}
window.addEventListener('hashchange', () => navigasi(location.hash.slice(1)));

/* ══════════ Kerangka saat pertama kali (pengganti layar loading) ══════════ */
function tampilkanKerangka() {
  document.body.classList.add('memuat');
  const kartu = () => '<div class="kpi"><span class="sk t" style="width:45%"></span><span class="sk v"></span><span class="sk t" style="width:70%"></span></div>';
  $('#kpi-grid').innerHTML = kartu().repeat(4);
  $('#insight-list').innerHTML = ['85%', '70%', '78%'].map(w => `<li style="list-style:none"><span class="sk t" style="width:${w}"></span></li>`).join('');
  $('#pond-grid').innerHTML = '<div class="pond-card"><span class="sk t" style="width:50%"></span><span class="sk t" style="width:80%"></span><span class="sk v" style="width:100%;height:46px"></span></div>'.repeat(5);
}
function selesaiMemuat() { document.body.classList.remove('memuat'); }

/* ══════════ Olah data API ══════════ */
function hashTeks(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); }
const sidikData = d => hashTeks(JSON.stringify([d.headers, d.rows, d.pengaturan, d.modeImpor]));

function barisDariMentah(x) {
  const v = [fmtWaktu(x[1]), fmtTgl(x[2])].concat(x.slice(3).map(s => String(s ?? '')));
  while (v.length < 19) v.push('');
  const s = parseSampling(v[KOL.SAMPLING]);
  return { r: x[0], ts: x[1], tgl: x[2], v, pondRaw: v[KOL.POND], pond: normPond(v[KOL.POND]), ph: s.ph, tss: s.tss, sStatus: s.status };
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
    logoVersi: String(p.logoVersi || '')
  };
}

function olahData(d) {
  STATE.headers = d.headers;
  STATE.modeImpor = !!d.modeImpor;
  STATE.pengaturan = olahPengaturan(d.pengaturan);
  STATE.rows = d.rows.filter(x => x[2]).map(barisDariMentah)
    .sort((a, b) => (a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : (a.ts < b.ts ? -1 : 1)));
  const ada = new Set(STATE.rows.map(r => r.pond));
  const utama = APP_CONFIG.POND_ALIAS.map(p => p.nama).filter(n => ada.has(n));
  STATE.ponds = utama.concat([...ada].filter(n => !utama.includes(n)).sort());
  STATE.dataTerlama = STATE.rows.length ? STATE.rows[0].tgl : hariIni();
  STATE.dataTerbaru = STATE.rows.length ? STATE.rows.reduce((m, r) => (r.tgl > m ? r.tgl : m), STATE.rows[0].tgl) : hariIni();
  STATE.siap = true;
}

function terapkanData(d, sidik) {
  STATE.sidik = sidik;
  olahData(d);
  $('#brand-sub').textContent = STATE.pengaturan.judulLokasi;
  selesaiMemuat();
  tandaiSemuaKotor();
  Logo.sinkron(); // unduh logo hanya bila versinya berubah (di latar)
}

function perbaruiSync() {
  const jam = STATE.dimuatPada ? new Date(STATE.dimuatPada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–';
  $('#sync-status').textContent = `${STATE.rows.length} entri · ${jam}`;
}

/* ══════════ Prinsip 2 & 3 — tampil dari cache, segarkan senyap di latar ══════════ */
let sedangSegar = null;
async function segarkan({ awal = false, paksa = false } = {}) {
  if (sedangSegar) return sedangSegar;
  const btn = $('#btn-refresh');
  if (paksa) btn.classList.add('spin'); // hanya tombol ⟳ yang berputar; penyegaran otomatis tidak terlihat
  sedangSegar = (async () => {
    try {
      const d = await (awal && fetchAwal ? fetchAwal : apiGet('getData', paksa ? { segar: 1 } : {}));
      STATE.dimuatPada = Date.now();
      simpanan.set(KUNCI.data, { d, waktu: STATE.dimuatPada });
      const sidik = sidikData(d);
      if (sidik !== STATE.sidik || !STATE.siap) terapkanData(d, sidik); // gambar ulang hanya bila berubah
      perbaruiSync();
      if (paksa) notif('Data sudah yang terbaru.');
    } catch (err) {
      if (STATE.siap) {
        if (paksa) notif('Tidak bisa menghubungi server. Menampilkan data tersimpan.', 'error');
      } else {
        tampilkanGagal(err);
      }
    } finally {
      btn.classList.remove('spin');
      sedangSegar = null;
    }
  })();
  return sedangSegar;
}

function tampilkanGagal(err) {
  selesaiMemuat();
  $('#sync-status').textContent = 'Gagal memuat';
  notif('Gagal memuat data: ' + err.message, 'error');
  const pesan = gasUrlSiap()
    ? `<b>Data belum bisa dimuat.</b><br>${esc(err.message)}<br><span class="small">Cek: Web App sudah di-deploy (Execute as: Me, Who has access: Anyone) dan URL di <code>js/config.js</code> benar.</span>`
    : `<b>Aplikasi belum tersambung ke spreadsheet.</b><br>Isi <code>GAS_URL</code> di file <code>js/config.js</code> dengan URL <code>/exec</code> dari Apps Script, lalu push ulang ke GitHub.`;
  $('#kpi-grid').innerHTML = `<div class="alert" style="grid-column:1/-1">${pesan}</div>`;
  $('#insight-list').innerHTML = '';
  $('#pond-grid').innerHTML = '';
}

/* ── Mulai ── */
document.addEventListener('DOMContentLoaded', () => {
  temaAwal();
  $('#btn-theme').addEventListener('click', () => setTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  $('#btn-refresh').addEventListener('click', () => segarkan({ paksa: true }));
  Logo.muatLokal();
  Dashboard.init();
  Laporan.init();
  Pengaturan.init();
  KonfirmasiUnduh.init();
  Admin.init();
  navigasi(location.hash.slice(1) || 'dashboard');

  // 1) Data terakhir dari browser tampil SEKETIKA (tanpa menunggu server)
  const cache = simpanan.get(KUNCI.data);
  if (cache && cache.d && cache.d.headers) {
    STATE.dimuatPada = cache.waktu;
    terapkanData(cache.d, sidikData(cache.d));
    perbaruiSync();
  } else {
    tampilkanKerangka(); // pertama kali: kerangka halus, tanpa layar loading
  }
  // 2) Segarkan dari server di latar belakang (senyap)
  segarkan({ awal: true });

  // 3) Segarkan senyap saat tab dibuka lagi (> 1 menit) atau kembali online
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (STATE.dimuatPada || 0) > 60000) segarkan();
  });
  window.addEventListener('online', () => segarkan());
});
