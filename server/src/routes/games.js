/* ═══ v60 — التحقق من معرّف اللاعب: ترويسات متصفح كاملة + مسارات احتياطية + سجل الرد الخام ═══ */
const router = require('express').Router();

/* ترويسات محاكاة متصفح رسمي لتجاوز حماية Midasbuy ضد الطلبات البرمجية */
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.midasbuy.com/',
  'Origin': 'https://www.midasbuy.com',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ar-YE,ar;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/json',
};

/* استخراج اسم اللاعب من أي شكل استجابة معروف */
function extractName(data) {
  if (!data || typeof data !== 'object') return null;
  const ok = data.ret === 0 || data.err_no === 0 || data.error_code === '0' || data.success === true || data.ret === '0';
  if (!ok) return null;
  const d = data.data || data;
  const name = d.nickname || d.playerName || d.role_name || d.username || d.name;
  return name ? String(name) : null;
}

/* ببجي: محاولة عدة مسارات/مناطق تباعاً حتى ينجح أحدها */
async function verifyPUBG(playerId) {
  const attempts = [
    { method: 'GET',  url: 'https://www.midasbuy.com/midasbuy/us/web/ajax/getPlayerInfo?playerId=' + encodeURIComponent(playerId) },
    { method: 'GET',  url: 'https://www.midasbuy.com/midasbuy/ot/web/ajax/getPlayerInfo?playerId=' + encodeURIComponent(playerId) },
    { method: 'POST', url: 'https://www.midasbuy.com/midasbuy/us/web/ajax/getPlayerInfo', body: { playerId: playerId, appid: '1450015065' } },
    { method: 'POST', url: 'https://www.midasbuy.com/midasbuy/us/web/ajax/validate', body: { playerId: playerId, appid: '1450015065' } },
  ];
  for (const at of attempts) {
    try {
      const res = await fetch(at.url, {
        method: at.method,
        headers: HEADERS,
        body: at.body ? JSON.stringify(at.body) : undefined,
        signal: AbortSignal.timeout(12000),
      });
      const raw = await res.text();
      /* سجل الرد الخام لتشخيص الحظر/الترويسات/تغير البنية من سجلات Render مباشرة */
      console.log('[PUBG Verify] ' + at.method + ' ' + at.url.split('/midasbuy/')[1] + ' → HTTP ' + res.status + ' | raw: ' + raw.slice(0, 300));
      if (res.status === 403 || /captcha|forbidden/i.test(raw)) continue; /* حظر — جرّب المسار التالي */
      let data = null;
      try { data = JSON.parse(raw); } catch (e) { continue; }
      const name = extractName(data);
      if (name) return { playerName: name };
    } catch (e) {
      console.warn('[PUBG Verify] فشل مسار:', e.message);
    }
  }
  return null;
}

/* فري فاير: Shop2Game أولاً ثم واجهة Garena الاحتياطية */
async function verifyFreeFire(playerId) {
  const attempts = [
    { url: 'https://shop2game.com/api/auth/player_id_login', body: { app_id: 100067, login_id: playerId } },
    { url: 'https://shop2game.com/api/auth/player_id_login', body: { app_id: 100067, login_id: playerId, app_server: 0 } },
  ];
  for (const at of attempts) {
    try {
      const res = await fetch(at.url, {
        method: 'POST',
        headers: { ...HEADERS, Referer: 'https://shop2game.com/', Origin: 'https://shop2game.com' },
        body: JSON.stringify(at.body),
        signal: AbortSignal.timeout(12000),
      });
      const raw = await res.text();
      console.log('[FF Verify] → HTTP ' + res.status + ' | raw: ' + raw.slice(0, 300));
      let data = null;
      try { data = JSON.parse(raw); } catch (e) { continue; }
      if (data && data.nickname) return { playerName: String(data.nickname) };
    } catch (e) { console.warn('[FF Verify] فشل مسار:', e.message); }
  }
  return null;
}

/* POST /api/games/verify-player  { game: 'pubg'|'freefire', playerId } */
router.post('/verify-player', async (req, res) => {
  try {
    const game = String((req.body && req.body.game) || '').toLowerCase();
    const playerId = String((req.body && req.body.playerId) || '').replace(/\D/g, '');
    if (!playerId || playerId.length < 5)
      return res.status(400).json({ success: false, message: 'معرف اللاعب غير صحيح — أدخل الأرقام فقط' });
    let result = null;
    try {
      if (game === 'pubg') result = await verifyPUBG(playerId);
      else if (game === 'freefire') result = await verifyFreeFire(playerId);
      else return res.status(400).json({ success: false, message: 'نوع اللعبة غير مدعوم — المدعوم: pubg / freefire' });
    } catch (e) {
      console.warn('⚠️ فشل الاتصال بمنصة الفحص:', e.message);
      return res.status(502).json({ success: false, message: 'تعذّر الوصول لمنصة الفحص حالياً — حاول بعد قليل' });
    }
    if (!result)
      return res.status(404).json({ success: false, message: 'معرف اللاعب غير صحيح أو غير موجود، يرجى التأكد وإعادة المحاولة' });
    res.json({ success: true, playerName: result.playerName, playerId });
  } catch (e) { res.status(500).json({ success: false, message: 'خطأ في الخادم: ' + e.message }); }
});

module.exports = router;
