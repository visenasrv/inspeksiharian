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

/** Ambil .data dari respons, lempar error bila success=false */
async function dataDariRespons(res) {
  const json = await bacaJson(res);
  if (!json.success) throw new Error(json.message || 'Permintaan gagal.');
  return json.data;
}

/** GET ?action=...&param=... → data */
async function apiGet(action, params = {}) {
  if (!gasUrlSiap()) throw new Error('GAS_URL belum diisi di js/config.js.');
  const q = new URLSearchParams(Object.assign({ action }, params, { _: Date.now() }));
  const res = await fetch(`${APP_CONFIG.GAS_URL}?${q}`, { method: 'GET', redirect: 'follow' });
  return dataDariRespons(res);
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
