/* ============================================
   UTIL — fungsi murni (tanggal, normalisasi, parser pH/TSS, rekap kerusakan)
   Tidak menyentuh DOM, sehingga mudah diuji.
   ============================================ */

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Indeks kolom (0-based) sesuai urutan Google Form
const KOL = {
  TIMESTAMP: 0, TANGGAL: 1, POND: 2, LV: 3, SOP: 4, ALKON: 5, PH_METER: 6, TSS_METER: 7,
  BUFFER: 8, JAKET: 9, BOOT: 10, SARUNG: 11, APAR: 12, RADIO: 13, EYE_WASH: 14, APRON: 15,
  SAMPLING: 16, PEKERJA: 17, KETERANGAN: 18
};

/* ── Tanggal (semua tanggal disimpan sebagai teks ISO "YYYY-MM-DD") ── */
const pad2 = n => String(n).padStart(2, '0');
function isoKeDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function dateKeIso(dt) { return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`; }
function tambahHari(iso, n) { const d = isoKeDate(iso); d.setDate(d.getDate() + n); return dateKeIso(d); }
function hariIni() { return dateKeIso(new Date()); }
function awalMinggu(iso) { const d = isoKeDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dateKeIso(d); } // Senin
function akhirBulan(y, m) { return dateKeIso(new Date(y, m, 0)); } // m: 1-12
function selisihHari(a, b) { return Math.round((isoKeDate(b) - isoKeDate(a)) / 86400000); }
function daftarTanggal(dari, sampai) { const out = []; for (let d = dari; d <= sampai; d = tambahHari(d, 1)) out.push(d); return out; }

function fmtTgl(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function fmtTglPanjang(iso, denganHari = false) {
  if (!iso) return '';
  const d = isoKeDate(iso);
  return `${denganHari ? HARI[d.getDay()] + ', ' : ''}${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTglSingkat(iso) { const d = isoKeDate(iso); return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`; }
function fmtWaktu(tsIso) {
  if (!tsIso) return '';
  const [tgl, jam = ''] = tsIso.split('T');
  return `${fmtTgl(tgl)} ${jam.slice(0, 5)}`.trim();
}

/** Bagian judul: "BULAN SEPTEMBER TAHUN 2026" / "BULAN SEPTEMBER – OKTOBER TAHUN 2026" */
function judulBulanTahun(dari, sampai) {
  const a = isoKeDate(dari), b = isoKeDate(sampai);
  const bA = BULAN[a.getMonth()].toUpperCase(), bB = BULAN[b.getMonth()].toUpperCase();
  if (a.getFullYear() !== b.getFullYear()) return `BULAN ${bA} ${a.getFullYear()} – ${bB} TAHUN ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth()) return `BULAN ${bA} – ${bB} TAHUN ${a.getFullYear()}`;
  return `BULAN ${bA} TAHUN ${a.getFullYear()}`;
}

/** "1 – 30 September 2026", "28 September – 4 Oktober 2026" */
function teksRentang(dari, sampai, denganHari = false) {
  if (dari === sampai) return fmtTglPanjang(dari, denganHari);
  const a = isoKeDate(dari), b = isoKeDate(sampai);
  const hA = denganHari ? HARI[a.getDay()] + ', ' : '', hB = denganHari ? HARI[b.getDay()] + ', ' : '';
  if (a.getFullYear() !== b.getFullYear()) return `${fmtTglPanjang(dari, denganHari)} – ${fmtTglPanjang(sampai, denganHari)}`;
  if (a.getMonth() !== b.getMonth()) return `${hA}${a.getDate()} ${BULAN[a.getMonth()]} – ${hB}${b.getDate()} ${BULAN[b.getMonth()]} ${b.getFullYear()}`;
  return `${hA}${a.getDate()} – ${hB}${b.getDate()} ${BULAN[b.getMonth()]} ${b.getFullYear()}`;
}

/* ── Teks ── */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Isian yang sebenarnya kosong: "", "-", "_", ".", "O", "0", "--" */
function isKosong(s) { return /^[\s\-_.oO0]*$/.test(String(s ?? '')); }
const angka = s => parseFloat(String(s).replace(',', '.'));

/** Seragamkan nama pond memakai APP_CONFIG.POND_ALIAS */
function normPond(raw) {
  const s = String(raw || '').toLowerCase();
  const daftar = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.POND_ALIAS) || [];
  for (const p of daftar) if (p.kunci.some(k => s.includes(k))) return p.nama;
  const bersih = String(raw || '').replace(/\s+/g, ' ').trim();
  return bersih ? bersih.replace(/\b\w/g, c => c.toUpperCase()) : '(Tanpa nama)';
}

/* ── Parser kolom "Hasil Sampling Enviro" ──
   Contoh isi nyata: "PH : 7.01 TSS : 167", "7,36", "Ph, 7,01,tss, 16", "6.76.tss 21",
   "pH:6.76 tss:43", "PH 7,18   39", "pH 6.90 tss 14 jam 10:18", "ENV 6.98 TSS 46"
   Hasil: { ph, tss, status: 'kosong' | 'ok' | 'cek' }                                    */
function parseSampling(raw) {
  const hasil = { ph: null, tss: null, status: 'kosong' };
  if (isKosong(raw)) return hasil;
  let s = String(raw).toLowerCase().replace(/jam\s*\d{1,2}[:.]\d{2}/g, ' ');

  // TSS: angka setelah kata "tss"/"tts"
  let sebelumTss = s, sisa = '';
  const mT = s.match(/t[st]s\W*?(\d+(?:[.,]\d+)?)/);
  if (mT) {
    hasil.tss = angka(mT[1]);
    sebelumTss = s.slice(0, mT.index);
  }

  // pH: angka desimal pertama sebelum TSS (7.01 / 7,01)
  const mP = sebelumTss.match(/(^|[^\d])(\d{1,2})[.,](\d{1,2})(?!\d)/);
  if (mP) {
    hasil.ph = angka(`${mP[2]}.${mP[3]}`);
    sisa = sebelumTss.slice(mP.index + mP[0].length);
  } else {
    const mPi = sebelumTss.match(/ph\W*(\d{1,2})(?![\d.,])/); // "pH 7" (bulat)
    if (mPi) { hasil.ph = Number(mPi[1]); sisa = sebelumTss.slice(mPi.index + mPi[0].length); }
  }

  // Tanpa kata "tss": angka bulat sesudah pH dianggap TSS ("PH 7,18   39")
  if (hasil.tss === null && hasil.ph !== null) {
    const mSisa = sisa.match(/(^|[^\d.,])(\d{1,5})(?![\d.,]\d)/);
    if (mSisa) hasil.tss = Number(mSisa[2]);
  }

  let curiga = false;
  if (hasil.ph === null && /\d/.test(sebelumTss)) curiga = true; // ada angka tapi bukan pH wajar (mis. "PH 640")
  if (hasil.ph !== null && (hasil.ph < 3 || hasil.ph > 12)) { hasil.ph = null; curiga = true; }
  if (hasil.tss !== null && (isNaN(hasil.tss) || hasil.tss > 20000)) { hasil.tss = null; curiga = true; }

  if (hasil.ph !== null || hasil.tss !== null) hasil.status = curiga ? 'cek' : 'ok';
  else hasil.status = /\d/.test(s) ? 'cek' : 'kosong';
  return hasil;
}

/** Status batas mutu satu baris */
function cekBatas(row, p) {
  const phLuar = row.ph !== null && (row.ph < p.phMin || row.ph > p.phMax);
  const tssLuar = row.tss !== null && row.tss > p.tssMax;
  return { phLuar, tssLuar, luar: phLuar || tssLuar };
}

/* ── Rekap kerusakan berulang ── */
const BUKAN_MASALAH = /^(ok|oke|okey|aman|baik|lengkap|normal|nihil|beres|tidak ada|tdk ada|tidak ad|tidtak ada|tudak ada|tidak ada keterangan rusak|tidak ada rusak|hadir semua|lengkap dan fit)$/;

function pecahKeterangan(raw) {
  if (isKosong(raw)) return [];
  return String(raw)
    .replace(/on\s*\/\s*off/gi, 'on-off')
    .split(/\s*-\s+|\s+-\s*|\/|&|,|;|\s+dan\s+|\n/i)
    .map(t => t.trim())
    .filter(t => {
      const n = normMasalah(t);
      return n.length >= 3 && !BUKAN_MASALAH.test(n);
    });
}

function normMasalah(s) {
  return String(s).toLowerCase()
    .replace(/on\s*-?\s*off|onn off/g, 'onoff')
    .replace(/b'?\s*up/g, 'backup')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenMasalah(n) { return new Set(n.split(' ').filter(t => !/^\d$/.test(t))); }

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function kemiripan(a, b) {
  const ta = tokenMasalah(a), tb = tokenMasalah(b);
  // Nomor unit berbeda (mis. "pH 34 service" vs "pH 32 service") → masalah berbeda
  const na = [...ta].filter(t => /^\d{2,}$/.test(t)), nb = [...tb].filter(t => /^\d{2,}$/.test(t));
  if (na.length && nb.length && !na.some(t => nb.includes(t))) return 0;
  let sama = 0;
  ta.forEach(t => { if (tb.has(t)) sama++; });
  const dice = (ta.size + tb.size) ? (2 * sama) / (ta.size + tb.size) : 0;
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
  return Math.max(dice, lev);
}

function rapikanLabel(s) {
  const t = String(s).replace(/\s+/g, ' ').replace(/[\s.]+\d$/, '').replace(/^[\s.\-_]+|[\s.\-_]+$/g, '').toLowerCase();
  const singkatan = { ph: 'pH', tss: 'TSS', rt: 'RT', lv: 'LV', ew: 'EW', fe: 'FE', al: 'AL', pap: 'PAP', kpc: 'KPC' };
  const out = t.replace(/\b[a-z]+\b/g, w => singkatan[w] || w);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * rows: baris terurut tanggal naik. refIso: tanggal data terbaru.
 * Hasil: [{pond, label, jumlah, pertama, terakhir, aktif, varian}]
 */
function rekapKerusakan(rows, refIso, hariAktif) {
  const grup = [];
  for (const r of rows) {
    for (const item of pecahKeterangan(r.v[KOL.KETERANGAN])) {
      const n = normMasalah(item);
      let terbaik = null, skor = 0;
      for (const g of grup) {
        if (g.pond !== r.pond) continue;
        const k = kemiripan(n, g.kunci);
        if (k > skor) { skor = k; terbaik = g; }
      }
      if (!terbaik || skor < 0.6) {
        terbaik = { pond: r.pond, kunci: n, varian: new Map(), baris: new Set(), pertama: r.tgl, terakhir: r.tgl };
        grup.push(terbaik);
      }
      terbaik.varian.set(item, (terbaik.varian.get(item) || 0) + 1);
      terbaik.baris.add(r.idKlien || r.r);
      if (r.tgl < terbaik.pertama) terbaik.pertama = r.tgl;
      if (r.tgl > terbaik.terakhir) terbaik.terakhir = r.tgl;
    }
  }
  const batasAktif = tambahHari(refIso, -(hariAktif - 1));
  return grup.map(g => {
    const label = [...g.varian.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      pond: g.pond, label: rapikanLabel(label), jumlah: g.baris.size,
      pertama: g.pertama, terakhir: g.terakhir, aktif: g.terakhir >= batasAktif,
      varian: g.varian.size
    };
  }).sort((a, b) => (b.aktif - a.aktif) || (b.jumlah - a.jumlah) || a.pond.localeCompare(b.pond));
}

/** Rata-rata, abaikan null */
function rataRata(arr) { const v = arr.filter(x => x !== null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

/* Ekspor untuk pengujian di Node (diabaikan di browser) */
if (typeof module !== 'undefined') {
  module.exports = { parseSampling, normPond, pecahKeterangan, rekapKerusakan, judulBulanTahun, teksRentang, awalMinggu, isKosong, kemiripan, normMasalah };
}
