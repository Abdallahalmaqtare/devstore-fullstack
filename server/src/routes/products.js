const router = require('express').Router();
const { Product } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* تنظيف بيانات المنتج الواردة (خصوصاً مصفوفة الباقات) */
function sanitizeProduct(body) {
  const b = { ...body };
  b.variants = (Array.isArray(b.variants) ? b.variants : [])
    .filter(v => v && String(v.name || '').trim() && !isNaN(parseFloat(v.price)))
    .map(v => ({ name: String(v.name).trim(), price: parseFloat(v.price), icon: String(v.icon || '') }));
  if (b.type === 'service') { b.price = 0; b.variants = []; b.requiresAccountId = false; b.countrySelect = false; }
  b.contactWhatsapp = String(b.contactWhatsapp || '').replace(/\D/g, '');
  b.contactTelegram = String(b.contactTelegram || '').replace(/^@/, '').trim();
  return b;
}

router.get('/', async (req, res) => {
  const q = { active: true };
  if (req.query.cat) q.cat = req.query.cat;
  res.json(await Product.find(q).sort('createdAt').lean());
});

router.get('/all', authRequired, adminOnly, async (req, res) => {
  res.json(await Product.find().sort('createdAt').lean());
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  const body = sanitizeProduct(req.body || {});
  if (!body.name || !body.cat || !body.type)
    return res.status(400).json({ message: 'الاسم والنوع والقسم مطلوبة' });
  if (body.type === 'product' && !body.variants.length && (body.price == null || isNaN(body.price)))
    return res.status(400).json({ message: 'أدخل سعراً أو أضف باقات للمجموعة' });
  res.status(201).json(await Product.create(body));
});

router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const body = sanitizeProduct(req.body || {});
  const p = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!p) return res.status(404).json({ message: 'المنتج غير موجود' });
  res.json(p);
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
