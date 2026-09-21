const router = require('express').Router();
const { Product } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const q = { active: true };
  if (req.query.cat) q.cat = req.query.cat;
  res.json(await Product.find(q).sort('createdAt').lean());
});

router.get('/all', authRequired, adminOnly, async (req, res) => {
  res.json(await Product.find().sort('createdAt').lean());
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  const { name, price, cat, type } = req.body || {};
  if (!name || !cat || !type) return res.status(400).json({ message: 'الاسم والنوع والقسم مطلوبة' });
  if (type === 'product' && (price == null || isNaN(price)))
    return res.status(400).json({ message: 'السعر مطلوب للمنتجات المسعّرة' });
  res.status(201).json(await Product.create(req.body));
});

router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!p) return res.status(404).json({ message: 'المنتج غير موجود' });
  res.json(p);
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
