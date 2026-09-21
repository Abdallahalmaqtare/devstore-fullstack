const router = require('express').Router();
const { SiteSettings, Product } = require('../models');
const { sendTelegram } = require('../utils/notify');

/* POST /api/inquiries — استفسار عن خدمة + إرجاع قنوات مسؤول الخدمة تحديداً */
router.post('/', async (req, res) => {
  const { serviceId, serviceName, category, mode, name, phone } = req.body || {};
  if (!serviceName && !serviceId) return res.status(400).json({ message: 'الخدمة مطلوبة' });

  const site = await SiteSettings.findOne({ key: 'site' }).lean();
  let service = null;
  if (serviceId) service = await Product.findById(serviceId).lean();

  const finalName = service?.name || serviceName;
  const modeAr = mode === 'onsite' ? 'حضوري في الحديدة' : mode === 'online' ? 'عن بُعد' : 'غير محدد';

  /* قناة مسؤول الخدمة أولاً، ثم قنوات الموقع العامة كاحتياط */
  const whatsapp = (service?.contactWhatsapp || site?.whatsapp || '').replace(/\D/g, '');
  const telegram = (service?.contactTelegram || site?.telegram || '').replace(/^@/, '');

  await sendTelegram(
    `📩 <b>استفسار عن خدمة!</b>\n` +
    `🗂️ التصنيف: ${category || 'خدمة عامة'}\n` +
    `🛎️ الخدمة: <b>${finalName}</b>\n` +
    `📍 نوع الحضور: ${modeAr}\n` +
    `👤 الاسم: ${name || 'زائر'}\n` +
    `📱 الهاتف: ${phone || '—'}\n` +
    (service?.contactWhatsapp ? `↗️ وُجّه إلى منسق الخدمة: ${service.contactWhatsapp}` : `↗️ وُجّه إلى الدعم العام`)
  );

  res.json({ ok: true, whatsapp, telegram });
});

module.exports = router;
