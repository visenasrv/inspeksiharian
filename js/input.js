/* ============================================
   INPUT — form inspeksi baru → baris baru di sheet Google Form
   ============================================ */

// Kolom peralatan: [kunci payload, indeks kolom sheet]
const FIELD_PERALATAN = [
  ['lv', KOL.LV], ['sop', KOL.SOP], ['alkon', KOL.ALKON], ['phMeter', KOL.PH_METER], ['tssMeter', KOL.TSS_METER],
  ['buffer', KOL.BUFFER], ['jaket', KOL.JAKET], ['boot', KOL.BOOT], ['sarungTangan', KOL.SARUNG], ['apar', KOL.APAR],
  ['radio', KOL.RADIO], ['eyeWash', KOL.EYE_WASH], ['apron', KOL.APRON]
];
const POND_LAIN = '__lain__';

const Input = {
  init() {
    const f = $('#form-input');
    f.addEventListener('submit', e => this.simpan(e));
    f.addEventListener('reset', () => setTimeout(() => this.awal(), 0));
    $('#in-pond').addEventListener('change', () => this.gantiPond());
    ['#in-ph', '#in-tss'].forEach(id => $(id).addEventListener('input', () => this.cekLive()));
    // Draf otomatis: isian tidak hilang walau halaman tertutup / sinyal putus
    const simpanDraft = debounce(() => this.simpanDraft(), 400);
    f.addEventListener('input', simpanDraft);
    f.addEventListener('change', simpanDraft);
  },

  /* ── Draf (localStorage) ── */
  idIsian() { return ['in-tanggal', 'in-pond', 'in-pond-lain', 'in-ph', 'in-tss', 'in-pekerja', 'in-keterangan'].concat(FIELD_PERALATAN.map(([k]) => 'in-' + k)); },
  simpanDraft() {
    const d = {};
    this.idIsian().forEach(id => { const el = document.getElementById(id); if (el) d[id] = el.value; });
    simpanan.set(KUNCI.draft, d);
  },
  pulihkanDraft() {
    const d = simpanan.get(KUNCI.draft);
    if (!d) return;
    Object.entries(d).forEach(([id, v]) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; });
    if (d['in-pond'] && !$('#in-pond').value) $('#in-pond').value = ''; // pond lama tidak ada lagi di daftar
    $('#in-pond-lain-wrap').hidden = $('#in-pond').value !== POND_LAIN;
    if ($('#in-tanggal').value === '') $('#in-tanggal').value = hariIni();
  },

  siapkan() {
    // Label peralatan mengikuti judul kolom sheet persis
    const wrap = $('#in-peralatan');
    if (!wrap.dataset.dibuat) {
      wrap.innerHTML = FIELD_PERALATAN.map(([k, idx]) =>
        `<div class="field"><label for="in-${k}">${esc(STATE.headers[idx] || k)}</label><input type="text" id="in-${k}" maxlength="120"></div>`).join('');
      wrap.dataset.dibuat = '1';
    }
    if (STATE.headers[KOL.PEKERJA]) $('#lbl-pekerja').textContent = STATE.headers[KOL.PEKERJA];
    if (STATE.headers[KOL.KETERANGAN]) $('#lbl-keterangan').textContent = STATE.headers[KOL.KETERANGAN];

    const sel = $('#in-pond'), lama = sel.value;
    sel.innerHTML = '<option value="">— pilih pond —</option>' +
      STATE.ponds.map(p => `<option>${esc(p)}</option>`).join('') +
      `<option value="${POND_LAIN}">Lainnya…</option>`;
    if (lama && [...sel.options].some(o => o.value === lama)) sel.value = lama;
    $('#input-sub').textContent = STATE.modeImpor
      ? `Tersimpan ke sheet "${STATE.sheetInput}" di spreadsheet aplikasi, lalu langsung ikut tampil di dashboard dan laporan. Data ini tidak dikirim ke spreadsheet asal Google Form.`
      : 'Tersimpan langsung ke sheet yang sama dengan Google Form.';
    if (!this.draftDipulihkan) { this.draftDipulihkan = true; this.pulihkanDraft(); }
    if (!$('#in-tanggal').value) $('#in-tanggal').value = hariIni();
    this.cekLive();
  },

  awal() {
    $('#in-tanggal').value = hariIni();
    $('#prefill-note').hidden = true;
    $('#in-pond-lain-wrap').hidden = true;
    $$('#form-input .invalid').forEach(el => el.classList.remove('invalid'));
    simpanan.del(KUNCI.draft);
    this.cekLive();
  },

  /** Isi otomatis peralatan dari laporan terakhir pond yang sama (nomor unit jarang berubah) */
  gantiPond() {
    const v = $('#in-pond').value;
    $('#in-pond-lain-wrap').hidden = v !== POND_LAIN;
    const note = $('#prefill-note');
    if (!v || v === POND_LAIN) { note.hidden = true; return; }
    const last = [...STATE.rows].reverse().find(r => r.pond === v);
    if (!last) { note.hidden = true; return; }
    FIELD_PERALATAN.forEach(([k, idx]) => { $(`#in-${k}`).value = last.v[idx]; });
    note.innerHTML = `<i class="bi bi-magic"></i> Kolom peralatan diisi dari laporan <b>${esc(v)}</b> tanggal ${fmtTglPanjang(last.tgl)}. Periksa dan ubah yang berbeda hari ini.`;
    note.hidden = false;
  },

  cekLive() {
    const out = $('#batas-live');
    if (!STATE.siap) return;
    const p = STATE.pengaturan;
    const ph = $('#in-ph').value === '' ? null : angka($('#in-ph').value);
    const tss = $('#in-tss').value === '' ? null : angka($('#in-tss').value);
    if (ph === null && tss === null) { out.innerHTML = `Batas: pH ${p.phMin}–${p.phMax}, TSS ≤ ${p.tssMax} mg/L.`; return; }
    const b = cekBatas({ ph, tss }, p);
    const chip = (nama, nilai, luar) => nilai === null ? '' : `<span class="badge ${luar ? 'bad' : 'ok'}">${nama} ${luar ? 'di luar batas' : 'dalam batas'}</span>`;
    out.innerHTML = chip('pH', ph, b.phLuar) + ' ' + chip('TSS', tss, b.tssLuar);
  },

  async simpan(e) {
    e.preventDefault();
    $$('#form-input .invalid').forEach(el => el.classList.remove('invalid'));
    const salah = [];
    const tgl = $('#in-tanggal'), pondSel = $('#in-pond'), pondLain = $('#in-pond-lain');
    const pond = pondSel.value === POND_LAIN ? pondLain.value.trim() : pondSel.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl.value)) { tgl.classList.add('invalid'); salah.push('tanggal'); }
    if (!pond) { (pondSel.value === POND_LAIN ? pondLain : pondSel).classList.add('invalid'); salah.push('pond'); }
    const phV = $('#in-ph').value, tssV = $('#in-tss').value;
    if (phV !== '' && (isNaN(angka(phV)) || angka(phV) < 0 || angka(phV) > 14)) { $('#in-ph').classList.add('invalid'); salah.push('pH (0–14)'); }
    if (tssV !== '' && (isNaN(angka(tssV)) || angka(tssV) < 0)) { $('#in-tss').classList.add('invalid'); salah.push('TSS'); }
    if (tgl.value > hariIni()) { tgl.classList.add('invalid'); salah.push('tanggal tidak boleh di masa depan'); }
    if (salah.length) { notif('Periksa isian: ' + salah.join(', '), 'error'); return; }

    const data = { tanggal: tgl.value, pond, ph: phV, tss: tssV, pekerjaTidakMasuk: $('#in-pekerja').value, keterangan: $('#in-keterangan').value };
    FIELD_PERALATAN.forEach(([k]) => { data[k] = $(`#in-${k}`).value; });

    const sudahAda = STATE.rows.filter(r => r.tgl === data.tanggal && r.pond === pond).length;
    if (sudahAda && !confirm(`Sudah ada ${sudahAda} laporan ${pond} pada ${fmtTglPanjang(data.tanggal)}. Tetap simpan sebagai laporan tambahan?`)) return;

    // ── Optimistic UI: langsung tampil & tersimpan di perangkat, dikirim ke server di latar ──
    const d0 = new Date();
    const item = {
      idKlien: 'k' + d0.getTime().toString(36) + Math.random().toString(36).slice(2, 7),
      waktu: `${dateKeIso(d0)}T${pad2(d0.getHours())}:${pad2(d0.getMinutes())}:${pad2(d0.getSeconds())}`,
      data
    };
    setAntrian(antrian().concat([item]));
    STATE.rows.push(barisDariAntrian(item));
    urutkanBaris();
    hitungTurunan();
    tandaiSemuaKotor();
    notif(`Tersimpan: ${pond}, ${fmtTglPanjang(data.tanggal)}. Mengirim ke spreadsheet…`);

    // Kosongkan isian harian; pond & peralatan dibiarkan untuk entri berikutnya
    ['#in-ph', '#in-tss', '#in-pekerja', '#in-keterangan'].forEach(id => { $(id).value = ''; });
    this.simpanDraft();
    this.cekLive();
    kirimAntrian(); // tidak ditunggu (fire & forget)
  }
};
