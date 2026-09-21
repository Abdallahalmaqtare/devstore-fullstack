const router = require('express').Router();
const multer = require('multer');
const { Product } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');
const { uploadImage } = require('../utils/notify');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('يُسمح بالصور فقط')),
});

/* تنظيف بيانات المنتج الواردة (خصوصاً مصفوفة الباقات) */
function sanitizeProduct(body) {
  const b = { ...body };
  delete b.image; // الصورة تُعيَّن فقط من ملف مرفوع
  if (typeof b.variants === 'string') { try { b.variants = JSON.parse(b.variants); } catch { b.variants = []; } }
  if (typeof b.modes === 'string') { try { b.modes = JSON.parse(b.modes); } catch { b.modes = []; } }
  b.requiresAccountId = b.requiresAccountId === true || b.requiresAccountId === 'true';
  b.countrySelect = b.countrySelect === true || b.countrySelect === 'true';
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

router.post('/', authRequired, adminOnly, upload.single('image'), async (req, res) => {
  try {
    const body = sanitizeProduct(req.body || {});
    if (!body.name || !body.cat || !body.type)
      return res.status(400).json({ message: 'الاسم والنوع والقسم مطلوبة' });
    if (body.type === 'product' && !body.variants.length && (body.price == null || isNaN(body.price)))
      return res.status(400).json({ message: 'أدخل سعراً أو أضف باقات للمجموعة' });
    if (req.file) body.image = await uploadImage(req.file.buffer, 'devstore/products');
    res.status(201).json(await Product.create(body));
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
});

router.put('/:id', authRequired, adminOnly, upload.single('image'), async (req, res) => {
  try {
    const body = sanitizeProduct(req.body || {});
    if (req.file) body.image = await uploadImage(req.file.buffer, 'devstore/products');
    const p = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ message: 'المنتج غير موجود' });
    res.json(p);
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
