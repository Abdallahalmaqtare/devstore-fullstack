/* ═══ v61 — مسار فحص اللاعب: يفوّض للخدمة المعزولة services/playerChecker.js ═══ */
const router = require('express').Router();
const { checkPlayerName } = require('../services/playerChecker');

router.post('/verify-player', async (req, res) => {
  try {
    const game = String((req.body && req.body.game) || '').toLowerCase();
    const playerId = String((req.body && req.body.playerId) || '').replace(/\D/g, '');
    if (!playerId || playerId.length < 5)
      return res.status(400).json({ success: false, message: 'معرف اللاعب غير صحيح — أدخل الأرقام فقط' });
    if (!['pubg', 'freefire'].includes(game))
      return res.status(400).json({ success: false, message: 'نوع اللعبة غير مدعوم — المدعوم: pubg / freefire' });
    const result = await checkPlayerName(game, playerId);
    if (!result)
      return res.status(404).json({ success: false, message: 'معرف اللاعب غير صحيح أو غير موجود، يرجى التأكد وإعادة المحاولة' });
    res.json({ success: true, playerName: result.playerName, playerId });
  } catch (e) { res.status(500).json({ success: false, message: 'خطأ في الخادم: ' + e.message }); }
});

module.exports = router;
