const router = require('express').Router();
const { SiteSettings } = require('../models');
const { sendTelegram } = require('../utils/notify');

/* POST /api/inquiries — استفسار عن خدمة استشارية/تعليمية (عام) */
router.post('/', async (req, res) => {
  const { serviceName, category, name, phone } = req.body || {};
  if (!serviceName) return res.status(400).json({ message: 'اسم الخدمة مطلوب' });

  await sendTelegram(
    `📩 <b>استفسار عن خدمة!</b>\n` +
    `🗂️ التصنيف: ${category || 'خدمة عامة'}\n` +
    `🛎️ الخدمة: <b>${serviceName}</b>\n` +
    `👤 الاسم: ${name || 'زائر'}\n` +
    `📱 الهاتف: ${phone || '—'}`
  );

  const s = await SiteSettings.findOne({ key: 'site' }).lean();
  const wa = (s?.whatsapp || '').replace(/\D/g, '');
  const tg = (s?.telegram || '').replace(/^@/, '');
  res.json({
    ok: true,
    whatsapp: wa,
    telegram: tg,
  });
});

module.exports = router;
