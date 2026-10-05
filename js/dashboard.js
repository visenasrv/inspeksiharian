/* ============================================
   DASHBOARD — KPI, kondisi per pond, grafik pH/TSS, batas mutu, kerusakan berulang
   ============================================ */

const WARNA_POND = ['#2a9d8f', '#e76f51', '#4c6ef5', '#d4a017', '#9b5de5', '#6c757d', '#e64980', '#20c997'];
const warnaPond = nama => WARNA_POND[Math.max(0, STATE.ponds.indexOf(nama)) % WARNA_POND.length];
const fmtPh = v => (v === null || v === undefined || isNaN(v) ? '–' : Number(v).toFixed(2));
const fmtTss = v => (v === null || v === undefined || isNaN(v) ? '–' : (Number.isInteger(v) ? String(v) : Number(v).toFixed(1)));
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const Dashboard = {
  filter: { dari: null, sampai: null, pond: '', range: '30' },
  charts: {},

  init() {
    $('#dash-dari').addEventListener('change', e => { this.filter.dari = e.target.value; this.filter.range = null; this.render(); });
    $('#dash-sampai').addEventListener('change', e => { this.filter.sampai = e.target.value; this.filter.range = null; this.render(); });
    $('#dash-pond').addEventListener('change', e => { this.filter.pond = e.target.value; this.render(); });
    $('#dash-bulan').addEventListener('change', e => {
      if (e.target.value) this.setRange('m:' + e.target.value);
      else { this.filter.range = null; this.render(); }
    });
    $$('#sec-dashboard .chip').forEach(c => c.addEventListener('click', () => this.setRange(c.dataset.range)));
    $('#btn-unduh-dash').addEventListener('click', () => LaporanDashboard.unduh());
  },

  /** Dipanggil setiap kali data selesai dimuat */
  siapkan() {
    const sel = $('#dash-pond');
    sel.innerHTML = '<option value="">Semua pond</option>' + STATE.ponds.map(p => `<option>${esc(p)}</option>`).join('');
    if (STATE.ponds.includes(this.filter.pond)) sel.value = this.filter.pond; else this.filter.pond = '';

    // Pilihan bulan: semua bulan yang ada datanya, terbaru di atas
    const bulan = [...new Set(STATE.rows.map(r => r.tgl.slice(0, 7)))].sort().reverse();
    $('#dash-bulan').innerHTML = '<option value="">— rentang bebas —</option>' +
      bulan.map(b => `<option value="${b}">${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}</option>`).join('');
    if (String(this.filter.range).startsWith('m:') && !bulan.includes(this.filter.range.slice(2))) this.filter.range = '30';

    if (this.filter.range || !this.filter.dari) this.setRange(this.filter.range || '30', false);
    this.render();
  },

  setRange(k, render = true) {
    const akhir = STATE.dataTerbaru;
    if (String(k).startsWith('m:')) {            // filter bulan: 1 s/d akhir bulan (maks. data terbaru)
      const [y, m] = k.slice(2).split('-').map(Number);
      const ujung = akhirBulan(y, m);
      Object.assign(this.filter, { dari: `${y}-${pad2(m)}-01`, sampai: ujung > akhir && `${y}-${pad2(m)}` === akhir.slice(0, 7) ? akhir : ujung, range: k });
      if (render) this.render();
      return;
    }
    let dari = STATE.dataTerlama;
    if (k === '7') dari = tambahHari(akhir, -6);
    else if (k === '30') dari = tambahHari(akhir, -29);
    else if (k === 'bulan') dari = akhir.slice(0, 8) + '01';
    if (dari < STATE.dataTerlama) dari = STATE.dataTerlama;
    Object.assign(this.filter, { dari, sampai: akhir, range: k });
    if (render) this.render();
  },

  /** 'YYYY-MM' bila rentang tepat satu bulan penuh (atau bulan berjalan s/d data terbaru) */
  bulanCocok(dari, sampai) {
    if (!dari || dari.slice(8) !== '01' || dari.slice(0, 7) !== sampai.slice(0, 7)) return '';
    const [y, m] = dari.split('-').map(Number);
    const ok = sampai === akhirBulan(y, m) || sampai === STATE.dataTerbaru;
    return ok && [...$('#dash-bulan').options].some(o => o.value === dari.slice(0, 7)) ? dari.slice(0, 7) : '';
  },

  data() {
    const { dari, sampai, pond } = this.filter;
    return STATE.rows.filter(r => r.tgl >= dari && r.tgl <= sampai && (!pond || r.pond === pond));
  },

  /** Semua angka dashboard untuk filter aktif — dipakai layar & PDF */
  hitung() {
    const f = this.filter, p = STATE.pengaturan;
    const rows = this.data();
    const sampel = rows.filter(r => r.ph !== null || r.tss !== null);
    const luar = sampel.filter(r => cekBatas(r, p).luar);
    const rekap = rekapKerusakan(rows, STATE.dataTerbaru, APP_CONFIG.HARI_KERUSAKAN_AKTIF);
    const berulang = rekap.filter(g => g.jumlah >= 2);
    const aktif = berulang.filter(g => g.aktif);
    const pondDalam = f.pond ? [f.pond] : STATE.ponds.filter(pd => rows.some(r => r.pond === pd)); // pond tanpa laporan disembunyikan
    const jmlHari = selisihHari(f.dari, f.sampai) + 1;

    // Kondisi terakhir & statistik per pond
    const kondisi = pondDalam.map(pd => {
      const rp = rows.filter(r => r.pond === pd);
      const last = rp[rp.length - 1] || null;
      const ls = [...rp].reverse().find(r => r.ph !== null || r.tss !== null) || null;
      const sp = rp.filter(r => r.ph !== null || r.tss !== null);
      const phs = sp.map(r => r.ph).filter(v => v !== null), tsss = sp.map(r => r.tss).filter(v => v !== null);
      return {
        pond: pd, rp, last, ls,
        telat: last ? selisihHari(last.tgl, STATE.dataTerbaru) : null,
        batas: ls ? cekBatas(ls, p) : { phLuar: false, tssLuar: false, luar: false },
        isu: rekap.filter(g => g.pond === pd && g.aktif && g.jumlah >= 2),
        nSampel: sp.length,
        nLuar: sp.filter(r => cekBatas(r, p).luar).length,
        ph: phs.length ? { min: Math.min(...phs), rata: rataRata(phs), maks: Math.max(...phs) } : null,
        tss: tsss.length ? { min: Math.min(...tsss), rata: rataRata(tsss), maks: Math.max(...tsss) } : null
      };
    });

    return {
      f, p, rows, sampel, luar, rekap, berulang, aktif, pondDalam, jmlHari, kondisi,
      rataPh: rataRata(sampel.map(r => r.ph)),
      rataTss: rataRata(sampel.map(r => r.tss)),
      nPond: new Set(rows.map(r => r.pond)).size,
      cek: rows.filter(r => r.sStatus === 'cek'),
      insight: this.insight(rows, sampel, luar, aktif, pondDalam)
    };
  },

  render() {
    if (!STATE.siap) return;
    const f = this.filter;
    if (f.dari > f.sampai) [f.dari, f.sampai] = [f.sampai, f.dari];
    $('#dash-dari').value = f.dari;
    $('#dash-sampai').value = f.sampai;
    $$('#sec-dashboard .chip').forEach(c => c.classList.toggle('active', c.dataset.range === f.range));
    $('#dash-bulan').value = this.bulanCocok(f.dari, f.sampai);

    const h = this.hitung(), p = h.p;
    $('#dash-periode').textContent = `${teksRentang(f.dari, f.sampai)} · ${f.pond || 'semua pond'} · data terbaru ${fmtTglPanjang(STATE.dataTerbaru)}`;
    $('#batas-ph-label').textContent = `batas ${p.phMin}–${p.phMax}`;
    $('#batas-tss-label').textContent = `batas ≤ ${p.tssMax}`;

    // ── KPI ──
    const kpi = (ikon, label, nilai, sub, kelas = '') =>
      `<div class="kpi ${kelas}"><div class="label"><i class="bi ${ikon}"></i>${label}</div><div class="value">${nilai}</div><div class="sub">${sub}</div></div>`;
    $('#kpi-grid').innerHTML = [
      kpi('bi-clipboard-check', 'Laporan masuk', h.rows.length, `${h.jmlHari} hari · ${h.nPond} pond`),
      kpi('bi-droplet', 'Sampel pH/TSS terbaca', h.sampel.length, `rata-rata pH ${fmtPh(h.rataPh)} · TSS ${fmtTss(Math.round(h.rataTss ?? NaN))}`),
      kpi('bi-exclamation-octagon', 'Di luar batas', h.luar.length, `pH ${p.phMin}–${p.phMax} · TSS ≤ ${p.tssMax} mg/L`, h.luar.length ? 'bad' : ''),
      kpi('bi-wrench-adjustable', 'Kerusakan masih dilaporkan', h.aktif.length, `${h.berulang.length} masalah berulang di periode ini`, h.aktif.length ? 'warn' : '')
    ].join('');

    $('#insight-list').innerHTML = h.insight.map(x => `<li>${x.html}</li>`).join('');
    this.renderPond(h);
    this.renderCharts(h);
    this.renderTabel(h.luar, h.berulang, h.rows);
  },

  /** Ringkasan otomatis → [{ html, teks }] (teks polos untuk PDF) */
  insight(rows, sampel, luar, aktif, pondDalam) {
    const p = STATE.pengaturan;
    const li = [];
    if (!rows.length) return [{ html: 'Tidak ada laporan pada periode ini.', teks: 'Tidak ada laporan pada periode ini.' }];
    if (luar.length) {
      const per = {};
      luar.forEach(r => { per[r.pond] = (per[r.pond] || 0) + 1; });
      const [pondTop, n] = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
      const total = sampel.filter(r => r.pond === pondTop).length;
      const akhir = luar.filter(r => r.pond === pondTop).slice(-1)[0];
      li.push(`<b>${esc(pondTop)}</b> paling sering di luar batas: ${n} dari ${total} sampel, terakhir ${fmtTglPanjang(akhir.tgl)} (pH ${fmtPh(akhir.ph)}, TSS ${fmtTss(akhir.tss)}).`);
    } else if (sampel.length) {
      li.push(`Semua <b>${sampel.length}</b> sampel berada dalam batas (pH ${p.phMin}–${p.phMax}, TSS ≤ ${p.tssMax} mg/L).`);
    }
    const tssMax = sampel.filter(r => r.tss !== null).sort((a, b) => b.tss - a.tss)[0];
    if (tssMax) li.push(`TSS tertinggi <b>${fmtTss(tssMax.tss)} mg/L</b> di ${esc(tssMax.pond)} pada ${fmtTglPanjang(tssMax.tgl)}${tssMax.tss > p.tssMax ? ' — melewati batas' : ''}.`);
    const phs = sampel.filter(r => r.ph !== null);
    if (phs.length) {
      const mn = phs.reduce((a, b) => (b.ph < a.ph ? b : a)), mx = phs.reduce((a, b) => (b.ph > a.ph ? b : a));
      li.push(`Rentang pH ${fmtPh(mn.ph)} (${esc(mn.pond)}, ${fmtTglSingkat(mn.tgl)}) sampai ${fmtPh(mx.ph)} (${esc(mx.pond)}, ${fmtTglSingkat(mx.tgl)}).`);
    }
    const lama = [...aktif].sort((a, b) => (a.pertama < b.pertama ? -1 : 1))[0];
    if (lama) li.push(`Kerusakan terlama yang masih dilaporkan: <b>${esc(lama.label)}</b> di ${esc(lama.pond)} — ${lama.jumlah} laporan sejak ${fmtTglPanjang(lama.pertama)}.`);
    const telat = pondDalam.filter(pd => {
      const last = STATE.rows.filter(r => r.pond === pd).slice(-1)[0];
      return last && selisihHari(last.tgl, STATE.dataTerbaru) >= 2;
    });
    if (telat.length) li.push(`Belum ada laporan terbaru (≥ 2 hari) dari: <b>${telat.map(esc).join(', ')}</b>.`);
    const cek = rows.filter(r => r.sStatus === 'cek').length;
    const hasil = li.map(html => ({ html, teks: teksPolos(html) }));
    if (cek) hasil.push({
      html: `${cek} isian sampling tidak terbaca otomatis — lihat bagian paling bawah.`,
      teks: `${cek} isian sampling tidak dapat dibaca otomatis sehingga tidak ikut dihitung.`
    });
    return hasil;
  },

  renderPond(h) {
    $('#pond-grid').innerHTML = h.kondisi.map(k => {
      const head = `<h3><span style="display:flex;gap:8px;align-items:center"><span class="dot" style="background:${warnaPond(k.pond)}"></span>${esc(k.pond)}</span>`;
      if (!k.last) return `<div class="pond-card">${head}</h3><div class="meta">Tidak ada laporan pada periode ini.</div></div>`;
      const { last, ls, telat, batas: b, isu } = k;
      const status = ls ? (b.luar ? '<span class="badge bad">Di luar batas</span>' : '<span class="badge ok">Dalam batas</span>') : '<span class="badge">Belum ada sampel</span>';
      return `<div class="pond-card">${head}${status}</h3>
        <div class="meta ${telat >= 2 ? 'telat' : ''}">Laporan terakhir ${fmtTglPanjang(last.tgl)}${telat >= 2 ? ` · ${telat} hari tanpa laporan` : ''}${ls && ls.tgl !== last.tgl ? `<br>Sampling terakhir ${fmtTglPanjang(ls.tgl)}` : ''}</div>
        <div class="readings">
          <div class="reading ${b.phLuar ? 'luar' : ''}"><small>pH</small><span>${fmtPh(ls?.ph)}</span></div>
          <div class="reading ${b.tssLuar ? 'luar' : ''}"><small>TSS</small><span>${fmtTss(ls?.tss)}</span></div>
        </div>
        <div class="issues">${isu.length
          ? `<span class="badge warn"><i class="bi bi-tools"></i> ${isu.length} kerusakan berulang</span> <span class="muted">${isu.slice(0, 2).map(g => esc(g.label)).join('; ')}${isu.length > 2 ? '…' : ''}</span>`
          : '<span class="muted">Tidak ada kerusakan berulang yang aktif.</span>'}</div>
      </div>`;
    }).join('');
  },

  /**
   * Konfigurasi Chart.js bersama untuk layar & PDF.
   * tema: { ink, grid, bahaya, font, pdf }
   */
  konfigGrafik(field, h, tema) {
    const p = h.p;
    const labels = daftarTanggal(h.f.dari, h.f.sampai);
    const { ink, grid, bahaya, pdf } = tema;
    const luarFn = field === 'ph' ? v => v < p.phMin || v > p.phMax : v => v > p.tssMax;
    const harian = pd => labels.map(d => rataRata(h.rows.filter(r => r.pond === pd && r.tgl === d).map(r => r[field])));
    const garis = (label, nilai) => ({
      label, data: labels.map(() => nilai), borderColor: bahaya, borderWidth: pdf ? 1.2 : 1.5, borderDash: [6, 4],
      pointRadius: 0, pointHoverRadius: 0, fill: false, order: 0
    });
    const seri = h.pondDalam.map(pd => {
      const w = warnaPond(pd);
      return {
        label: pd, data: harian(pd), borderColor: w, backgroundColor: w,
        borderWidth: pdf ? 1.6 : 2, tension: .25, spanGaps: true,
        pointRadius: c => (c.raw !== null && luarFn(c.raw) ? (pdf ? 3.2 : 4.5) : (pdf ? 1.4 : 2.2)),
        pointBackgroundColor: c => (c.raw !== null && luarFn(c.raw) ? bahaya : w),
        pointBorderColor: c => (c.raw !== null && luarFn(c.raw) ? bahaya : w)
      };
    });
    const batas = field === 'ph'
      ? [garis(`Batas min ${p.phMin}`, p.phMin), garis(`Batas maks ${p.phMax}`, p.phMax)]
      : [garis(`Batas ${p.tssMax} mg/L`, p.tssMax)];
    const sumbuY = field === 'ph'
      ? { suggestedMin: Math.min(5, p.phMin - .5), suggestedMax: Math.max(10, p.phMax + .5) }
      : { beginAtZero: true, suggestedMax: p.tssMax * 1.15 };
    if (pdf && field === 'tss') sumbuY.title = { display: true, text: 'mg/L', color: ink, font: { size: 9 } };
    const ukuranHuruf = pdf ? 9 : 12;

    return {
      type: 'line',
      data: { labels, datasets: seri.concat(batas) },
      options: {
        responsive: !pdf, maintainAspectRatio: false, animation: false,
        devicePixelRatio: pdf ? 3 : undefined,
        interaction: { mode: 'nearest', intersect: false },
        font: { family: tema.font, size: ukuranHuruf },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: pdf ? 7 : 10, boxHeight: pdf ? 7 : 10, usePointStyle: true, color: ink, padding: pdf ? 8 : 10, font: { family: tema.font, size: ukuranHuruf } } },
          tooltip: pdf ? { enabled: false } : {
            callbacks: {
              title: it => fmtTglPanjang(labels[it[0].dataIndex], true),
              label: c => (c.raw === null ? null : `${c.dataset.label}: ${c.dataset.label.startsWith('Batas') ? c.raw : (field === 'ph' ? fmtPh(c.raw) : fmtTss(Math.round(c.raw * 10) / 10))}`)
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: ink, maxTicksLimit: pdf ? 10 : 8, maxRotation: 0, font: { family: tema.font, size: ukuranHuruf }, callback: (v, i) => fmtTglSingkat(labels[i]) } },
          y: Object.assign({ grid: { color: grid }, border: { display: false }, ticks: { color: ink, font: { family: tema.font, size: ukuranHuruf } } }, sumbuY)
        }
      }
    };
  },

  renderCharts(h) {
    if (typeof Chart === 'undefined') return;
    const tema = { ink: cssVar('--muted'), grid: cssVar('--line'), bahaya: cssVar('--danger'), font: cssVar('--font'), pdf: false };
    Chart.defaults.font.family = tema.font;
    Chart.defaults.color = tema.ink;
    this.charts.ph?.destroy();
    this.charts.tss?.destroy();
    this.charts.ph = new Chart($('#chart-ph'), this.konfigGrafik('ph', h, tema));
    this.charts.tss = new Chart($('#chart-tss'), this.konfigGrafik('tss', h, tema));
  },

  resizeCharts() { Object.values(this.charts).forEach(c => c?.resize()); },

  renderTabel(luar, berulang, rows) {
    const p = STATE.pengaturan;
    const kosong = (n, teks) => `<tr><td class="empty" colspan="${n}">${teks}</td></tr>`;

    $('#tbl-luar').innerHTML = `<thead><tr><th>Tanggal</th><th>Pond</th><th>pH</th><th>TSS</th><th>Isian asli</th></tr></thead><tbody>${
      luar.length ? [...luar].reverse().map(r => {
        const b = cekBatas(r, p);
        return `<tr><td data-label="Tanggal">${fmtTgl(r.tgl)}</td><td data-label="Pond">${esc(r.pond)}</td><td data-label="pH" class="num ${b.phLuar ? 'luar' : ''}">${fmtPh(r.ph)}</td><td data-label="TSS" class="num ${b.tssLuar ? 'luar' : ''}">${fmtTss(r.tss)}</td><td data-label="Isian asli" class="muted small">${esc(r.v[KOL.SAMPLING])}</td></tr>`;
      }).join('') : kosong(5, 'Tidak ada sampel di luar batas pada periode ini. ✓')
    }</tbody>`;

    $('#tbl-rusak').innerHTML = `<thead><tr><th>Pond</th><th>Masalah</th><th>Laporan</th><th>Status</th></tr></thead><tbody>${
      berulang.length ? berulang.map(g => `<tr>
        <td data-label="Pond">${esc(g.pond)}</td><td data-label="Masalah">${esc(g.label)}</td><td data-label="Laporan" class="num">${g.jumlah}×</td>
        <td data-label="Status"><div>${g.aktif ? `<span class="badge bad">Masih dilaporkan</span><div class="muted small">sejak ${fmtTgl(g.pertama)}</div>` : `<span class="badge ok">Terakhir ${fmtTgl(g.terakhir)}</span>`}</div></td>
      </tr>`).join('') : kosong(4, 'Tidak ada kerusakan yang dilaporkan berulang.')
    }</tbody>`;
    $('#rusak-note').textContent = `Dari kolom keterangan kerusakan; dihitung berulang bila muncul ≥ 2 kali di periode ini. "Masih dilaporkan" = muncul lagi dalam ${APP_CONFIG.HARI_KERUSAKAN_AKTIF} hari terakhir data (s/d ${fmtTglPanjang(STATE.dataTerbaru)}).`;

    const cek = rows.filter(r => r.sStatus === 'cek');
    $('#cek-count').textContent = cek.length;
    $('#tbl-cek').innerHTML = `<thead><tr><th>Tanggal</th><th>Pond</th><th>Baris sheet</th><th>Isian</th></tr></thead><tbody>${
      cek.length ? cek.map(r => `<tr><td data-label="Tanggal">${fmtTgl(r.tgl)}</td><td data-label="Pond">${esc(r.pond)}</td><td data-label="Baris sheet" class="num">${esc(r.r)}</td><td data-label="Isian">${esc(r.v[KOL.SAMPLING])}</td></tr>`).join('') : kosong(4, 'Semua isian terbaca.')
    }</tbody>`;
  }
};
