const router = require('express').Router();
const { Category } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* عام: الأقسام الفعّالة مرتبة */
router.get('/', async (req, res) => {
  res.json(await Category.find({ active: true }).sort('order').lean());
});
router.get('/all', authRequired, adminOnly, async (req, res) => {
  res.json(await Category.find().sort('order').lean());
});
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { slug, nameAr } = req.body || {};
  if (!slug || !nameAr) return res.status(400).json({ message: 'المعرف (slug) والاسم العربي مطلوبان' });
  req.body.slug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
  if (await Category.findOne({ slug: req.body.slug }))
    return res.status(409).json({ message: 'المعرف مستخدم مسبقاً' });
  res.status(201).json(await Category.create(req.body));
});
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  delete req.body.slug; // المعرف لا يتغير بعد الإنشاء (حماية للربط)
  const c = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!c) return res.status(404).json({ message: 'القسم غير موجود' });
  res.json(c);
});
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
