/* ============================================
   PENGATURAN — judul & tanda tangan laporan, batas mutu (dilindungi PIN)
   ============================================ */

const KUNCI_SET = ['judulLokasi', 'jabatanTtd', 'namaTtd', 'orientasiPdf', 'marginPdf', 'phMin', 'phMax', 'tssMax'];

const Pengaturan = {
  pin: null,

  init() {
    $('#btn-pin').addEventListener('click', () => this.buka());
    $('#set-pin').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.buka(); } });
    $('#form-set').addEventListener('submit', e => this.simpan(e));
  },

  isi() {
    const p = STATE.pengaturan;
    KUNCI_SET.forEach(k => { const el = $(`#set-${k}`); if (el) el.value = p[k] ?? ''; });
    $('#pin-info').innerHTML = p.pinDiatur
      ? (this.pin ? '<span class="badge ok"><i class="bi bi-unlock"></i> Terbuka</span> Perubahan langsung dipakai di dashboard dan laporan.' : 'Masukkan PIN admin untuk mengubah pengaturan.')
      : '<span class="badge warn">PIN belum diatur</span> Buka spreadsheet → sheet <b>Pengaturan</b> → isi kolom nilai pada baris <b>pinAdmin</b>. Sementara itu pengaturan bisa diubah langsung di sheet tersebut.';
  },

  async buka() {
    const pin = $('#set-pin').value.trim();
    if (!pin) { notif('Masukkan PIN.', 'error'); return; }
    const btn = $('#btn-pin'), label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner sm"></span> Memeriksa…'; // tanpa layar loading penuh
    try {
      const res = await apiPost('cekPin', { pin });
      if (!res.success) throw new Error(res.message);
      this.pin = pin;
      $('#set-fields').disabled = false;
      notif('Pengaturan terbuka.');
      this.isi();
    } catch (err) {
      notif(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  },

  /** Optimistic: langsung diterapkan ke dashboard & laporan, disimpan ke server di latar */
  async simpan(e) {
    e.preventDefault();
    if (!this.pin) { notif('Buka dengan PIN terlebih dahulu.', 'error'); return; }
    const data = {};
    KUNCI_SET.forEach(k => { data[k] = $(`#set-${k}`).value.trim(); });
    if (Number(data.phMin) >= Number(data.phMax)) { notif('pH minimum harus lebih kecil dari pH maksimum.', 'error'); return; }
    if (Number(data.tssMax) <= 0) { notif('TSS maksimum harus lebih dari 0.', 'error'); return; }

    const lama = Object.assign({}, STATE.pengaturan);
    STATE.pengaturan = olahPengaturan(Object.assign({}, lama, data));
    Laporan.diubahPengguna = { orientasi: false, margin: false };
    $('#brand-sub').textContent = STATE.pengaturan.judulLokasi;
    tandaiSemuaKotor();
    notif('Pengaturan diterapkan. Menyimpan ke spreadsheet…');

    try {
      const res = await apiPost('simpanPengaturan', { pin: this.pin, data });
      if (!res.success) throw new Error(res.message);
      notif('Pengaturan tersimpan di spreadsheet.');
      segarkan(); // sinkronkan cache lokal di latar
    } catch (err) {
      STATE.pengaturan = lama;                   // kembalikan bila gagal
      $('#brand-sub').textContent = lama.judulLokasi;
      tandaiSemuaKotor();
      notif('Gagal menyimpan, pengaturan dikembalikan: ' + err.message, 'error');
    }
  }
};
