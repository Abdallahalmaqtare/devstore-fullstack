/* ═══ v59 — التحقق من معرّف اللاعب (ببجي عبر Midasbuy / فري فاير عبر Shop2Game-Garena) ═══ */
const router = require('express').Router();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/* ببجي موبايل — واجهة Midasbuy الداخلية لفحص اللاعب */
async function verifyPUBG(playerId) {
  const url = 'https://www.midasbuy.com/midasbuy/us/web/ajax/getPlayerInfo?playerId=' + encodeURIComponent(playerId);
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) });
  const data = await res.json().catch(() => null);
  if (data && (data.ret === 0 || data.err_no === 0)) {
    const name = (data.data && (data.data.nickname || data.data.playerName)) || data.nickname;
    if (name) return { playerName: String(name) };
  }
  return null;
}

/* فري فاير — واجهة Shop2Game / Garena */
async function verifyFreeFire(playerId) {
  const res = await fetch('https://shop2game.com/api/auth/player_id_login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ app_id: 100067, login_id: playerId }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => null);
  if (data && data.nickname) return { playerName: String(data.nickname) };
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
