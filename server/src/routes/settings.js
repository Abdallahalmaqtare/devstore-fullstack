const router = require('express').Router();
const { PaymentMethod, SiteSettings } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

router.get('/payment-methods', async (req, res) => {
  res.json(await PaymentMethod.find({ active: true }).sort('createdAt').lean());
});
router.get('/payment-methods/all', authRequired, adminOnly, async (req, res) => {
  res.json(await PaymentMethod.find().sort('createdAt').lean());
});
router.post('/payment-methods', authRequired, adminOnly, async (req, res) => {
  const { name, account, instructions, logoUrl } = req.body || {};
  if (!name || !account) return res.status(400).json({ message: 'الاسم ورقم الحساب مطلوبان' });
  res.status(201).json(await PaymentMethod.create({ name, account, instructions: instructions || '', logoUrl: String(logoUrl || '').trim() }));
});
router.put('/payment-methods/:id', authRequired, adminOnly, async (req, res) => {
  const pm = await PaymentMethod.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!pm) return res.status(404).json({ message: 'غير موجودة' });
  res.json(pm);
});
router.delete('/payment-methods/:id', authRequired, adminOnly, async (req, res) => {
  await PaymentMethod.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

router.get('/site', async (req, res) => {
  const s = await SiteSettings.findOne({ key: 'site' }).lean();
  res.json(s || { whatsapp: '', telegram: '', email: '' });
});
router.put('/site', authRequired, adminOnly, async (req, res) => {
  const { whatsapp, telegram, email } = req.body || {};
  const s = await SiteSettings.findOneAndUpdate(
    { key: 'site' },
    {
      whatsapp: String(whatsapp || '').replace(/\D/g, ''),
      telegram: String(telegram || '').replace(/^@/, '').trim(),
      email: email || '',
    },
    { upsert: true, new: true }
  );
  res.json(s);
});

module.exports = router;
