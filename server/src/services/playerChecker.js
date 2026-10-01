/* ═══ v61 — خدمة فحص معرّف اللاعب المعزولة (خفيفة: fetch مباشر فقط — بلا Puppeteer) ═══
   مستقلة تماماً عن المشروع الأساسي: مهلة قصوى 5 ثوانٍ لكل محاولة، وفشلها لا يوقف البيع. */
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.midasbuy.com/',
  'Origin': 'https://www.midasbuy.com',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ar-YE,ar;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/json',
};
const TIMEOUT_MS = 5000; /* مهلة قصوى لكل محاولة — لا تعليق للمستخدم */

function extractName(data) {
  if (!data || typeof data !== 'object') return null;
  const ok = data.ret === 0 || data.err_no === 0 || data.error_code === '0' || data.success === true || data.ret === '0';
  if (!ok) return null;
  const d = data.data || data;
  const name = d.nickname || d.playerName || d.role_name || d.username || d.name;
  return name ? String(name) : null;
}

async function tryJson(url, opts) {
  const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts && opts.headers ? opts.headers : {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const raw = await res.text();
  console.log('[playerChecker] ' + (opts.method || 'GET') + ' ' + url + ' → HTTP ' + res.status + ' | ' + raw.slice(0, 200));
  if (res.status === 403 || /captcha|forbidden/i.test(raw)) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* ببجي — Midasbuy (مساران + POST بالـ appid الرسمي) */
async function checkPUBG(playerId) {
  const tries = [
    ['GET', 'https://www.midasbuy.com/midasbuy/us/web/ajax/getPlayerInfo?playerId=' + encodeURIComponent(playerId)],
    ['GET', 'https://www.midasbuy.com/midasbuy/ot/web/ajax/getPlayerInfo?playerId=' + encodeURIComponent(playerId)],
    ['POST', 'https://www.midasbuy.com/midasbuy/us/web/ajax/getPlayerInfo', { playerId, appid: '1450015065' }],
  ];
  for (const t of tries) {
    try {
      const data = await tryJson(t[1], { method: t[0], body: t[2] ? JSON.stringify(t[2]) : undefined });
      const name = extractName(data);
      if (name) return { playerName: name };
    } catch (e) { console.warn('[playerChecker] PUBG try failed:', e.message); }
  }
  return null;
}

/* فري فاير — Shop2Game / Garena */
async function checkFreeFire(playerId) {
  const tries = [
    { app_id: 100067, login_id: playerId },
    { app_id: 100067, login_id: playerId, app_server: 0 },
  ];
  for (const body of tries) {
    try {
      const data = await tryJson('https://shop2game.com/api/auth/player_id_login', {
        method: 'POST', body: JSON.stringify(body),
        headers: { Referer: 'https://shop2game.com/', Origin: 'https://shop2game.com' },
      });
      if (data && data.nickname) return { playerName: String(data.nickname) };
    } catch (e) { console.warn('[playerChecker] FF try failed:', e.message); }
  }
  return null;
}

/* الدالة العامة الخفيفة: checkPlayerName(game, playerId) */
async function checkPlayerName(game, playerId) {
  if (game === 'pubg') return checkPUBG(playerId);
  if (game === 'freefire') return checkFreeFire(playerId);
  return null;
}

module.exports = { checkPlayerName };
