const router = require('express').Router();
const multer = require('multer');
const { Order, Product, PaymentMethod } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');
const { uploadImage, sendTelegram } = require('../utils/notify');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('يُسمح بالصور فقط')),
});

/* POST /api/orders — إنشاء طلب (منتجات مسعّرة فقط + سند إجباري) */
router.post('/', authRequired, upload.single('receipt'), async (req, res) => {
  try {
    const items = JSON.parse(req.body.items || '[]');
    const pmId = req.body.paymentMethodId;
    if (!items.length) return res.status(400).json({ message: 'السلة فارغة' });
    if (!req.file) return res.status(400).json({ message: 'صورة سند الحوالة مطلوبة' });

    const pm = await PaymentMethod.findOne({ _id: pmId, active: true });
    if (!pm) return res.status(400).json({ message: 'طريقة الدفع غير صالحة' });

    const ids = items.map(i => i.id);
    const products = await Product.find({ _id: { $in: ids }, active: true, type: 'product' }).lean();
    const pmap = Object.fromEntries(products.map(p => [String(p._id), p]));

    let total = 0;
    const orderItems = items.map(i => {
      const p = pmap[i.id];
      if (!p) throw Object.assign(new Error('عنصر غير قابل للشراء المباشر'), { status: 400 });
      total += p.price * (i.qty || 1);
      return { product: p._id, name: p.name, price: p.price, qty: i.qty || 1, extra: i.extra || '' };
    });

    const receiptUrl = await uploadImage(req.file.buffer);
    const order = await Order.create({
      code: 'DS-' + Date.now().toString(36).toUpperCase(),
      user: req.user._id,
      customerName: req.user.name,
      customerPhone: req.user.phone,
      items: orderItems,
      total: +total.toFixed(2),
      paymentMethod: { name: pm.name, account: pm.account },
      receiptUrl,
    });

    const lines = orderItems.map(i => `• ${i.name} ×${i.qty}${i.extra ? ` (${i.extra})` : ''}`).join('\n');
    await sendTelegram(
      `🛒 <b>طلب جديد!</b>\n\n🔢 رقم الطلب: <b>${order.code}</b>\n👤 العميل: ${order.customerName}\n📱 الهاتف: ${order.customerPhone}\n\n📦 الخدمات:\n${lines}\n\n💰 الإجمالي: <b>$${order.total}</b>\n💳 الدفع: ${pm.name} (${pm.account})\n🧾 السند: ${receiptUrl}`
    );
    res.status(201).json({ ok: true, code: order.code });
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
});

/* GET /api/orders/my-orders — طلبات المستخدم الحالي */
router.get('/my-orders', authRequired, async (req, res) => {
  res.json(await Order.find({ user: req.user._id }).sort('-createdAt').lean());
});
router.get('/mine', authRequired, async (req, res) => {
  res.json(await Order.find({ user: req.user._id }).sort('-createdAt').lean());
});

/* أدمن: كل الطلبات + تحديث الحالة */
router.get('/', authRequired, adminOnly, async (req, res) => {
  res.json(await Order.find().sort('-createdAt').lean());
});
router.put('/:id/status', authRequired, adminOnly, async (req, res) => {
  const { status } = req.body || {};
  if (!['قيد المراجعة', 'مكتمل', 'ملغي'].includes(status))
    return res.status(400).json({ message: 'حالة غير صالحة' });
  const o = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!o) return res.status(404).json({ message: 'الطلب غير موجود' });
  await sendTelegram(`🔄 الطلب <b>${o.code}</b> أصبح: <b>${status}</b>`);
  res.json(o);
});

module.exports = router;
