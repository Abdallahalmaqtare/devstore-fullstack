const router = require('express').Router();
const { Product } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* عام: جلب المنتجات الفعّالة (يمكن فلترتها حسب القسم) */
router.get('/', async (req, res) => {
  const q = { active: true };
  if (req.query.cat) q.cat = req.query.cat;
  res.json(await Product.find(q).sort('createdAt').lean());
});

/* أدمن: جلب الكل (بما فيها المعطّلة) */
router.get('/all', authRequired, adminOnly, async (req, res) => {
  res.json(await Product.find().sort('createdAt').lean());
});

/* أدمن: إضافة منتج */
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { name, price, cat } = req.body || {};
  if (!name || price == null || !cat) return res.status(400).json({ message: 'الاسم والسعر والقسم مطلوبة' });
  const p = await Product.create(req.body);
  res.status(201).json(p);
});

/* أدمن: تعديل منتج */
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!p) return res.status(404).json({ message: 'المنتج غير موجود' });
  res.json(p);
});

/* أدمن: حذف منتج */
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
