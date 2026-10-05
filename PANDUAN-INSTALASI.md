# Panduan Instalasi — Inspeksi Harian Pond Charlie Utara

Aplikasi ini terdiri dari dua bagian:

| Bagian | Isi | Dipasang di |
|---|---|---|
| **Backend** | `Kode.gs` | Apps Script **di dalam spreadsheet "Inspeksi Harian"** |
| **Frontend** | folder `inspeksi-harian/` (isi ZIP) | GitHub Pages |

Data tetap di sheet respons Google Form yang sudah ada. Google Form lama tetap bisa dipakai bersamaan.

---

## Bagian A — Backend (Google Apps Script)

> ⚠️ Pakai akun Google yang **pemilik atau editor** spreadsheet Inspeksi Harian.

1. Buka spreadsheet **Inspeksi Harian** (bukan versi "publish to web").
2. Menu **Ekstensi → Apps Script**.
3. Di editor, ganti nama `Code.gs` menjadi **`Kode`**, hapus isinya, lalu tempel seluruh isi `Kode.gs`. Tekan **Ctrl+S**.
4. Jalankan setup **sekali**:
   - Di dropdown fungsi (sebelah tombol ▶), pilih **`setupAplikasi`** → klik **▶ Run**.
   - Klik **Review permissions** → pilih akun → **Advanced** → **Go to … (unsafe)** → **Allow**.
   - Di **Execution log** harus muncul ✅ nama spreadsheet dan jumlah baris data.
5. Akun admin awal dibuat otomatis: **username `admin`**, **password `admin12345`** (lihat Execution log). Saat pertama kali masuk di aplikasi, Bapak **wajib mengganti password** ini.
6. Kembali ke Apps Script → **Deploy → New deployment**:
   - Klik ikon ⚙️ → pilih **Web app**
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
   - Klik **Deploy** → **salin URL** yang berakhiran **`/exec`**.
7. Uji: buka `URL_EXEC?action=ping` di browser. Harus tampil `{"success":true,"message":"API Inspeksi Harian aktif",...}`.

### Memperbarui ke versi 4.0 (login username & password, konfirmasi unduh)

1. Tempel `Kode.gs` versi 4.0, lalu simpan (Ctrl+S).
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** URL `/exec` tetap sama.
3. Ganti isi repo GitHub dengan ZIP frontend terbaru (ada file baru `js/konfirmasi.js`), isi lagi `GAS_URL`, lalu push.
4. **Login pertama setelah pembaruan:** username **`admin`**, password = **PIN lama** Bapak (isi `pinAdmin` sebelumnya). Setelah login pertama, baris `pinAdmin` otomatis dihapus dari sheet Pengaturan, sehingga password tidak lagi terlihat di spreadsheet. Bila sebelumnya tidak ada PIN, password awalnya `admin12345`.
5. Aplikasi langsung membuka **Pengaturan → Akun admin**. Ganti password (boleh juga ganti username). Fitur admin lain aktif setelah password diganti.

### Memperbarui ke versi 3.0 (admin, unduh laporan dashboard, logo)

1. Tempel `Kode.gs` versi 3.0, lalu simpan (Ctrl+S).
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** URL `/exec` tetap sama.
3. Ganti isi repo GitHub dengan ZIP frontend terbaru (ada file baru `js/admin.js` dan `js/laporan-dashboard.js`), isi lagi `GAS_URL`, lalu push.
4. Sheet tersembunyi **Logo** akan dibuat otomatis saat logo pertama kali diunggah.

### Memperbarui dari versi 1.x ke 2.0

1. Tempel `Kode.gs` versi baru, lalu simpan.
2. Jalankan **`setupAplikasi`** sekali lagi. Langkah ini memasang pemicu `perbaruiCache` (tiap 5 menit) dan mengisi cache pertama kali. Cek di menu **Pemicu (ikon jam)** di kiri editor: harus ada 1 pemicu `perbaruiCache`.
3. Buka **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** Dengan cara ini URL `/exec` tidak berubah.
4. Bila ada sheet **Input Aplikasi** dari versi sebelumnya dan isinya kosong, sheet itu boleh dihapus.

### Mengubah Kode.gs di kemudian hari

Supaya **URL tidak berubah**, jangan buat "New deployment". Gunakan:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**

### Bila spreadsheet asal milik akun belajar.id → spreadsheet Gmail + IMPORTRANGE

Admin akun belajar.id memblokir deploy Web App dengan akses **Anyone**. Gejalanya: muncul dialog "Terjadi error — Harap muat ulang halaman". Solusinya: buat spreadsheet di **Gmail pribadi** yang menyalin data Google Form secara otomatis, lalu pasang Apps Script di sana.

```
Google Form → Spreadsheet belajar.id ──(IMPORTRANGE / IMPORTDATA)──► Spreadsheet Gmail ──► Apps Script ──► GitHub Pages
                                                                       ├─ Data Form        (hasil rumus, hanya-baca)
                                                                       └─ Pengaturan
```

1. Login ke **Gmail pribadi** (sebaiknya di jendela Incognito), lalu buat spreadsheet baru, misalnya **"Inspeksi Harian – Aplikasi"**.
2. Buka **File → Setelan → Zona waktu: (GMT+08:00) Makassar**, lalu klik **Simpan**.
3. Ganti nama `Sheet1` menjadi **`Data Form`**. Di sel **A1**, isi salah satu rumus berikut:

   **Opsi A — IMPORTRANGE.** Pakai ini bila spreadsheet belajar.id bisa dibagikan ke Gmail, minimal sebagai Pelihat:
   ```
   =IMPORTRANGE("URL_SPREADSHEET_BELAJAR_ID"; "Form Responses 1!A:S")
   ```
   Klik sel A1 → **Izinkan akses**. Data biasanya ikut berubah dalam beberapa menit setelah ada isian baru.

   **Opsi B — IMPORTDATA dari link "Publikasikan ke web" yang sudah ada.** Pakai ini bila berbagi ke luar belajar.id diblokir:
   ```
   =IMPORTDATA("https://docs.google.com/spreadsheets/d/e/2PACX-1vR0OLol0hrwKvdO4oI0_DQiutxI9yGrtvN39CWwAbgcskRbt9eOfbIPRXQrbSAqbLl6wRTKK9B-m4B6/pub?output=csv"; ","; "en_US")
   ```
   Opsi ini tidak perlu berbagi file, tetapi Google memperbaruinya lebih lambat (sekitar 1 jam sekali). Angka berawalan nol seperti `05` bisa tampil sebagai `5`. Pastikan publikasi di spreadsheet belajar.id masih aktif dengan centang "Otomatis publikasikan ulang".

   > Bila rumus ditolak, ganti tanda `;` dengan `,` (tergantung bahasa spreadsheet).

4. Pastikan sel A1 sudah menampilkan **Timestamp** dan data di bawahnya.
5. Dari spreadsheet Gmail ini, buka **Ekstensi → Apps Script**. Tempel `Kode.gs` dan biarkan `SPREADSHEET_ID_MANUAL` kosong. Lalu ikuti langkah A4–A7 di atas.
   - Di Execution log akan muncul **"Mode IMPOR"**, **"Pemicu perbaruiCache aktif"**, dan **"Cache data siap"**.
6. Selesai. Data dari Google Form tampil otomatis di dashboard dan laporan.

> **Jangan** menulis apa pun di bawah data pada sheet *Data Form*, karena rumus impor akan error (`#REF!`) saat data bertambah.

**Alternatif:** bila spreadsheet belajar.id bisa dibagikan sebagai **Editor**, Bapak bisa membuat proyek di script.google.com (Gmail). Isi `SPREADSHEET_ID_MANUAL` dengan ID spreadsheet belajar.id. Dengan cara ini, rumus impor tidak diperlukan.

---

## Bagian B — Frontend (GitHub Pages)

### B1. Isi URL backend dulu

1. Ekstrak ZIP. Hasilnya folder **`inspeksi-harian`** yang langsung berisi `index.html`, folder `css/`, dan folder `js/`.
2. Buka **`inspeksi-harian\js\config.js`** dengan Notepad / VS Code.
3. Ganti baris `GAS_URL` dengan URL `/exec` dari langkah A6:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
4. Simpan.

### B2. Push ke GitHub

> 📁 **Folder kerja = folder `inspeksi-harian` itu sendiri** (tempat `index.html` berada).
> Jangan jalankan `git init` di folder induknya. `Kode.gs` **tidak** ikut di folder ini.

1. Di github.com buat repository baru, misalnya `inspeksi-harian`, **Public**, tanpa README.
2. Buka PowerShell di folder `inspeksi-harian` (di File Explorer: klik address bar → ketik `powershell` → Enter).
3. Pastikan isinya benar:
   ```powershell
   dir
   ```
   Harus terlihat `index.html`, `css`, `js`, `README.md`, dan `PANDUAN-INSTALASI.md`.
4. Kirim ke GitHub:
   ```powershell
   git init
   git add .
   git commit -m "Upload pertama Inspeksi Harian"
   git branch -M main
   git remote add origin https://github.com/visenasrv/inspeksi-harian.git
   git push -u origin main
   ```
   (Ganti `visenasrv/inspeksi-harian` bila username atau nama repo berbeda. Saat diminta password, tempel **Personal Access Token**.)
5. Di repo GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**
6. Tunggu 1–2 menit. Situs tampil di `https://visenasrv.github.io/inspeksi-harian/`.

### B3. Update frontend berikutnya

```powershell
git add .
git commit -m "Keterangan perubahan"
git push
```
Bila tampilan belum berubah, tekan **Ctrl+Shift+R**.

---

## Cara pakai singkat

| Menu | Fungsi |
|---|---|
| **Dashboard** | Grafik pH & TSS per pond, sampel di luar batas, kondisi terakhir tiap pond, kerusakan yang berulang. Admin: tombol **Unduh laporan** → jendela konfirmasi → PDF A4 berisi ringkasan, tabel, grafik, dan tanda tangan supervisor |
| **Laporan** | Pilih Harian / Mingguan (Senin–Minggu) / Bulanan / Rentang tanggal, filter pond & kata kunci. Admin: **Unduh PDF** (lewat jendela konfirmasi) atau **Cetak** |
| **Pengaturan** *(hanya terlihat oleh admin)* | Ganti **username & password** admin, unggah/hapus **logo**, ubah judul lokasi, nama & jabatan penanda tangan, batas pH/TSS, margin & orientasi PDF |

**Mode admin:**
- Klik **Masuk** di kanan atas, lalu isi **username** dan **password**. Tombol berubah kuning dan menampilkan username.
- Menu **Pengaturan** hanya muncul setelah masuk sebagai admin. Tamu hanya melihat Dashboard dan Laporan.
- Sesi berlaku **12 jam** di perangkat itu. Password tidak disimpan di perangkat; yang disimpan hanya kunci sesi dari server.
- Setelah 5 kali login gagal, login dikunci 10 menit.
- Untuk keluar: klik tombol username di kanan atas → **Keluar**. Selalu keluar bila memakai perangkat orang lain.
- Tamu tetap bisa melihat dashboard dan pratinjau laporan, tetapi tidak bisa mengunduh atau mencetak, termasuk lewat Ctrl+P.

**Ganti username / password:** buka **Pengaturan → Akun admin**, isi username dan/atau password baru, lalu isi **password saat ini** sebagai konfirmasi dan klik **Simpan akun**.
- Password minimal 8 karakter, berisi huruf dan angka, dan tidak memuat username.
- Setelah akun diganti, perangkat lain yang sedang masuk sebagai admin otomatis keluar.
- Akun disimpan di **Script Properties** Apps Script dalam bentuk hash, bukan di spreadsheet, sehingga orang yang membuka spreadsheet tidak bisa melihat password.

**Lupa password:** buka editor Apps Script → pilih fungsi **`resetAkunAdmin`** → ▶ Run. Akun kembali ke username `admin` dan password `admin12345`. Segera masuk, lalu ganti password.

**Jendela konfirmasi unduh:** sebelum PDF dibuat, muncul jendela berisi pilihan **Per bulan** atau **Per tanggal** (dari–sampai), pilihan pond, serta ringkasan (judul/periode, jumlah entri, ukuran kertas, nama file). Periksa atau ubah bila perlu, lalu klik **Unduh PDF**. Bila periode yang dipilih tidak punya data, tombol Unduh tidak aktif. Periode yang dipilih ikut diterapkan ke halaman, sehingga tampilan di layar sama dengan isi PDF.

**Logo:** unggah di Pengaturan (PNG/JPG/SVG). Gambar otomatis dikecilkan, lalu tampil di header aplikasi, PDF laporan inspeksi, dan PDF laporan dashboard. Logo PNG berlatar transparan memberi hasil paling rapi.

**Kecepatan:**
- **Server:** setiap 5 menit, pemicu `perbaruiCache` membaca spreadsheet dan menyiapkan data dalam bentuk jadi di cache Apps Script. Permintaan dari aplikasi langsung dilayani dari cache tanpa membuka spreadsheet, sehingga jauh lebih cepat.
- **Browser:** setelah pembukaan pertama, aplikasi langsung menampilkan data terakhir yang tersimpan di perangkat, lalu memperbarui diam-diam di latar. Tidak ada layar loading. Saat pertama kali dibuka hanya tampil kerangka halus.
- **Data terbaru:** isian baru dari Google Form muncul paling lambat ±5 menit (ditambah jeda IMPORTRANGE). Untuk mengambil data saat itu juga, tekan tombol **⟳** di kanan atas.

**Tips cetak:** tombol **Unduh PDF** menghasilkan berkas yang sama di semua komputer (margin & nomor halaman terkunci). Bila memakai tombol **Cetak**, pilih kertas **A4**, Scale **100%**, dan matikan **Headers and footers** di dialog cetak.

---

## Hal yang perlu diketahui

- **Akses publik.** Dengan "Who has access: Anyone", siapa pun yang tahu alamat situs bisa melihat data di dashboard. Mengubah pengaturan dan logo dicek di server (wajib sesi admin yang sah). Pembatasan unduh/cetak berlaku di aplikasi: tamu tidak melihat tombolnya dan tidak bisa mencetak. Namun, karena datanya memang terlihat di layar, ini bukan pengaman data yang mutlak.
- **Batas mutu bawaan**: pH 6–9 dan TSS ≤ 200 mg/L. Ini nilai awal — sesuaikan dengan baku mutu yang berlaku di lokasi lewat menu Pengaturan.
- **Nama pond** diseragamkan otomatis ("Uppar rangkok", "SLANTING", "Bemgkoang" → Upper Rangkok, Selanting, Bengkoang). Daftar kata kuncinya ada di `js/config.js` (`POND_ALIAS`). Data asli di sheet tidak diubah.
- Ada 1 entri bernama **"Candra"** (11 April 2026) yang isinya mirip Bengkoang. Aplikasi menampilkannya apa adanya. Bila memang Bengkoang, perbaiki di sheet atau tambahkan `'candra'` ke kunci Bengkoang di `config.js`.
- Kolom **Hasil Sampling Enviro** lama diketik bebas. Aplikasi memisahkan pH dan TSS secara otomatis. Isian yang tidak terbaca (mis. `PH 640.`) muncul di bagian paling bawah Dashboard beserta nomor barisnya.

---

## Masalah umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| "Aplikasi belum tersambung ke spreadsheet" | `GAS_URL` belum diisi | Isi `js/config.js`, lalu push ulang |
| "Server tidak mengirim JSON" | Deploy belum **Anyone**, atau URL bukan `/exec` | Ulangi langkah A6 |
| Perubahan Kode.gs tidak berlaku | Deployment belum diperbarui | Manage deployments → Edit → New version |
| "Username atau password salah" | Salah ketik, atau akun sudah diganti | Periksa huruf besar/kecil password; bila lupa jalankan `resetAkunAdmin` |
| "Terlalu banyak percobaan gagal" | 5 kali login gagal | Tunggu 10 menit, lalu coba lagi |
| "Ganti password awal terlebih dahulu" | Masih memakai password awal | Pengaturan → Akun admin → isi password baru |
| Tiba-tiba keluar dari mode admin | Sesi 12 jam habis, atau akun diganti dari perangkat lain | Masuk lagi dengan akun terbaru |
| Menu Pengaturan / tombol Unduh tidak terlihat | Belum masuk sebagai admin | Klik **Masuk** di kanan atas |
| Situs GitHub 404 | `index.html` tidak di root repo | Push ulang dari folder `inspeksi-harian` |
| Data baru dari Google Form belum muncul | Cache browser, atau jeda rumus impor | Klik tombol ⟳ di kanan atas; untuk IMPORTDATA tunggu hingga ±1 jam |
| "Data impor … belum siap (A1: #REF!)" | IMPORTRANGE belum diizinkan / rumus error | Buka spreadsheet Gmail, klik sel A1 → Izinkan akses |
| Data baru tidak muncul walau sudah > 10 menit | Pemicu belum terpasang | Jalankan `setupAplikasi` sekali lagi; cek menu Pemicu ada `perbaruiCache` |
