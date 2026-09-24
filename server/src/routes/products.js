const router = require('express').Router();
const multer = require('multer');
const { Product } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');
const { uploadImage } = require('../utils/notify');
const { fetchPlayIcon, avatarFallback } = require('../utils/fetchIcon');

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
  b.pricingType = b.pricingType === 'custom_amount' ? 'custom_amount' : 'packages';
  b.authType = ['id_only','email_password','email_only'].indexOf(b.authType) !== -1 ? b.authType : 'id_only';
  b.unitPrice = Math.max(0, parseFloat(b.unitPrice) || 0);
  b.minQuantity = Math.max(1, parseInt(b.minQuantity) || 1);
  b.maxQuantity = Math.max(b.minQuantity, parseInt(b.maxQuantity) || 100000);
  b.step = Math.max(1, parseInt(b.step) || 1);
  if (b.pricingType === 'custom_amount') { b.variants = []; b.price = b.unitPrice; b.finalPrice = b.unitPrice; b.requiresAccountId = true; }
  b.isOnSale = b.isOnSale === true || b.isOnSale === 'true';
  b.discountPercent = Math.min(100, Math.max(0, parseFloat(b.discountPercent) || 0));
  if (!b.isOnSale) b.discountPercent = 0;
  var _pr = parseFloat(b.price) || 0;
  b.finalPrice = b.isOnSale && b.discountPercent > 0 ? +(_pr - _pr * b.discountPercent / 100).toFixed(2) : _pr;
  b.variants = (Array.isArray(b.variants) ? b.variants : [])
    .filter(v => v && String(v.name || '').trim() && !isNaN(parseFloat(v.price)))
    .map(function (v) {
      var on = v.isOnSale === true || v.isOnSale === 'true';
      var d = Math.min(100, Math.max(0, parseFloat(v.discountPercent) || 0));
      if (!on) d = 0;
      var base = parseFloat(v.price);
      var fp = on && d > 0 ? +(base - base * d / 100).toFixed(2)
        : (b.isOnSale && b.discountPercent > 0 ? +(base - base * b.discountPercent / 100).toFixed(2) : base);
      return { name: String(v.name).trim(), price: base, icon: String(v.icon || ''),
               isOnSale: on, discountPercent: d, finalPrice: fp };
    });
  if (b.type === 'service') { b.price = 0; b.variants = []; b.requiresAccountId = false; b.countrySelect = false; }
  b.contactWhatsapp = String(b.contactWhatsapp || '').replace(/\D/g, '');
  b.contactTelegram = String(b.contactTelegram || '').replace(/^@/, '').trim();
  return b;
}


/* ═══ v22: جلب أيقونة تطبيق من Google Play بالاسم ═══ */
router.get('/fetch-icon', async (req, res) => {
  try {
    const { term } = req.query;
    if (!term) return res.status(400).json({ error: 'Term is required' });
    const icon = await fetchPlayIcon(term);
    if (icon) return res.json({ iconUrl: icon });
    return res.status(404).json({ error: 'App not found', fallback: avatarFallback(term) });
  } catch (err) { return res.status(500).json({ error: err.message, fallback: avatarFallback(req.query.term) }); }
});

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
