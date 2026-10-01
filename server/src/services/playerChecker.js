/* ═══ v66 — خدمة فحص معرّف اللاعب (Tiger API الرسمي — tigerbot.cc) المعزولة (خفيفة: fetch مباشر فقط — بلا Puppeteer) ═══
   مستقلة تماماً عن المشروع الأساسي: مهلة قصوى 5 ثوانٍ لكل محاولة، وفشلها لا يوقف البيع. */
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
  if (n === null || n === undefined) return false;
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

/* ببجي — v66: API تايجر الرسمي (tigerbot.cc) — Service ID: 264 */
async function checkPUBG(playerId) {
  const cleanId = String(playerId).trim();
  try {
    const res = await fetch('https://tigerbot.cc/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        key: process.env.TIGER_API_KEY || 'd0e7324ce664dbfc18f4c9ce72ae32a4',
        action: 'check',
        service: 264,
        link: cleanId
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const raw = await res.text();
    console.log('[Tiger API Check Response] HTTP ' + res.status + ' | ' + raw.slice(0, 400));
    let d; try { d = JSON.parse(raw); } catch (e) { return null; }
    const name = d.name || d.player_name || d.username || d.nickname || (typeof d.result === 'string' ? d.result : null);
    if (isValidName(name)) return { playerName: String(name) };
    return null;
  } catch (e) {
    console.error('[Tiger API Error]:', e.message);
    return null;
  }
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
