/* ============================================
   ADMIN — sesi admin (token dari server, PIN tidak disimpan) + logo
   ============================================ */

const KUNCI_ADMIN = 'inspeksi-admin-v1';
const KUNCI_LOGO = 'inspeksi-logo-v1';

const Admin = {
  sesi: null,           // { token, exp }
  timerHabis: null,

  aktif() { return !!(this.sesi && this.sesi.exp > Date.now()); },
  token() { return this.aktif() ? this.sesi.token : ''; },

  init() {
    const s = simpanan.get(KUNCI_ADMIN);
    if (s && s.token && s.exp > Date.now()) this.sesi = s; else simpanan.del(KUNCI_ADMIN);
    this.terapkan();

    $('#btn-admin').addEventListener('click', () => this.bukaDialog());
    document.addEventListener('click', e => { if (e.target.closest('[data-masuk-admin]')) this.bukaDialog(); });
    $('#form-admin').addEventListener('submit', e => { e.preventDefault(); this.aktif() ? this.keluar() : this.masuk(); });
    $('#dlg-batal').addEventListener('click', () => $('#dlg-admin').close());

    // Sesi tersimpan → periksa keabsahannya di latar (tidak menghambat tampilan)
    if (this.sesi) setTimeout(() => this.periksaLatar(), 2500);
  },

  /** Terapkan status admin ke seluruh tampilan */
  terapkan() {
    const aktif = this.aktif();
    document.body.classList.toggle('is-admin', aktif);
    const btn = $('#btn-admin');
    btn.querySelector('i').className = aktif ? 'bi bi-person-check-fill' : 'bi bi-person-lock';
    btn.querySelector('span').textContent = aktif ? 'Admin' : 'Masuk';
    btn.title = aktif ? `Masuk sebagai admin sampai ${this.jamHabis()} — klik untuk keluar` : 'Masuk sebagai admin';
    clearTimeout(this.timerHabis);
    if (aktif) this.timerHabis = setTimeout(() => this.keluar(true), Math.min(this.sesi.exp - Date.now(), 2147483000));
    if (typeof Pengaturan !== 'undefined' && STATE.siap) Pengaturan.isi();
  },

  jamHabis() {
    return this.sesi ? new Date(this.sesi.exp).toLocaleString('id-ID', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  },

  bukaDialog() {
    const aktif = this.aktif();
    $('#dlg-admin-judul').textContent = aktif ? 'Anda masuk sebagai admin' : 'Masuk admin';
    $('#dlg-admin-teks').textContent = aktif
      ? `Sesi berlaku sampai ${this.jamHabis()}. Keluar bila perangkat ini dipakai orang lain.`
      : 'Admin dapat mengunduh laporan, mencetak, mengubah pengaturan, dan mengganti logo.';
    $('#dlg-pin-wrap').hidden = aktif;
    $('#dlg-ok').innerHTML = aktif ? '<i class="bi bi-box-arrow-right"></i> Keluar' : '<i class="bi bi-box-arrow-in-right"></i> Masuk';
    $('#dlg-ok').classList.toggle('btn-primary', !aktif);
    $('#dlg-galat').textContent = '';
    $('#admin-pin').value = '';
    const dlg = $('#dlg-admin');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (!aktif) setTimeout(() => $('#admin-pin').focus(), 50);
  },

  async masuk() {
    const pin = $('#admin-pin').value.trim();
    if (!pin) { $('#dlg-galat').textContent = 'Masukkan PIN admin.'; return; }
    const btn = $('#dlg-ok');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner sm"></span> Memeriksa…';
    try {
      const res = await apiPost('masuk', { pin });
      if (!res.success) throw new Error(res.message);
      this.sesi = { token: res.data.token, exp: res.data.exp };
      simpanan.set(KUNCI_ADMIN, this.sesi);
      this.terapkan();
      $('#dlg-admin').close();
      notif('Berhasil masuk sebagai admin.');
    } catch (err) {
      $('#dlg-galat').textContent = err.message;
      $('#admin-pin').select();
    } finally {
      btn.disabled = false;
      if (!this.aktif()) btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Masuk';
    }
  },

  keluar(karenaHabis = false) {
    this.sesi = null;
    simpanan.del(KUNCI_ADMIN);
    this.terapkan();
    if ($('#dlg-admin').open) $('#dlg-admin').close();
    notif(karenaHabis ? 'Sesi admin berakhir. Silakan masuk lagi.' : 'Anda keluar dari mode admin.', karenaHabis ? 'error' : 'ok');
  },

  /** Cek token ke server di latar; bila tidak sah lagi (mis. PIN diganti) → keluar */
  async periksaLatar() {
    if (!this.aktif() || !gasUrlSiap()) return;
    try {
      const res = await apiPost('cekToken', { token: this.token() });
      if (!res.success) this.keluar(true);
    } catch (e) { /* offline: biarkan, server tetap memeriksa saat menyimpan */ }
  },

  /** Penjaga tombol unduh/cetak */
  wajib() {
    if (this.aktif()) return true;
    notif('Fitur ini khusus admin. Silakan masuk terlebih dahulu.', 'error');
    this.bukaDialog();
    return false;
  },

  /** Error dari server karena sesi → keluar otomatis */
  tanganiGalat(err) {
    if (/Sesi admin/i.test(err.message)) this.keluar(true);
  }
};

/* ══════════ LOGO ══════════ */
const Logo = {
  /** Ukuran asli gambar (untuk menjaga perbandingan di PDF) */
  ukuran(dataUrl) {
    return new Promise((ok, gagal) => {
      const img = new Image();
      img.onload = () => ok({ w: img.naturalWidth || 1, h: img.naturalHeight || 1, img });
      img.onerror = () => gagal(new Error('Gambar tidak dapat dibaca.'));
      img.src = dataUrl;
    });
  },

  /** Logo tersimpan di perangkat → tampil seketika */
  muatLokal() {
    const l = simpanan.get(KUNCI_LOGO);
    STATE.logo = l && l.dataUrl ? l : null;
    this.tampilkan();
  },

  tampilkan() {
    const mark = $('#brand-mark');
    if (STATE.logo) {
      mark.innerHTML = `<img src="${STATE.logo.dataUrl}" alt="">`;
      mark.classList.add('ada-logo');
    } else {
      mark.innerHTML = '<i class="bi bi-water"></i>';
      mark.classList.remove('ada-logo');
    }
    const pv = $('#logo-preview');
    if (pv) pv.innerHTML = STATE.logo ? `<img src="${STATE.logo.dataUrl}" alt="Logo">` : '<span>Belum ada logo</span>';
  },

  async set(dataUrl, versi) {
    if (dataUrl) {
      const { w, h } = await this.ukuran(dataUrl);
      STATE.logo = { dataUrl, versi, w, h };
      simpanan.set(KUNCI_LOGO, STATE.logo);
    } else {
      STATE.logo = null;
      simpanan.del(KUNCI_LOGO);
    }
    this.tampilkan();
    if (typeof Laporan !== 'undefined' && STATE.siap) { kotor.add('laporan'); renderJikaAktif('laporan'); }
  },

  /** Samakan logo dengan versi di server (diunduh hanya bila versinya berubah) */
  async sinkron() {
    const versi = String(STATE.pengaturan.logoVersi || '');
    if (versi === String(STATE.logo?.versi || '')) return;
    if (!versi) { await this.set('', ''); return; }
    try {
      const d = await apiGet('getLogo');
      await this.set(d.logo || '', d.versi || '');
    } catch (e) { /* coba lagi pada pemuatan berikutnya */ }
  },

  /** Kecilkan gambar pilihan admin → PNG (maks. 512 px) */
  async olahFile(file) {
    if (!file) throw new Error('Tidak ada file.');
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('Pilih gambar PNG, JPG, WEBP, atau SVG.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Ukuran file maksimal 8 MB.');
    const asal = await new Promise((ok, gagal) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.onerror = () => gagal(new Error('File tidak dapat dibaca.'));
      fr.readAsDataURL(file);
    });
    const { img } = await this.ukuran(asal);
    let w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) { w0 = 512; h0 = 512; } // SVG tanpa ukuran
    for (const maks of [512, 400, 320, 256, 192]) {
      const k = Math.min(1, maks / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, w, h);
      const hasil = cv.toDataURL('image/png');
      if (hasil.length <= 440000) return hasil;
    }
    throw new Error('Gambar terlalu rumit untuk dijadikan logo. Coba gambar yang lebih sederhana.');
  }
};
