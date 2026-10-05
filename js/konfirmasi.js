/* ============================================
   KONFIRMASI UNDUH — jendela untuk memastikan bulan / tanggal laporan sebelum diunduh
   Dipakai oleh: laporan dashboard & laporan inspeksi harian
   ============================================ */

const KonfirmasiUnduh = {
  opsi: null,
  sel: null,         // { mode: 'bulan'|'tanggal', bulan: 'YYYY-MM', dari, sampai, pond }

  init() {
    $$('#dlg-unduh [data-mode]').forEach(b => b.addEventListener('click', () => { this.sel.mode = b.dataset.mode; this.render(); }));
    $('#unduh-bulan').addEventListener('change', e => { this.sel.bulan = e.target.value; this.render(); });
    $('#unduh-dari').addEventListener('change', e => { this.sel.dari = e.target.value; this.render(); });
    $('#unduh-sampai').addEventListener('change', e => { this.sel.sampai = e.target.value; this.render(); });
    $('#unduh-pond').addEventListener('change', e => { this.sel.pond = e.target.value; this.render(); });
    $('#unduh-batal').addEventListener('click', () => $('#dlg-unduh').close());
    $('#form-unduh').addEventListener('submit', e => { e.preventDefault(); this.lanjut(); });
  },

  /**
   * opsi: {
   *   judul, sub,
   *   awal: { mode, bulan, dari, sampai, pond },
   *   rentang(sel) → { dari, sampai }          // tanggal sebenarnya untuk pilihan ini
   *   info(sel, rentang) → { entri, baris: [[label, nilai], …], file }
   *   lanjut(sel, rentang) → Promise           // buat & unduh PDF
   * }
   */
  buka(opsi) {
    this.opsi = opsi;
    this.sel = Object.assign({}, opsi.awal);
    $('#unduh-judul').textContent = opsi.judul;
    $('#unduh-sub').textContent = opsi.sub || 'Periksa periode laporan sebelum diunduh.';

    // Bulan: semua bulan yang ada datanya (terbaru di atas) + bulan awal bila belum ada
    const bulan = [...new Set(STATE.rows.map(r => r.tgl.slice(0, 7)).concat([this.sel.bulan]))].filter(Boolean).sort().reverse();
    $('#unduh-bulan').innerHTML = bulan.map(b => `<option value="${b}">${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}</option>`).join('');
    $('#unduh-pond').innerHTML = '<option value="">Semua pond</option>' + STATE.ponds.map(p => `<option>${esc(p)}</option>`).join('');
    $('#unduh-ok').disabled = false;
    $('#unduh-ok').innerHTML = '<i class="bi bi-download"></i> Unduh PDF';
    this.render();

    const dlg = $('#dlg-unduh');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  },

  /** Rentang tanggal dari pilihan saat ini */
  rentang() {
    const s = this.sel;
    if (s.mode === 'bulan') {
      if (this.opsi.rentang) return this.opsi.rentang(s);
      const [y, m] = s.bulan.split('-').map(Number);
      return { dari: `${s.bulan}-01`, sampai: akhirBulan(y, m) };
    }
    let dari = s.dari, sampai = s.sampai || s.dari;
    if (dari && sampai && dari > sampai) [dari, sampai] = [sampai, dari];
    return { dari, sampai };
  },

  render() {
    const s = this.sel;
    $$('#dlg-unduh [data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === s.mode));
    $$('#dlg-unduh [data-mode-for]').forEach(el => { el.hidden = el.dataset.modeFor !== s.mode; });
    $('#unduh-bulan').value = s.bulan;
    $('#unduh-dari').value = s.dari || '';
    $('#unduh-sampai').value = s.sampai || '';
    $('#unduh-pond').value = s.pond || '';

    const galat = $('#unduh-galat'), ok = $('#unduh-ok');
    const r = this.rentang();
    if (!r.dari || !r.sampai) {
      galat.textContent = 'Pilih tanggal laporan.';
      $('#unduh-ringkas').innerHTML = '';
      ok.disabled = true;
      return;
    }
    const info = this.opsi.info(s, r);
    $('#unduh-ringkas').innerHTML = info.baris.map(([l, v]) => `<dt>${esc(l)}</dt><dd>${esc(v)}</dd>`).join('') +
      `<dt>Jumlah entri</dt><dd class="${info.entri ? '' : 'nol'}">${info.entri ? info.entri + ' entri' : 'Tidak ada data'}</dd>` +
      `<dt>Nama file</dt><dd class="file">${esc(info.file)}</dd>`;
    galat.textContent = info.entri ? '' : 'Tidak ada data inspeksi pada periode ini. Pilih bulan atau tanggal lain.';
    ok.disabled = !info.entri;
  },

  async lanjut() {
    const ok = $('#unduh-ok');
    if (ok.disabled) return;
    const s = Object.assign({}, this.sel), r = this.rentang();
    ok.disabled = true;
    ok.innerHTML = '<span class="spinner sm"></span> Membuat PDF…';
    $('#unduh-batal').disabled = true;
    try {
      await this.opsi.lanjut(s, r);
      $('#dlg-unduh').close();
    } catch (err) {
      $('#unduh-galat').textContent = 'Gagal membuat PDF: ' + err.message;
    } finally {
      ok.disabled = false;
      ok.innerHTML = '<i class="bi bi-download"></i> Unduh PDF';
      $('#unduh-batal').disabled = false;
    }
  }
};
