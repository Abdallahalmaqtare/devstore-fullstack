const router = require('express').Router();
const { SiteSettings } = require('../models');
const { sendTelegram } = require('../utils/notify');

/* POST /api/inquiries — استفسار عن خدمة استشارية + إرجاع روابط التواصل */
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
  res.json({
    ok: true,
    whatsapp: (s?.whatsapp || '').replace(/\D/g, ''),
    telegram: (s?.telegram || '').replace(/^@/, ''),
  });
});

module.exports = router;
