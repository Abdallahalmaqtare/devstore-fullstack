/* v24: هوية المتجر الديناميكية + شعارات بوابات الدفع */
const router = require('express').Router();
const { SiteSettings, PaymentMethod } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* جلب الهوية (عام — لكل الزوار) */
router.get('/branding', async (req, res) => {
  try {
    const n = await SiteSettings.findOne({ key: 'siteName' });
    const l = await SiteSettings.findOne({ key: 'logoUrl' });
    res.json({ siteName: n ? n.value : '', logoUrl: l ? l.value : '' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* تحديث الهوية (أدمن) */
router.put('/branding', authRequired, adminOnly, async (req, res) => {
  try {
    const { siteName, logoUrl } = req.body || {};
    if (siteName != null) await SiteSettings.findOneAndUpdate({ key: 'siteName' }, { key: 'siteName', value: String(siteName).trim() }, { upsert: true });
    if (logoUrl != null) await SiteSettings.findOneAndUpdate({ key: 'logoUrl' }, { key: 'logoUrl', value: String(logoUrl).trim() }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* تعيين شعار بوابة دفع (أدمن) — بالمطابقة عبر _id أو الاسم */
router.put('/paymethod-logo', authRequired, adminOnly, async (req, res) => {
  try {
    const { id, name, logoUrl } = req.body || {};
    let q = null;
    if (id) q = await PaymentMethod.findById(id);
    if (!q && name) q = await PaymentMethod.findOne({ name: String(name).trim() });
    if (!q) return res.status(404).json({ message: 'طريقة الدفع غير موجودة' });
    q.logoUrl = String(logoUrl || '').trim();
    await q.save();
    res.json({ ok: true, id: q._id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* قائمة طرق الدفع مع الشعارات (عام — للسلة) */
router.get('/payment-methods', async (req, res) => {
  try { res.json(await PaymentMethod.find({ active: { $ne: false } }).lean()); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
