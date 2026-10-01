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
5. Kembali ke spreadsheet. Sekarang ada sheet baru **Pengaturan**. Isi kolom **nilai** pada baris **`pinAdmin`** dengan PIN pilihan Bapak (mis. `2468`). PIN ini dipakai untuk membuka menu Pengaturan di aplikasi.
6. Kembali ke Apps Script → **Deploy → New deployment**:
   - Klik ikon ⚙️ → pilih **Web app**
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
   - Klik **Deploy** → **salin URL** yang berakhiran **`/exec`**.
7. Uji: buka `URL_EXEC?action=ping` di browser. Harus tampil `{"success":true,"message":"API Inspeksi Harian aktif",...}`.

### Mengubah Kode.gs di kemudian hari

Supaya **URL tidak berubah**, jangan buat "New deployment". Gunakan:
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**

### Bila spreadsheet asal milik akun belajar.id → spreadsheet Gmail + IMPORTRANGE

Admin akun belajar.id memblokir deploy Web App dengan akses **Anyone**. Gejalanya: muncul dialog "Terjadi error — Harap muat ulang halaman". Solusinya: buat spreadsheet di **Gmail pribadi** yang menyalin data Google Form secara otomatis, lalu pasang Apps Script di sana.

```
Google Form → Spreadsheet belajar.id ──(IMPORTRANGE / IMPORTDATA)──► Spreadsheet Gmail ──► Apps Script ──► GitHub Pages
                                                                       ├─ Data Form        (hasil rumus, hanya-baca)
                                                                       ├─ Input Aplikasi   (input dari aplikasi)
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
   - Di Execution log akan muncul **"Mode IMPOR"**, dan sheet **Input Aplikasi** dibuat otomatis.
6. Selesai. Data dari Google Form tampil otomatis. Input lewat menu **Input** di aplikasi disimpan ke sheet *Input Aplikasi* dan ikut tampil di dashboard dan laporan, tetapi **tidak** dikirim balik ke spreadsheet belajar.id.

> **Jangan** menulis apa pun di bawah data pada sheet *Data Form*, karena rumus impor akan error (`#REF!`) saat data bertambah.

**Alternatif:** bila spreadsheet belajar.id bisa dibagikan sebagai **Editor**, Bapak bisa membuat proyek di script.google.com (Gmail). Isi `SPREADSHEET_ID_MANUAL` dengan ID spreadsheet belajar.id. Dengan cara ini, input dari aplikasi langsung masuk ke sheet Google Form.

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
| **Dashboard** | Grafik pH & TSS per pond, sampel di luar batas, kondisi terakhir tiap pond, kerusakan yang berulang |
| **Laporan** | Pilih Harian / Mingguan (Senin–Minggu) / Bulanan / Rentang tanggal, filter pond & kata kunci → **Unduh PDF** (A4) atau **Cetak** |
| **Input** | Isi inspeksi baru. Peralatan terisi otomatis dari laporan terakhir pond yang sama. pH & TSS diisi di kolom angka terpisah |
| **Pengaturan** | Ubah judul lokasi, nama & jabatan penanda tangan, batas pH/TSS, margin & orientasi PDF (perlu PIN) |

**Kecepatan & sinyal lemah:**
- Setelah pembukaan pertama, aplikasi langsung menampilkan data terakhir yang tersimpan di perangkat (sekitar 0,1 detik), lalu memperbarui dari spreadsheet di latar belakang. Status di kanan atas menampilkan "Memperbarui…" selama proses itu.
- Tombol **Simpan inspeksi** langsung menampilkan data di dashboard & laporan, lalu mengirimnya ke spreadsheet di latar belakang.
- Bila sinyal putus, isian disimpan di perangkat dan status menampilkan **"1 belum terkirim"**. Data dikirim otomatis saat online kembali, atau saat tombol ⟳ ditekan. Kiriman ulang tidak membuat baris ganda.
- Isian form Input yang belum disimpan juga tersimpan otomatis sebagai draf.

**Tips cetak:** tombol **Unduh PDF** menghasilkan berkas yang sama di semua komputer (margin & nomor halaman terkunci). Bila memakai tombol **Cetak**, pilih kertas **A4**, Scale **100%**, dan matikan **Headers and footers** di dialog cetak.

---

## Hal yang perlu diketahui

- **Akses publik.** Dengan "Who has access: Anyone", siapa pun yang tahu alamat situs bisa melihat data dan mengirim input (sama seperti link Google Form). Pengaturan tetap terkunci PIN.
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
| "PIN admin belum diatur" | Baris `pinAdmin` di sheet Pengaturan kosong | Isi PIN di sheet Pengaturan |
| Situs GitHub 404 | `index.html` tidak di root repo | Push ulang dari folder `inspeksi-harian` |
| Data baru dari Google Form belum muncul | Cache browser, atau jeda rumus impor | Klik tombol ⟳ di kanan atas; untuk IMPORTDATA tunggu hingga ±1 jam |
| "Data impor … belum siap (A1: #REF!)" | IMPORTRANGE belum diizinkan / rumus error | Buka spreadsheet Gmail, klik sel A1 → Izinkan akses |
