/* ============================================
   PENGATURAN — logo, judul & tanda tangan laporan, batas mutu (khusus admin)
   ============================================ */

const KUNCI_SET = ['judulLokasi', 'jabatanTtd', 'namaTtd', 'orientasiPdf', 'marginPdf', 'phMin', 'phMax', 'tssMax'];

const Pengaturan = {
  init() {
    $('#form-set').addEventListener('submit', e => this.simpan(e));
    $('#set-logo').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) this.gantiLogo(f); });
    $('#btn-hapus-logo').addEventListener('click', () => this.hapusLogo());
    $('#form-akun').addEventListener('submit', e => this.simpanAkun(e));
  },

  isi() {
    const p = STATE.pengaturan, admin = Admin.aktif(), wajib = Admin.wajibGanti();
    KUNCI_SET.forEach(k => { const el = $(`#set-${k}`); if (el) el.value = p[k] ?? ''; });
    $('#set-fields').disabled = !admin || wajib;           // pengaturan lain terkunci sampai password awal diganti
    $('#btn-hapus-logo').disabled = !STATE.logo;
    Logo.tampilkan();

    // Akun admin
    $('#akun-wajib').hidden = !wajib;
    $('#form-akun').classList.toggle('wajib', wajib);
    $('#akun-baru').placeholder = wajib ? 'wajib diisi' : 'kosongkan bila tidak diganti';
    if (admin && document.activeElement !== $('#akun-username')) $('#akun-username').value = Admin.sesi.username;

    const kartu = $('#admin-card');
    kartu.classList.toggle('aktif', admin);
    kartu.innerHTML = admin
      ? `<div class="ikon"><i class="bi bi-person-check-fill"></i></div>
         <div class="teks"><b>Masuk sebagai ${esc(Admin.sesi.username)}</b><span>Sesi berlaku sampai ${esc(Admin.jamHabis())}. Perubahan langsung dipakai di dashboard dan laporan.</span></div>
         <button type="button" class="btn" id="btn-keluar"><i class="bi bi-box-arrow-right"></i> Keluar</button>`
      : '';
    const keluar = $('#btn-keluar');
    if (keluar) keluar.addEventListener('click', () => Admin.keluar());
  },

  /** Ganti username dan/atau password (diverifikasi server, tidak optimistis) */
  async simpanAkun(e) {
    e.preventDefault();
    if (!Admin.aktif()) { Admin.bukaDialog(); return; }
    const userBaru = $('#akun-username').value.trim();
    const baru = $('#akun-baru').value, ulang = $('#akun-ulang').value, lama = $('#akun-lama').value;
    const salah = (pesan, el) => { notif(pesan, 'error'); if (el) el.focus(); };

    if (!/^[A-Za-z0-9._-]{3,30}$/.test(userBaru)) return salah('Username 3–30 karakter: huruf, angka, titik, garis bawah, atau minus.', $('#akun-username'));
    if (Admin.wajibGanti() && !baru) return salah('Password awal wajib diganti. Isi password baru.', $('#akun-baru'));
    if (baru) {
      if (baru.length < 8) return salah('Password baru minimal 8 karakter.', $('#akun-baru'));
      if (!/[A-Za-z]/.test(baru) || !/[0-9]/.test(baru)) return salah('Password baru harus berisi huruf dan angka.', $('#akun-baru'));
      if (baru.toLowerCase().includes(userBaru.toLowerCase())) return salah('Password tidak boleh memuat username.', $('#akun-baru'));
      if (baru !== ulang) return salah('Ulangi password baru tidak sama.', $('#akun-ulang'));
    }
    if (!baru && userBaru === Admin.sesi.username) return salah('Tidak ada perubahan.');
    if (!lama) return salah('Isi password saat ini untuk konfirmasi.', $('#akun-lama'));

    const btn = $('#btn-akun'), label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner sm"></span> Menyimpan…';
    try {
      const res = await apiPost('gantiAkun', { token: Admin.token(), data: { passwordLama: lama, usernameBaru: userBaru, passwordBaru: baru } });
      if (!res.success) throw new Error(res.message);
      ['#akun-baru', '#akun-ulang', '#akun-lama'].forEach(id => { $(id).value = ''; });
      Admin.simpanSesi(res.data);                 // sesi baru; perangkat lain otomatis keluar
      $('#admin-user').value = res.data.username;
      notif(res.message);
    } catch (err) {
      notif('Gagal: ' + err.message, 'error');
      Admin.tanganiGalat(err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  },

  /** Optimistic: langsung diterapkan ke dashboard & laporan, disimpan ke server di latar */
  async simpan(e) {
    e.preventDefault();
    if (!Admin.wajib()) return;
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
      const res = await apiPost('simpanPengaturan', { token: Admin.token(), data });
      if (!res.success) throw new Error(res.message);
      notif('Pengaturan tersimpan di spreadsheet.');
      segarkan(); // sinkronkan cache lokal di latar
    } catch (err) {
      STATE.pengaturan = lama;                   // kembalikan bila gagal
      $('#brand-sub').textContent = lama.judulLokasi;
      tandaiSemuaKotor();
      notif('Gagal menyimpan, pengaturan dikembalikan: ' + err.message, 'error');
      Admin.tanganiGalat(err);
    }
  },

  /** Logo: langsung tampil, unggah di latar, kembalikan bila gagal */
  async gantiLogo(file) {
    if (!Admin.wajib()) return;
    const lama = STATE.logo ? Object.assign({}, STATE.logo) : null;
    const pv = $('#logo-preview');
    try {
      pv.classList.add('memuat');
      const dataUrl = await Logo.olahFile(file);
      await Logo.set(dataUrl, 'lokal');
      notif('Logo diterapkan. Menyimpan ke spreadsheet…');
      const res = await apiPost('simpanLogo', { token: Admin.token(), logo: dataUrl });
      if (!res.success) throw new Error(res.message);
      await Logo.set(dataUrl, res.data.versi);
      STATE.pengaturan.logoVersi = res.data.versi;
      notif('Logo tersimpan.');
      segarkan();
    } catch (err) {
      await Logo.set(lama ? lama.dataUrl : '', lama ? lama.versi : '');
      notif('Gagal menyimpan logo: ' + err.message, 'error');
      Admin.tanganiGalat(err);
    } finally {
      pv.classList.remove('memuat');
      $('#btn-hapus-logo').disabled = !STATE.logo;
    }
  },

  async hapusLogo() {
    if (!Admin.wajib() || !STATE.logo) return;
    if (!confirm('Hapus logo dari aplikasi dan semua laporan?')) return;
    const lama = Object.assign({}, STATE.logo);
    await Logo.set('', '');
    $('#btn-hapus-logo').disabled = true;
    try {
      const res = await apiPost('simpanLogo', { token: Admin.token(), logo: '' });
      if (!res.success) throw new Error(res.message);
      STATE.pengaturan.logoVersi = '';
      notif('Logo dihapus.');
      segarkan();
    } catch (err) {
      await Logo.set(lama.dataUrl, lama.versi);
      $('#btn-hapus-logo').disabled = false;
      notif('Gagal menghapus logo: ' + err.message, 'error');
      Admin.tanganiGalat(err);
    }
  }
};
