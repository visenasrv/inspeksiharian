/* ============================================
   KONFIGURASI FRONTEND — satu-satunya file yang perlu diedit
   ============================================ */
const APP_CONFIG = {
  // 1) Tempel URL /exec dari Apps Script (Deploy → Web app) di sini:
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzOndrlNX82CKrtopJn01KmWMYfkAcehuij1UpIJt8Ck043PpUpRgY6lheapQEleRYz/exec',

  // 2) Penyeragaman nama pond. Data dari Google Form diketik bebas
  //    ("Uppar rangkok", "SLANTING", "Bemgkoang", ...). Kata kunci dicocokkan
  //    berurutan dari atas — urutan penting (Upper Rangkok sebelum Rangkok).
  POND_ALIAS: [
    { nama: 'Upper Rangkok', kunci: ['upper', 'uppar', 'uppqr', 'uppper'] },
    { nama: 'Rangkok',       kunci: ['rangk'] },
    { nama: 'Selanting',     kunci: ['lanting'] },
    { nama: 'Bengkoang',     kunci: ['beng', 'bemg', 'koang'] },
    { nama: 'Belawan',       kunci: ['belaw'] }
  ],

  // 3) Kerusakan dianggap "masih dilaporkan" bila muncul lagi
  //    dalam N hari terakhir dari data terbaru.
  HARI_KERUSAKAN_AKTIF: 7
};
