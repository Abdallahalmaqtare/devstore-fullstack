/* v70: PUBG RapidAPI timeout = 25 seconds. Free Fire settings unchanged. */
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.midasbuy.com/',
  'Origin': 'https://www.midasbuy.com',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ar-YE,ar;q=0.9,en-US;q=0.8,en;q=0.7',
  'X-Requested-With': 'XMLHttpRequest', /* v63: إلزامية — تُجبر Midasbuy على إرجاع JSON بدل صفحة HTML */
  'Content-Type': 'application/json',
};
const TIMEOUT_MS = 5000; /* مهلة قصوى لكل محاولة — لا تعليق للمستخدم */
/* v65: كلمات محظورة — لا يجوز تمريرها كاسم لاعب معتمد */
const INVALID_NAMES = ['error', 'not found', 'null', 'undefined', 'failed', 'false', 'none', ''];
function isValidName(n) {
  if (typeof n !== 'string') return false;
  const v = String(n).toLowerCase().trim();
  return v.length > 0 && INVALID_NAMES.indexOf(v) === -1;
} /* مهلة قصوى لكل محاولة — لا تعليق للمستخدم */

function extractName(data) {
  if (!data || typeof data !== 'object') return null;
  const ok = data.ret === 0 || data.err_no === 0 || data.error_code === '0' || data.success === true || data.ret === '0';
  if (!ok) return null;
  const d = data.data || data;
  const name = d.nick_name || d.nickname || d.playerName || d.role_name || d.username || d.name;
  return isValidName(name) ? String(name) : null;
}

async function tryJson(url, opts) {
  const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts && opts.headers ? opts.headers : {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const raw = await res.text();
  console.log('[playerChecker] ' + (opts.method || 'GET') + ' ' + url + ' → HTTP ' + res.status + ' | ' + raw.slice(0, 200));
  if (res.status === 403 || /captcha|forbidden/i.test(raw)) return null;
  /* v63: رد HTML بـ 200 = ترويسة AJAX مفقودة/حظر — لا نعامله كبيانات */
  const ct = String(res.headers.get('content-type') || '');
  const t = raw.trim();
  if (t.startsWith('<') || (ct.indexOf('json') === -1 && t.charAt(0) !== '{' && t.charAt(0) !== '[')) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/* v72: فحص موحّد للعبتين عبر RapidAPI id-game-checker — pubg:/pubgm-global/{id} | freefire:/ff-global/{id} */
const GAME_ENDPOINTS = { pubg: '/pubgm-global/', freefire: '/ff-global/' };
async function checkPlayerId(playerId, gameType = 'pubg') {
  const cleanId = String(playerId).trim();
  const game = GAME_ENDPOINTS[gameType] ? gameType : 'pubg';
  const startedAt = Date.now();
  console.log('[Checking Player ID]:', cleanId, '| game:', game);
  try {
    const response = await fetch('https://id-game-checker.p.rapidapi.com' + GAME_ENDPOINTS[game] + encodeURIComponent(cleanId), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || '955a2dc3b6msh94f8949770db1fdp1f5fcejsne77f8998fd84',
        'x-rapidapi-host': 'id-game-checker.p.rapidapi.com',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(30000)
    });
    const raw = await response.text();
    console.log('[RapidAPI ' + game + ' HTTP Status]:', response.status, '| durationMs:', Date.now() - startedAt);
    console.log('[RapidAPI ' + game + ' Raw Response]:', raw);
    if (!response.ok) {
      console.error('[RapidAPI ' + game + ' Error]:', { status: response.status, body: raw });
      return { success: false, message: 'تعذر التحقق من معرف اللاعب حالياً', statusCode: 502 };
    }
    let res;
    try { res = JSON.parse(raw); } catch (e) { return { success: false, message: 'تعذر التحقق من معرف اللاعب حالياً', statusCode: 502 }; }
    if (res && !res.error && res.data && isValidName(res.data.username)) {
      return { success: true, playerName: res.data.username.trim(), isBanned: res.data.is_ban || false };
    }
    return { success: false, message: 'معرف اللاعب غير موجود أو غير صحيح', statusCode: 404 };
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError' || error.code === 'ECONNABORTED';
    console.error('[RapidAPI ' + game + ' Error]:', { name: error.name, code: error.code, message: error.message, durationMs: Date.now() - startedAt });
    return { success: false, message: timedOut ? 'استغرق الفحص وقتاً طويلاً، يمكنك استخدام زر التخطي' : 'تعذر التحقق من معرف اللاعب حالياً', statusCode: timedOut ? 504 : 502 };
  }
}
async function checkPubgId(playerId) { return checkPlayerId(playerId, 'pubg'); }

/* الدالة العامة الخفيفة: checkPlayerName(game, playerId) */
async function checkPlayerName(game, playerId) {
  if (game === 'pubg' || game === 'freefire') return checkPlayerId(playerId, game);
  return null;
}

module.exports = { checkPlayerName, checkPubgId, checkPlayerId };
