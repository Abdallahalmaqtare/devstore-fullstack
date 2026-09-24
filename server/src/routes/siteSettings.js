/* v28: مسار إعدادات موحد — GET عام للواجهة + PUT للأدمن — حفظ دائم في MongoDB */
const router = require('express').Router();
const { SiteSettings } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* GET /api/settings — يعيد siteName + siteLogo + بيانات التواصل بصيغة JSON واحدة */
router.get('/', async (req, res) => {
  try {
    const n = await SiteSettings.findOne({ key: 'siteName' }).lean();
    const l = await SiteSettings.findOne({ key: 'logoUrl' }).lean();
    const site = await SiteSettings.findOne({ key: 'site' }).lean();
    res.json({
      siteName: n && n.value ? n.value : '',
      siteLogo: l && l.value ? l.value : '',
      whatsapp: site && site.whatsapp ? site.whatsapp : '',
      telegram: site && site.telegram ? site.telegram : '',
      email: site && site.email ? site.email : '',
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* PUT /api/settings — حفظ دائم في قاعدة البيانات (upsert — ليس متغير ذاكرة) */
router.put('/', authRequired, adminOnly, async (req, res) => {
  try {
    const b = req.body || {};
    if (b.siteName != null) await SiteSettings.findOneAndUpdate({ key: 'siteName' }, { $set: { key: 'siteName', value: String(b.siteName).trim() } }, { upsert: true });
    const logo = b.siteLogo != null ? b.siteLogo : b.logoUrl;
    if (logo != null) await SiteSettings.findOneAndUpdate({ key: 'logoUrl' }, { $set: { key: 'logoUrl', value: String(logo).trim() } }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
