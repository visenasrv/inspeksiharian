/* ============================================
   LAPORAN — filter periode, pratinjau A4, PDF (jsPDF + autoTable), cetak
   ============================================ */

// Lebar relatif 20 kolom: No + 19 kolom sheet (berbeda untuk kertas mendatar / tegak)
const BOBOT_KOLOM = {
  landscape: [2.2, 6.6, 4.8, 5.4, 6.2, 3.6, 5.8, 4.4, 4.4, 4.2, 4.8, 3.6, 3.8, 4, 5.4, 3.6, 3.4, 7.4, 6.2, 10.2],
  portrait:  [2.2, 6.2, 5.8, 5.6, 6, 4, 5.6, 4.4, 4.2, 4.2, 4.6, 3.8, 3.8, 3.8, 5.2, 3.6, 3.4, 7, 5.6, 9]
};
const bobot = o => BOBOT_KOLOM[o === 'portrait' ? 'portrait' : 'landscape'];

// jsPDF + AutoTable dimuat malas (lazy) supaya pembukaan aplikasi lebih ringan
const LIB_PDF = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
];
let janjiLibPdf = null;
function muatSkrip(src) {
  return new Promise((ok, gagal) => {
    const el = document.createElement('script');
    el.src = src; el.async = false;
    el.onload = ok;
    el.onerror = () => { el.remove(); gagal(new Error('Library PDF gagal dimuat. Periksa koneksi internet.')); };
    document.head.appendChild(el);
  });
}
function muatLibPdf() {
  if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return Promise.resolve();
  if (!janjiLibPdf) janjiLibPdf = LIB_PDF.reduce((p, src) => p.then(() => muatSkrip(src)), Promise.resolve()).catch(e => { janjiLibPdf = null; throw e; });
  return janjiLibPdf;
}

const Laporan = {
  st: { jenis: 'bulanan', tgl: null, bulan: null, tahun: null, dari: null, sampai: null, pond: '', cari: '', orientasi: null, margin: null },
  diubahPengguna: { orientasi: false, margin: false },

  init() {
    $$('#sec-laporan .seg-btn').forEach(b => b.addEventListener('click', () => { this.st.jenis = b.dataset.jenis; this.render(); }));
    const ikat = (id, key, ev = 'change', after, jeda = 0) => {
      const ulang = jeda ? debounce(() => this.render(), jeda) : () => this.render();
      $(id).addEventListener(ev, e => { this.st[key] = e.target.value; after && after(); ulang(); });
    };
    ikat('#lap-tgl', 'tgl');
    ikat('#lap-bulan', 'bulan');
    ikat('#lap-tahun', 'tahun');
    ikat('#lap-dari', 'dari');
    ikat('#lap-sampai', 'sampai');
    ikat('#lap-pond', 'pond');
    ikat('#lap-cari', 'cari', 'input', null, 250);        // debounce: tidak menggambar ulang tiap ketukan
    ikat('#lap-orientasi', 'orientasi', 'change', () => { this.diubahPengguna.orientasi = true; });
    ikat('#lap-margin', 'margin', 'input', () => { this.diubahPengguna.margin = true; }, 300);
    $('#btn-pdf').addEventListener('click', () => this.unduhPdf());
    $('#btn-cetak').addEventListener('click', () => this.cetak());
    // Library PDF tidak menghambat pembukaan awal: dimuat saat browser senggang
    setTimeout(() => (window.requestIdleCallback || (f => f()))(() => muatLibPdf().catch(() => { /* dicoba lagi saat tombol diklik */ })), 1500);
  },

  siapkan() {
    const s = this.st, akhir = STATE.dataTerbaru;
    $('#lap-pond').innerHTML = '<option value="">Semua pond</option>' + STATE.ponds.map(p => `<option>${esc(p)}</option>`).join('');
    if (!STATE.ponds.includes(s.pond)) s.pond = '';
    $('#lap-bulan').innerHTML = BULAN.map((b, i) => `<option value="${i + 1}">${b}</option>`).join('');
    const thA = Number(STATE.dataTerlama.slice(0, 4)), thB = Math.max(Number(akhir.slice(0, 4)), new Date().getFullYear());
    let opsiTahun = '';
    for (let t = thB; t >= thA; t--) opsiTahun += `<option>${t}</option>`;
    $('#lap-tahun').innerHTML = opsiTahun;

    if (!s.tgl) s.tgl = akhir;
    if (!s.bulan) { s.bulan = String(Number(akhir.slice(5, 7))); s.tahun = akhir.slice(0, 4); }
    if (!s.dari) { s.dari = akhir.slice(0, 8) + '01'; s.sampai = akhir; }
    if (!this.diubahPengguna.orientasi) s.orientasi = STATE.pengaturan.orientasiPdf;
    if (!this.diubahPengguna.margin) s.margin = STATE.pengaturan.marginPdf;
    this.render();
  },

  /** Rentang tanggal sesuai jenis laporan */
  periode() {
    const s = this.st;
    if (s.jenis === 'harian') return { dari: s.tgl, sampai: s.tgl, ket: `Laporan harian · ${fmtTglPanjang(s.tgl, true)}` };
    if (s.jenis === 'mingguan') {
      const dari = awalMinggu(s.tgl), sampai = tambahHari(dari, 6);
      return { dari, sampai, ket: `Laporan mingguan · ${teksRentang(dari, sampai, true)}` };
    }
    if (s.jenis === 'bulanan') {
      const y = Number(s.tahun), m = Number(s.bulan);
      const dari = `${y}-${pad2(m)}-01`, sampai = akhirBulan(y, m);
      return { dari, sampai, ket: `Laporan bulanan · ${teksRentang(dari, sampai)}` };
    }
    let dari = s.dari, sampai = s.sampai;
    if (dari > sampai) [dari, sampai] = [sampai, dari];
    return { dari, sampai, ket: `Periode · ${teksRentang(dari, sampai)}` };
  },

  rows(per = this.periode()) {
    const q = this.st.cari.trim().toLowerCase();
    return STATE.rows.filter(r =>
      r.tgl >= per.dari && r.tgl <= per.sampai &&
      (!this.st.pond || r.pond === this.st.pond) &&
      (!q || r.v.join(' ').toLowerCase().includes(q) || r.pond.toLowerCase().includes(q))
    );
  },

  /** Nilai sel untuk laporan: nama pond diseragamkan, sisanya apa adanya */
  sel(r) { const v = r.v.slice(); v[KOL.POND] = r.pond; return v; },

  judul(per) {
    return [`LAPORAN INSPEKSI HARIAN ${judulBulanTahun(per.dari, per.sampai)}`, String(STATE.pengaturan.judulLokasi || '').toUpperCase()];
  },

  /** Subjudul: hanya keterangan periode (tanpa pond & jumlah entri) */
  subjudul(per) {
    const q = this.st.cari.trim();
    return `${per.ket}${q ? `  ·  Kata kunci: "${q}"` : ''}`;
  },

  /** Tanda tangan: jabatan + nama saja (tanpa tanggal & "Mengetahui") */
  teksTtd() {
    const p = STATE.pengaturan;
    return { jabatan: p.jabatanTtd, nama: p.namaTtd };
  },

  margin() { const m = Number(String(this.st.margin).replace(',', '.')); return Math.min(15, Math.max(3, isNaN(m) ? 6 : m)); },

  render() {
    if (!STATE.siap) return;
    const s = this.st;
    $$('#sec-laporan .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.jenis === s.jenis));
    $$('#sec-laporan [data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(s.jenis); });
    $('#lap-tgl-label').textContent = s.jenis === 'mingguan' ? 'Tanggal dalam minggu itu' : 'Tanggal';
    $('#lap-tgl').value = s.tgl; $('#lap-bulan').value = s.bulan; $('#lap-tahun').value = s.tahun;
    $('#lap-dari').value = s.dari; $('#lap-sampai').value = s.sampai; $('#lap-pond').value = s.pond;
    $('#lap-orientasi').value = s.orientasi; $('#lap-margin').value = s.margin;

    const per = this.periode(), rows = this.rows(per), [j1, j2] = this.judul(per), ttd = this.teksTtd();
    $('#lap-info').innerHTML = rows.length
      ? `<b>${rows.length}</b> entri · ${esc(teksRentang(per.dari, per.sampai, s.jenis !== 'bulanan'))}. Pratinjau di bawah sama dengan isi PDF.${rows.some(r => r.pending) ? ` <span class="badge warn">${rows.filter(r => r.pending).length} entri belum terkirim ke spreadsheet</span>` : ''}`
      : `Tidak ada data pada ${esc(teksRentang(per.dari, per.sampai))}${s.pond ? ' untuk ' + esc(s.pond) : ''}.`;

    const paper = $('#print-area');
    paper.classList.toggle('portrait', s.orientasi === 'portrait');
    paper.style.padding = `${this.margin()}mm`;
    const bb = bobot(s.orientasi), total = bb.reduce((a, b) => a + b, 0);
    const cols = bb.map(b => `<col style="width:${(b / total * 100).toFixed(3)}%">`).join('');
    const head = ['No'].concat(STATE.headers).map(h => `<th>${esc(h)}</th>`).join('');
    const body = rows.map((r, i) => `<tr><td class="c">${i + 1}</td>${this.sel(r).map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('');

    paper.innerHTML = `<div class="rpt">
      <div class="rpt-title">${esc(j1)}</div>
      <div class="rpt-title">${esc(j2)}</div>
      <div class="rpt-sub">${esc(this.subjudul(per))}</div>
      <table class="rpt-tbl"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead>
        <tbody>${body || `<tr><td colspan="20" class="c" style="padding:8pt">Tidak ada data inspeksi pada periode ini.</td></tr>`}</tbody></table>
      <div class="rpt-ttd"><div class="blok">${esc(ttd.jabatan)}<div class="ruang"></div><span class="nama">${esc(ttd.nama)}</span></div></div>
    </div>`;
  },

  namaFile(per) {
    const s = this.st;
    const pond = s.pond ? '_' + s.pond.replace(/[^\w]+/g, '-') : '';
    const inti = s.jenis === 'bulanan' ? `${per.dari.slice(0, 7)}` : (per.dari === per.sampai ? per.dari : `${per.dari}_sd_${per.sampai}`);
    return `Laporan-Inspeksi-Harian_${inti}${pond}.pdf`;
  },

  async unduhPdf() {
    if (!STATE.siap) return;
    const btn = $('#btn-pdf'), label = btn.innerHTML;
    btn.disabled = true;
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        btn.innerHTML = '<span class="spinner sm"></span> Menyiapkan…';
        await muatLibPdf();
      }
      const { jsPDF } = window.jspdf;
      const o = this.st.orientasi === 'portrait' ? 'portrait' : 'landscape';
      const m = this.margin();
      const doc = new jsPDF({ orientation: o, unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
      const lebar = W - 2 * m;
      const per = this.periode(), rows = this.rows(per), [j1, j2] = this.judul(per), ttd = this.teksTtd();
      const besar = o === 'landscape';

      // ── Judul (halaman 1) ──
      let y = m + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(besar ? 11 : 10);
      doc.text(j1, W / 2, y, { align: 'center' });
      y += besar ? 5 : 4.5;
      doc.text(j2, W / 2, y, { align: 'center' });
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60);
      doc.text(this.subjudul(per), W / 2, y, { align: 'center', maxWidth: lebar });
      doc.setTextColor(0);
      y += 2.5;

      // ── Tabel ──
      const fs = besar ? 6.4 : 5.2;
      const bb = bobot(o), total = bb.reduce((a, b) => a + b, 0);
      const columnStyles = {};
      bb.forEach((b, i) => { columnStyles[i] = { cellWidth: (lebar * b) / total }; });
      columnStyles[0].halign = 'center';
      const body = rows.length
        ? rows.map((r, i) => [String(i + 1)].concat(this.sel(r)))
        : [[{ content: 'Tidak ada data inspeksi pada periode ini.', colSpan: 20, styles: { halign: 'center', fontSize: 8, cellPadding: 3 } }]];

      doc.autoTable({
        head: [['No'].concat(STATE.headers)],
        body,
        startY: y,
        margin: { top: m, right: m, bottom: m + 4, left: m },
        tableWidth: lebar,
        theme: 'grid',
        showHead: 'everyPage',
        rowPageBreak: 'avoid',
        styles: { font: 'helvetica', fontSize: fs, cellPadding: 0.7, lineColor: [70, 70, 70], lineWidth: 0.1, textColor: 0, overflow: 'linebreak', valign: 'top' },
        headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: fs - 0.2 },
        columnStyles
      });

      // ── Tanda tangan: jabatan + nama (pindah halaman bila tidak cukup ruang) ──
      let ty = doc.lastAutoTable.finalY + 7;
      if (ty + 24 > H - m - 4) { doc.addPage(); ty = m + 6; }
      const xc = W - m - 38;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(ttd.jabatan, xc, ty, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      const ny = ty + 19;
      doc.text(ttd.nama, xc, ny, { align: 'center' });
      const nw = doc.getTextWidth(ttd.nama);
      doc.setLineWidth(0.25);
      doc.line(xc - nw / 2, ny + 0.9, xc + nw / 2, ny + 0.9);

      // ── Kaki halaman ──
      const n = doc.getNumberOfPages();
      const dicetak = new Date().toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(110);
        doc.text(`Inspeksi Harian · ${STATE.pengaturan.judulLokasi} · dicetak ${dicetak}`, m, H - m - 0.6);
        doc.text(`Halaman ${i} dari ${n}`, W - m, H - m - 0.6, { align: 'right' });
        doc.setTextColor(0);
      }

      doc.save(this.namaFile(per));
      notif(`PDF dibuat: ${n} halaman, ${rows.length} entri.`);
    } catch (err) {
      notif('Gagal membuat PDF: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  },

  cetak() {
    const o = this.st.orientasi === 'portrait' ? 'portrait' : 'landscape';
    let st = $('#page-style');
    if (!st) { st = document.createElement('style'); st.id = 'page-style'; document.head.appendChild(st); }
    st.textContent = `@page { size: A4 ${o}; margin: ${this.margin()}mm; }`;
    window.print();
  }
};
