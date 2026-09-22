const router = require('express').Router();
const multer = require('multer');
const { SiteSettings, Order, Product, PaymentMethod } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');

/* السعر المعتمد للطلب: المخفّض إن وُجد خصم نشط — يُحسب من قاعدة البيانات فقط */
function salePrice(prod, base) {
  if (prod && prod.isOnSale && prod.discountPercent > 0)
    return +(base - base * prod.discountPercent / 100).toFixed(2);
  return base;
}

/* ═══ v14: مهلة إلغاء الطلب من العميل ═══ */
router.get('/cancel-window', async (req, res) => {
  const st = await SiteSettings.findOne({ key: 'cancelWindowMinutes' });
  res.json({ minutes: st ? (parseInt(st.value) || 30) : 30 });
});
router.put('/cancel-window', authRequired, adminOnly, async (req, res) => {
  const m = Math.max(0, parseInt(req.body && req.body.minutes) || 0);
  await SiteSettings.findOneAndUpdate({ key: 'cancelWindowMinutes' }, { key: 'cancelWindowMinutes', value: String(m) }, { upsert: true });
  res.json({ ok: true, minutes: m });
});
router.post('/:id/cancel', authRequired, async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o || String(o.user) !== String(req.user._id)) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (o.status !== 'قيد المراجعة') return res.status(400).json({ message: 'لا يمكن إلغاء طلب بهذه الحالة' });
    const st = await SiteSettings.findOne({ key: 'cancelWindowMinutes' });
    const win = (st ? (parseInt(st.value) || 30) : 30) * 60000;
    if (Date.now() - o.createdAt.getTime() > win)
      return res.status(400).json({ message: 'انتهت مهلة الإلغاء التلقائي — يرجى التواصل مع الدعم' });
    o.status = 'ملغي';
    await o.save();
    await sendTelegram('🚫 <b>العميل ألغى طلبه بنفسه</b>\n🔢 الطلب: <code>' + o.code + '</code>\n👤 ' + (o.customerName || '') + ' (<code>' + (o.customerPhone || '') + '</code>)\n💰 الإجمالي: $' + o.total);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
const { uploadImage, sendTelegram } = require('../utils/notify');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('يُسمح بالصور فقط')),
});

/* POST /api/orders — يدعم باقات المجموعات: item = {id, variant, qty, extra, accountId} */
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

      /* حسم السعر والاسم من قاعدة البيانات: من الباقة إن وُجدت، وإلا من المنتج نفسه */
      let name = p.name, price = (p.finalPrice > 0 ? p.finalPrice : salePrice(p, p.price)), variant = '';
      if (p.variants?.length) {
        const v = p.variants.find(x => x.name === i.variant);
        if (!v) throw Object.assign(new Error(`الباقة غير متوفرة في «${p.name}»`), { status: 400 });
        name = `${p.name} — ${v.name}`;
        price = (v.finalPrice > 0 ? v.finalPrice : salePrice(p, v.price));
        variant = v.name;
      }

      if (p.requiresAccountId && !String(i.accountId || '').trim())
        throw Object.assign(new Error(`معرّف الحساب (Player ID) مطلوب لـ «${name}»`), { status: 400 });

      total += price * (i.qty || 1);
      return {
        product: p._id, name, variant, price, qty: i.qty || 1,
        extra: i.extra || '', accountId: String(i.accountId || '').trim(),
      };
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

    const lines = orderItems.map(i =>
      `• ${i.name} ×${i.qty}${i.extra ? ` (${i.extra})` : ''}${i.accountId ? `\n  🆔 الحساب: <code>${i.accountId}</code>` : ''}`
    ).join('\n');
    await sendTelegram(
      `🛒 <b>طلب جديد!</b>\n\n🔢 رقم الطلب: <b>${order.code}</b>\n👤 العميل: ${order.customerName}\n📱 الهاتف: ${order.customerPhone}\n\n📦 الخدمات:\n${lines}\n\n💰 الإجمالي: <b>$${order.total}</b>\n💳 الدفع: ${pm.name} (${pm.account})\n🧾 السند: ${receiptUrl}`
    );
    res.status(201).json({ ok: true, code: order.code });
  } catch (e) { res.status(e.status || 500).json({ message: e.message }); }
});

router.get('/my-orders', authRequired, async (req, res) => {
  res.json(await Order.find({ user: req.user._id }).sort('-createdAt').lean());
});
router.get('/mine', authRequired, async (req, res) => {
  res.json(await Order.find({ user: req.user._id }).sort('-createdAt').lean());
});

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
