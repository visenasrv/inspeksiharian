# Inspeksi Harian — Pond Charlie Utara PT. PAP

Frontend statis (HTML/CSS/JS) untuk data inspeksi harian pond. Data dibaca dari Google Sheets melalui Google Apps Script (Web App JSON) yang melayani data dari cache.

- **Dashboard**: pH & TSS per pond, penanda di luar batas, kondisi terakhir tiap pond, rekap kerusakan berulang
- **Laporan**: harian / mingguan / bulanan / rentang tanggal → PDF A4 dengan judul dan tanda tangan supervisor
- **Pengaturan**: judul, penanda tangan, batas mutu, margin PDF (dilindungi PIN)

## Struktur

```
index.html
css/style.css
js/config.js      ← isi GAS_URL di sini
js/util.js        ← tanggal, penyeragaman pond, parser pH/TSS, rekap kerusakan
js/api.js         ← fetch ke Apps Script
js/dashboard.js
js/laporan.js
js/pengaturan.js
js/app.js
```

Library dari CDN jsDelivr: Chart.js 4.4.4, jsPDF 2.5.2, jsPDF-AutoTable 3.8.4, Bootstrap Icons 1.11.3.

Panduan lengkap: [PANDUAN-INSTALASI.md](PANDUAN-INSTALASI.md)
