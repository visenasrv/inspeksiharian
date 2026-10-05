/* ============================================
   LAPORAN DASHBOARD — PDF A4 profesional dari tampilan dashboard (khusus admin)
   Isi: kop + logo, info periode, KPI, ringkasan, kondisi per pond, grafik pH & TSS,
        statistik per pond, sampel di luar batas, kerusakan berulang, tanda tangan.
   ============================================ */

const LaporanDashboard = {
  // Palet cetak (selaras dengan tema aplikasi)
  W: {
    brand: [31, 94, 84], brandSoft: [227, 239, 236], ink: [21, 33, 31], muted: [93, 108, 105],
    line: [214, 223, 220], zebra: [246, 249, 248], kartu: [248, 250, 249],
    bahaya: [194, 65, 12], bahayaSoft: [253, 235, 226], ok: [47, 125, 79], okSoft: [228, 243, 234],
    warn: [176, 116, 0], warnSoft: [253, 243, 220]
  },

  /** Karakter di luar font standar PDF diganti agar tidak rusak */
  aman(t) {
    return String(t ?? '')
      .replace(/≤/g, 'maks.').replace(/≥/g, 'min.').replace(/✓/g, '').replace(/×/g, 'x')
      .replace(/[^\x00-\xFF–—‘’“”•…]/g, '');
  },

  async unduh() {
    if (!STATE.siap || !Admin.wajib()) return;
    const btn = $('#btn-unduh-dash'), label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner sm"></span> <span>Menyiapkan…</span>';
    try {
      await muatLibPdf();
      const h = Dashboard.hitung();
      const nama = this.buat(h);
      notif(`Laporan dashboard diunduh: ${nama}`);
    } catch (err) {
      notif('Gagal membuat laporan: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  },

  /** Gambar grafik terang khusus PDF (tidak terpengaruh mode gelap) */
  grafik(field, h, wMm, hMm) {
    if (typeof Chart === 'undefined') return null;
    const px = Math.round(wMm * 4), py = Math.round(hMm * 4);
    const wadah = document.createElement('div');
    wadah.style.cssText = `position:fixed;left:-20000px;top:0;width:${px}px;height:${py}px;pointer-events:none`;
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = py;
    cv.style.width = px + 'px'; cv.style.height = py + 'px';
    wadah.appendChild(cv);
    document.body.appendChild(wadah);
    try {
      const cfg = Dashboard.konfigGrafik(field, h, { ink: '#4b5a57', grid: '#e4eae8', bahaya: '#c2410c', font: 'Helvetica, Arial, sans-serif', pdf: true });
      cfg.plugins = [{
        id: 'latarPutih',
        beforeDraw(c) { const x = c.ctx; x.save(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); }
      }];
      const ch = new Chart(cv, cfg);
      const url = ch.toBase64Image('image/png');
      ch.destroy();
      return url;
    } finally {
      wadah.remove();
    }
  },

  buat(h) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const C = this.W, A = t => this.aman(t);
    const PW = 210, PH = 297, ML = 15, MR = 15, MT = 14, MB = 16, CW = PW - ML - MR;
    const ATAS_LANJUT = 19;                      // awal isi pada halaman 2 dst. (di bawah header berjalan)
    const p = h.p, f = h.f;
    const lokasi = String(p.judulLokasi || '').toUpperCase();
    const judul = 'LAPORAN MONITORING INSPEKSI POND';
    let y = MT;

    const warna = (a, jenis = 'text') => (jenis === 'fill' ? doc.setFillColor(...a) : jenis === 'draw' ? doc.setDrawColor(...a) : doc.setTextColor(...a));
    const huruf = (gaya, ukuran) => { doc.setFont('helvetica', gaya); doc.setFontSize(ukuran); };
    const pastikan = tinggi => { if (y + tinggi > PH - MB - 4) { doc.addPage(); y = ATAS_LANJUT; } };

    const judulSeksi = (teks, minIsi = 28) => {
      pastikan(10 + minIsi);
      y += 3;
      warna(C.brand, 'fill');
      doc.rect(ML, y - 3.7, 1.4, 4.6, 'F');
      huruf('bold', 10.5); warna(C.ink);
      doc.text(A(teks), ML + 3.6, y);
      warna(C.line, 'draw'); doc.setLineWidth(0.25);
      doc.line(ML, y + 2.2, ML + CW, y + 2.2);
      y += 6.5;
    };

    const tabel = (head, body, opsi = {}) => {
      doc.autoTable(Object.assign({
        head: [head.map(A)],
        body: body.map(r => r.map(c => (typeof c === 'object' && c !== null ? Object.assign({}, c, { content: A(c.content) }) : A(c)))),
        startY: y,
        theme: 'grid',
        margin: { left: ML, right: MR, top: ATAS_LANJUT, bottom: MB + 4 },
        styles: { font: 'helvetica', fontSize: 7.6, textColor: C.ink, lineColor: C.line, lineWidth: 0.15, cellPadding: { top: 1.7, bottom: 1.7, left: 2, right: 2 }, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: C.brand, textColor: 255, fontStyle: 'bold', fontSize: 7.3, valign: 'middle' },
        alternateRowStyles: { fillColor: C.zebra },
        rowPageBreak: 'avoid',
        showHead: 'everyPage'
      }, opsi));
      y = doc.lastAutoTable.finalY + 2;
    };

    const catatan = teks => {
      huruf('italic', 7.4); warna(C.muted);
      const baris = doc.splitTextToSize(A(teks), CW);
      pastikan(baris.length * 3.4 + 2);
      doc.text(baris, ML, y + 2.6);
      y += baris.length * 3.4 + 2;
    };

    const kosong = teks => {
      pastikan(11);
      warna(C.okSoft, 'fill'); doc.roundedRect(ML, y, CW, 9, 1.5, 1.5, 'F');
      huruf('normal', 8.2); warna(C.ok);
      doc.text(A(teks), ML + 4, y + 5.7);
      y += 11;
    };

    // ════════ KOP ════════
    let xTeks = ML, tinggiKop = 17;
    if (STATE.logo) {
      const tinggi = 18, lebarMaks = 34;
      let lw = tinggi * STATE.logo.w / STATE.logo.h, lh = tinggi;
      if (lw > lebarMaks) { lh = lh * lebarMaks / lw; lw = lebarMaks; }
      doc.addImage(STATE.logo.dataUrl, 'PNG', ML, y + (tinggi - lh) / 2, lw, lh);
      xTeks = ML + lw + 5;
      tinggiKop = 18;
    }
    huruf('bold', 14.5); warna(C.brand);
    doc.text(judul, xTeks, y + 6);
    huruf('bold', 10.5); warna(C.ink);
    doc.text(A(lokasi), xTeks, y + 11.6);
    huruf('normal', 8); warna(C.muted);
    doc.text(A(`Ringkasan dashboard monitoring · dibuat ${fmtTglPanjang(hariIni())}`), xTeks, y + 16.4);
    y += tinggiKop + 3;
    warna(C.brand, 'draw'); doc.setLineWidth(0.9); doc.line(ML, y, ML + CW, y);
    doc.setLineWidth(0.25); doc.line(ML, y + 1.3, ML + CW, y + 1.3);
    y += 4.5;

    // ════════ PITA INFO ════════
    const info = [
      ['PERIODE', teksRentang(f.dari, f.sampai), 56],
      ['POND', f.pond || 'Semua pond', 32],
      ['BATAS MUTU', `pH ${p.phMin}–${p.phMax} · TSS maks. ${p.tssMax} mg/L`, 52],
      ['DATA TERBARU', fmtTglPanjang(STATE.dataTerbaru), CW - 56 - 32 - 52]
    ];
    warna(C.brandSoft, 'fill'); doc.roundedRect(ML, y, CW, 12, 1.8, 1.8, 'F');
    let xi = ML + 4;
    info.forEach(([lab, nilai, w], i) => {
      huruf('bold', 6.4); warna(C.muted); doc.text(lab, xi, y + 4.6);
      huruf('bold', 8.4); warna(C.ink);
      doc.text(doc.splitTextToSize(A(nilai), w - 6)[0], xi, y + 9.1);
      if (i < info.length - 1) { warna([196, 214, 209], 'draw'); doc.setLineWidth(0.2); doc.line(xi + w - 3.5, y + 2.5, xi + w - 3.5, y + 9.5); }
      xi += w;
    });
    y += 16;

    // ════════ KPI ════════
    const kpi = [
      { lab: 'Laporan masuk', nilai: h.rows.length, sub: `${h.jmlHari} hari · ${h.nPond} pond`, aksen: C.brand },
      { lab: 'Sampel pH/TSS terbaca', nilai: h.sampel.length, sub: `Rata-rata pH ${fmtPh(h.rataPh)} · TSS ${fmtTss(Math.round(h.rataTss ?? NaN))}`, aksen: C.brand },
      { lab: 'Di luar batas mutu', nilai: h.luar.length, sub: h.luar.length ? 'Perlu tindak lanjut' : 'Semua sampel dalam batas', aksen: h.luar.length ? C.bahaya : C.ok, nilaiWarna: h.luar.length ? C.bahaya : C.ink },
      { lab: 'Kerusakan masih dilaporkan', nilai: h.aktif.length, sub: `${h.berulang.length} masalah berulang di periode ini`, aksen: h.aktif.length ? C.warn : C.ok, nilaiWarna: h.aktif.length ? C.warn : C.ink }
    ];
    const gap = 4, kw = (CW - gap * 3) / 4, kh = 22;
    kpi.forEach((k, i) => {
      const x = ML + i * (kw + gap);
      warna(C.kartu, 'fill'); warna(C.line, 'draw'); doc.setLineWidth(0.2);
      doc.roundedRect(x, y, kw, kh, 1.6, 1.6, 'FD');
      warna(k.aksen, 'fill'); doc.rect(x, y + 0.2, 1.3, kh - 0.4, 'F');
      huruf('bold', 6.9); warna(C.muted); doc.text(A(k.lab), x + 4, y + 5.2, { maxWidth: kw - 6 });
      huruf('bold', 17); warna(k.nilaiWarna || C.ink); doc.text(String(k.nilai), x + 4, y + 13.4);
      huruf('normal', 6.5); warna(C.muted);
      doc.text(doc.splitTextToSize(A(k.sub), kw - 6).slice(0, 2), x + 4, y + 17.6);
    });
    y += kh + 4;

    // ════════ RINGKASAN ════════
    judulSeksi('Ringkasan', 12);
    huruf('normal', 8.6); warna(C.ink);
    h.insight.forEach(it => {
      const baris = doc.splitTextToSize(A(it.teks), CW - 6);
      pastikan(baris.length * 4.1 + 1);
      warna(C.brand, 'fill'); doc.circle(ML + 1.4, y - 1.1, 0.7, 'F');
      warna(C.ink); doc.text(baris, ML + 4.5, y);
      y += baris.length * 4.1 + 1.2;
    });
    y += 1;

    // ════════ KONDISI TERAKHIR PER POND ════════
    judulSeksi('Kondisi Terakhir per Pond');
    if (!h.kondisi.length) kosong('Tidak ada laporan pada periode ini.');
    else {
      tabel(['Pond', 'Laporan terakhir', 'Sampling terakhir', 'pH', 'TSS', 'Status', 'Kerusakan masih dilaporkan'],
        h.kondisi.map(k => [
          k.pond,
          k.last ? fmtTgl(k.last.tgl) + (k.telat >= 2 ? `\n${k.telat} hari tanpa laporan` : '') : '–',
          k.ls ? fmtTgl(k.ls.tgl) : '–',
          fmtPh(k.ls?.ph), fmtTss(k.ls?.tss),
          !k.ls ? 'Belum ada sampel' : k.batas.luar ? 'Di luar batas' : 'Dalam batas',
          k.isu.length ? k.isu.map(g => g.label).join('; ') : '–'
        ]), {
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 24 }, 1: { cellWidth: 26 }, 2: { cellWidth: 24 }, 3: { halign: 'right', cellWidth: 13 }, 4: { halign: 'right', cellWidth: 13 }, 5: { cellWidth: 24 } },
          didParseCell: d => {
            if (d.section !== 'body') return;
            const k = h.kondisi[d.row.index];
            if (d.column.index === 3 && k.batas.phLuar) Object.assign(d.cell.styles, { textColor: C.bahaya, fontStyle: 'bold' });
            if (d.column.index === 4 && k.batas.tssLuar) Object.assign(d.cell.styles, { textColor: C.bahaya, fontStyle: 'bold' });
            if (d.column.index === 5) Object.assign(d.cell.styles, { fontStyle: 'bold', textColor: !k.ls ? C.muted : k.batas.luar ? C.bahaya : C.ok });
            if (d.column.index === 1 && k.telat >= 2) d.cell.styles.textColor = C.bahaya;
          }
        });
    }

    // ════════ GRAFIK ════════
    const tinggiGrafik = 58;
    [['ph', `Tren pH Harian per Pond (batas ${p.phMin}–${p.phMax})`], ['tss', `Tren TSS Harian per Pond (batas maks. ${p.tssMax} mg/L)`]].forEach(([field, teks]) => {
      judulSeksi(teks, tinggiGrafik);
      const img = h.rows.length ? this.grafik(field, h, CW, tinggiGrafik) : null;
      if (img) {
        doc.addImage(img, 'PNG', ML, y, CW, tinggiGrafik, undefined, 'FAST');
        y += tinggiGrafik + 2;
      } else kosong('Tidak ada data untuk digambarkan.');
    });
    catatan('Garis putus-putus merah menandai batas mutu. Titik merah = sampel di luar batas. Nilai harian adalah rata-rata bila dalam satu hari ada lebih dari satu sampel.');

    // ════════ STATISTIK PER POND ════════
    judulSeksi('Statistik Sampling per Pond');
    if (!h.kondisi.length) kosong('Tidak ada laporan pada periode ini.');
    else {
      const statBaris = k => [
        k.pond, k.rp.length, k.nSampel,
        k.ph ? fmtPh(k.ph.min) : '–', k.ph ? fmtPh(k.ph.rata) : '–', k.ph ? fmtPh(k.ph.maks) : '–',
        k.tss ? fmtTss(k.tss.min) : '–', k.tss ? fmtTss(Math.round(k.tss.rata * 10) / 10) : '–', k.tss ? fmtTss(k.tss.maks) : '–',
        k.nLuar
      ].map(String);
      const daftar = h.kondisi.slice();
      if (daftar.length > 1) {
        const phs = h.sampel.map(r => r.ph).filter(v => v !== null), tsss = h.sampel.map(r => r.tss).filter(v => v !== null);
        daftar.push({
          pond: 'Semua pond', rp: h.rows, nSampel: h.sampel.length, nLuar: h.luar.length, total: true,
          ph: phs.length ? { min: Math.min(...phs), rata: rataRata(phs), maks: Math.max(...phs) } : null,
          tss: tsss.length ? { min: Math.min(...tsss), rata: rataRata(tsss), maks: Math.max(...tsss) } : null
        });
      }
      tabel(['Pond', 'Laporan', 'Sampel', 'pH min', 'pH rata-rata', 'pH maks', 'TSS min', 'TSS rata-rata', 'TSS maks', 'Di luar batas'],
        daftar.map(statBaris), {
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 26 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' } },
          headStyles: { fillColor: C.brand, textColor: 255, fontStyle: 'bold', fontSize: 7.1, halign: 'center', valign: 'middle' },
          didParseCell: d => {
            if (d.section !== 'body') return;
            const k = daftar[d.row.index];
            if (k.total) Object.assign(d.cell.styles, { fillColor: C.brandSoft, fontStyle: 'bold' });
            const merah = () => Object.assign(d.cell.styles, { textColor: C.bahaya, fontStyle: 'bold' });
            if (d.column.index === 3 && k.ph && k.ph.min < p.phMin) merah();
            if (d.column.index === 5 && k.ph && k.ph.maks > p.phMax) merah();
            if (d.column.index === 8 && k.tss && k.tss.maks > p.tssMax) merah();
            if (d.column.index === 9 && k.nLuar > 0) merah();
          }
        });
    }

    // ════════ SAMPEL DI LUAR BATAS ════════
    judulSeksi('Sampel di Luar Batas Mutu', 14);
    if (!h.luar.length) kosong(`Tidak ada sampel di luar batas mutu (pH ${p.phMin}–${p.phMax}, TSS maks. ${p.tssMax} mg/L) pada periode ini.`);
    else {
      const daftarLuar = [...h.luar].reverse();
      tabel(['No', 'Tanggal', 'Pond', 'pH', 'TSS (mg/L)', 'Isian asli formulir'],
        daftarLuar.map((r, i) => [String(i + 1), fmtTgl(r.tgl), r.pond, fmtPh(r.ph), fmtTss(r.tss), r.v[KOL.SAMPLING]]), {
          columnStyles: { 0: { halign: 'center', cellWidth: 9 }, 1: { cellWidth: 22 }, 2: { cellWidth: 28 }, 3: { halign: 'right', cellWidth: 14 }, 4: { halign: 'right', cellWidth: 20 } },
          didParseCell: d => {
            if (d.section !== 'body') return;
            const b = cekBatas(daftarLuar[d.row.index], p);
            if ((d.column.index === 3 && b.phLuar) || (d.column.index === 4 && b.tssLuar)) Object.assign(d.cell.styles, { textColor: C.bahaya, fontStyle: 'bold' });
          }
        });
    }

    // ════════ KERUSAKAN BERULANG ════════
    judulSeksi('Kerusakan Berulang', 14);
    if (!h.berulang.length) kosong('Tidak ada kerusakan yang dilaporkan berulang pada periode ini.');
    else {
      tabel(['No', 'Pond', 'Masalah', 'Laporan', 'Pertama', 'Terakhir', 'Status'],
        h.berulang.map((g, i) => [String(i + 1), g.pond, g.label, `${g.jumlah} kali`, fmtTgl(g.pertama), fmtTgl(g.terakhir), g.aktif ? 'Masih dilaporkan' : 'Tidak dilaporkan lagi']), {
          columnStyles: { 0: { halign: 'center', cellWidth: 9 }, 1: { cellWidth: 26, fontStyle: 'bold' }, 3: { halign: 'right', cellWidth: 16 }, 4: { cellWidth: 19 }, 5: { cellWidth: 19 }, 6: { cellWidth: 29 } },
          didParseCell: d => {
            if (d.section === 'body' && d.column.index === 6) Object.assign(d.cell.styles, { fontStyle: 'bold', textColor: h.berulang[d.row.index].aktif ? C.bahaya : C.ok });
          }
        });
      catatan(`Diambil dari kolom keterangan kerusakan; dihitung berulang bila muncul minimal 2 kali dalam periode. "Masih dilaporkan" = muncul lagi dalam ${APP_CONFIG.HARI_KERUSAKAN_AKTIF} hari terakhir data (s/d ${fmtTglPanjang(STATE.dataTerbaru)}).`);
    }

    // ════════ TANDA TANGAN SUPERVISOR ════════
    // Blok ±27 mm; boleh turun sampai tepat di atas garis kaki halaman agar tidak sendirian di halaman baru
    if (y + 6 + 21 + 2 > PH - MB) { doc.addPage(); y = ATAS_LANJUT + 4; }
    y += 6;
    const xTtd = ML + CW - 36;
    huruf('normal', 9.5); warna(C.ink);
    doc.text(A(p.jabatanTtd), xTtd, y, { align: 'center' });
    huruf('bold', 9.5);
    const yNama = y + 21;
    doc.text(A(p.namaTtd), xTtd, yNama, { align: 'center' });
    const lebarNama = doc.getTextWidth(A(p.namaTtd));
    warna(C.ink, 'draw'); doc.setLineWidth(0.3);
    doc.line(xTtd - lebarNama / 2, yNama + 1, xTtd + lebarNama / 2, yNama + 1);

    // ════════ HEADER BERJALAN & KAKI HALAMAN ════════
    const n = doc.getNumberOfPages();
    const dicetak = new Date().toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      if (i > 1) {
        huruf('bold', 7.4); warna(C.brand);
        doc.text(judul, ML, 10.5);
        huruf('normal', 7.4); warna(C.muted);
        doc.text(A(`${lokasi} · ${teksRentang(f.dari, f.sampai)}${f.pond ? ' · ' + f.pond : ''}`), PW - MR, 10.5, { align: 'right' });
        warna(C.line, 'draw'); doc.setLineWidth(0.25); doc.line(ML, 12.6, PW - MR, 12.6);
      }
      warna(C.line, 'draw'); doc.setLineWidth(0.25); doc.line(ML, PH - 12, PW - MR, PH - 12);
      huruf('normal', 7); warna(C.muted);
      doc.text(A(`Aplikasi Inspeksi Harian · dicetak ${dicetak}`), ML, PH - 8);
      doc.text(`Halaman ${i} dari ${n}`, PW - MR, PH - 8, { align: 'right' });
    }

    const pondNama = f.pond ? '_' + f.pond.replace(/[^\w]+/g, '-') : '';
    const nama = `Laporan-Monitoring-Pond_${f.dari === f.sampai ? f.dari : f.dari + '_sd_' + f.sampai}${pondNama}.pdf`;
    doc.save(nama);
    return nama;
  }
};
