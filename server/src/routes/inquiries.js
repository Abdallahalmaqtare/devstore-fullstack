const router = require('express').Router();
const { SiteSettings } = require('../models');
const { sendTelegram } = require('../utils/notify');

/* POST /api/inquiries — استفسار عن خدمة استشارية/تعليمية (عام، بدون تسجيل دخول) */
router.post('/', async (req, res) => {
  const { serviceName, name, phone } = req.body || {};
  if (!serviceName) return res.status(400).json({ message: 'اسم الخدمة مطلوب' });

  // إشعار فوري لبوت الإدارة في تليجرام
  await sendTelegram(
    `📩 <b>استفسار عن خدمة!</b>\n` +
    `🛎️ الخدمة: <b>${serviceName}</b>\n` +
    `👤 الاسم: ${name || 'زائر'}\n` +
    `📱 الهاتف: ${phone || '—'}`
  );

  const s = await SiteSettings.findOne({ key: 'site' }).lean();
  const text = encodeURIComponent(`السلام عليكم، أرغب بالاستفسار والاتفاق على خدمة: ${serviceName}`);
  res.json({
    ok: true,
    whatsappUrl: s?.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g, '')}?text=${text}` : '',
    telegramUrl: s?.telegram ? `https://t.me/${s.telegram.replace(/^@/, '')}` : '',
  });
});

module.exports = router;
