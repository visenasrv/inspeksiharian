/* ============================================
   API — komunikasi dengan Google Apps Script (fetch, bukan google.script.run)
   ============================================ */

function gasUrlSiap() {
  const u = APP_CONFIG.GAS_URL || '';
  return /^https:\/\/script\.google(usercontent)?\.com\//.test(u) && !u.includes('GANTI_DENGAN');
}

async function bacaJson(res) {
  const teks = await res.text();
  try {
    return JSON.parse(teks);
  } catch (e) {
    // Biasanya halaman login Google → deploy belum "Who has access: Anyone"
    throw new Error('Server tidak mengirim JSON. Pastikan Web App di-deploy dengan "Who has access: Anyone" dan URL berakhiran /exec.');
  }
}

/** GET ?action=... → data */
async function apiGet(action) {
  if (!gasUrlSiap()) throw new Error('GAS_URL belum diisi di js/config.js.');
  const url = `${APP_CONFIG.GAS_URL}?action=${encodeURIComponent(action)}&_=${Date.now()}`;
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  const json = await bacaJson(res);
  if (!json.success) throw new Error(json.message || 'Permintaan gagal.');
  return json.data;
}

/** POST {action, ...isi} → respons utuh {success, message, data} */
async function apiPost(action, isi = {}) {
  if (!gasUrlSiap()) throw new Error('GAS_URL belum diisi di js/config.js.');
  const res = await fetch(APP_CONFIG.GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    // WAJIB text/plain — application/json memicu CORS preflight yang ditolak GAS
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action }, isi))
  });
  return bacaJson(res);
}
