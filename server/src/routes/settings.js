const router = require('express').Router();
const { PaymentMethod } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* عام: طرق الدفع الفعّالة (تظهر للعميل عند الدفع) */
router.get('/payment-methods', async (req, res) => {
  res.json(await PaymentMethod.find({ active: true }).sort('createdAt').lean());
});

/* أدمن: كل طرق الدفع */
router.get('/payment-methods/all', authRequired, adminOnly, async (req, res) => {
  res.json(await PaymentMethod.find().sort('createdAt').lean());
});

/* أدمن: إضافة طريقة دفع يدوية جديدة (كريمي، النجم، محافظ...) */
router.post('/payment-methods', authRequired, adminOnly, async (req, res) => {
  const { name, account, instructions } = req.body || {};
  if (!name || !account) return res.status(400).json({ message: 'الاسم ورقم الحساب مطلوبان' });
  res.status(201).json(await PaymentMethod.create({ name, account, instructions: instructions || '' }));
});

/* أدمن: تعديل / تفعيل / تعطيل طريقة دفع */
router.put('/payment-methods/:id', authRequired, adminOnly, async (req, res) => {
  const pm = await PaymentMethod.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!pm) return res.status(404).json({ message: 'غير موجودة' });
  res.json(pm);
});

/* أدمن: حذف طريقة دفع */
router.delete('/payment-methods/:id', authRequired, adminOnly, async (req, res) => {
  await PaymentMethod.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
