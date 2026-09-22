const router = require('express').Router();
const { Currency } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* عام: العملات الفعّالة (لقائمة الواجهة) */
router.get('/', async (req, res) => {
  res.json(await Currency.find({ active: true }).sort('order').lean());
});
router.get('/all', authRequired, adminOnly, async (req, res) => {
  res.json(await Currency.find().sort('order').lean());
});
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { code, name, rate } = req.body || {};
  if (!code || !name || !rate) return res.status(400).json({ message: 'الرمز والاسم وسعر الصرف مطلوبة' });
  req.body.code = String(code).toUpperCase().trim();
  if (await Currency.findOne({ code: req.body.code }))
    return res.status(409).json({ message: 'العملة موجودة مسبقاً' });
  res.status(201).json(await Currency.create(req.body));
});
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  delete req.body.code;
  const c = await Currency.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!c) return res.status(404).json({ message: 'العملة غير موجودة' });
  res.json(c);
});
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await Currency.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
