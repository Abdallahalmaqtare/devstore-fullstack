const { fetchPlayIcon, avatarFallback } = require('../utils/fetchIcon');
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const {  Product, Category, User, Order } = require('../models');
const { authRequired, adminOnly } = require('../middleware/auth');
const { sendTelegram } = require('../utils/notify');

const cleanPhone = p => String(p || '').replace(/\D/g, '');
const isSuper = u => !!u.isSuper || u.phone === cleanPhone(process.env.ADMIN_PHONE);
function superOnly(req, res, next) {
  if (!isSuper(req.user)) return res.status(403).json({ message: 'هذه العملية مقيدة بالمدير العام فقط' });
  next();
}

/* DELETE /api/admin/users/:id — حذف مستخدم نهائياً + طلباته المعلقة */
router.delete('/users/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'المستخدم غير موجود' });
    if (u.role === 'admin') return res.status(400).json({ message: 'حسابات الأدمن تُدار من قسم المسؤولين' });
    const removed = await Order.deleteMany({ user: u._id, status: 'قيد المراجعة' });
    await User.findByIdAndDelete(u._id);
    await sendTelegram('🗑️ حذف المدير حساب: ' + u.name + ' (' + u.phone + ') — أُلغي ' + removed.deletedCount + ' طلب معلق');
    res.json({ ok: true, removedPendingOrders: removed.deletedCount });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* GET /api/admin/admins — قائمة حسابات الأدمن فقط */
router.get('/admins', authRequired, adminOnly, async (req, res) => {
  const admins = await User.find({ role: 'admin' }).select('-password').sort('createdAt').lean();
  res.json(admins.map(a => ({
    id: a._id, name: a.name, phone: a.phone,
    isSuper: !!(a.isSuper || a.phone === cleanPhone(process.env.ADMIN_PHONE)),
    date: a.createdAt?.toISOString().slice(0, 10),
  })));
});

/* POST /api/admin/create-admin — للمدير العام فقط */
router.post('/create-admin', authRequired, adminOnly, superOnly, async (req, res) => {
  try {
    const { name, phone, password } = req.body || {};
    const ph = cleanPhone(phone);
    if (!name?.trim() || !ph || !password || password.length < 6)
      return res.status(400).json({ message: 'الاسم والهاتف وكلمة المرور (6+) مطلوبة' });
    if (await User.findOne({ phone: ph }))
      return res.status(409).json({ message: 'الرقم مسجل مسبقاً' });
    const u = await User.create({
      name: name.trim(), phone: ph,
      password: await bcrypt.hash(password, 10),
      role: 'admin',
    });
    await sendTelegram('👑 أُنشئ حساب أدمن جديد: ' + u.name + ' (' + u.phone + ')');
    res.status(201).json({ id: u._id, name: u.name, phone: u.phone });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* DELETE /api/admin/admins/:id — سحب الصلاحية (تخفيض لمستخدم) — المدير العام محمي */
router.delete('/admins/:id', authRequired, adminOnly, superOnly, async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u || u.role !== 'admin') return res.status(404).json({ message: 'حساب الأدمن غير موجود' });
    if (isSuper(u)) return res.status(400).json({ message: 'لا يمكن حذف أو تخفيض رتبة المدير العام' });
    u.role = 'user';
    await u.save();
    res.json({ ok: true, demoted: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});


/* ═══ v14: تقرير PDF شامل لمستخدم (للأدمن) ═══ */
router.get('/users/:id/report', authRequired, adminOnly, async (req, res) => {
  try {
    const u = await User.findById(req.params.id).lean();
    if (!u) return res.status(404).json({ message: 'المستخدم غير موجود' });
    const orders = await Order.find({ user: u._id }).sort('-createdAt').lean();
    const done = orders.filter(o => o.status === 'مكتمل');
    res.json({
      user: { name: u.name, phone: u.phone, createdAt: u.createdAt },
      orders,
      stats: {
        total: orders.length,
        completed: done.length,
        cancelled: orders.filter(o => o.status === 'ملغي').length,
        paidTotal: +done.reduce((s2, o) => s2 + (o.total || 0), 0).toFixed(2),
      },
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});


/* ═══ v20: استيراد ومزامنة JSON (Upsert بدون مسح) ═══ */
router.post('/products/import-json', authRequired, adminOnly, async (req, res) => {
  try {
    const cats = Array.isArray(req.body && req.body.categories) ? req.body.categories : [];
    const prods = Array.isArray(req.body && req.body.products) ? req.body.products : [];
    if (!cats.length && !prods.length)
      return res.status(400).json({ message: 'الملف لا يحتوي أقساماً أو منتجات' });

    /* مزامنة الأقسام بالـ slug */
    const catOps = cats.filter(c => c && (c.id || c.slug)).map(c => ({
      updateOne: {
        filter: { slug: String(c.id || c.slug).toLowerCase().trim() },
        update: { $set: {
          slug: String(c.id || c.slug).toLowerCase().trim(),
          nameAr: String(c.nameAr || c.id || '').trim(),
          nameEn: String(c.nameEn || ''),
          icon: String(c.icon || '🗂️'),
          kind: c.kind === 'services' ? 'services' : 'shop',
          active: c.isActive !== false,
        } },
        upsert: true,
      },
    }));
    if (catOps.length) await Category.bulkWrite(catOps);

    /* مزامنة المنتجات بـ (name + cat) مع الحفاظ على _id والطلبات المرتبطة */
    const prodOps = prods.filter(p => p && p.name && (p.category || p.cat)).map(p => {
      const variants = (Array.isArray(p.variants) ? p.variants : [])
        .filter(v => v && v.name && !isNaN(parseFloat(v.originalPrice != null ? v.originalPrice : v.price)))
        .map(v => {
          const base = parseFloat(v.originalPrice != null ? v.originalPrice : v.price);
          const on = v.isOnSale === true && (parseFloat(v.discountPercent) || 0) > 0;
          const d = on ? Math.min(100, Math.max(0, parseFloat(v.discountPercent))) : 0;
          return { name: String(v.name).trim(), price: base, icon: String(v.icon || ''),
                   isOnSale: on, discountPercent: d,
                   finalPrice: on ? +(base - base * d / 100).toFixed(2) : base };
        });
      const isService = p.type === 'service';
      const basePrice = parseFloat(p.price) || 0;
      const pOn = !isService && p.isOnSale === true && (parseFloat(p.discountPercent) || 0) > 0;
      const pD = pOn ? Math.min(100, Math.max(0, parseFloat(p.discountPercent))) : 0;
      /* v36: منتج الكمية المخصصة — تصفير variants إجبارياً واستقبال حقول العداد */
      const isCustom = !isService && p.pricingType === 'custom_amount';
      const set = {
        name: String(p.name).trim(),
        cat: String(p.category || p.cat).toLowerCase().trim(),
        desc: String(p.description || p.desc || ''),
        type: isService ? 'service' : 'product',
        price: isService ? 0 : basePrice,
        image: String(p.image || ''),
        requiresAccountId: !!(p.requiresPlayerId || p.requiresAccountId),
        variants: (isService || isCustom) ? [] : variants,
        isOnSale: pOn, discountPercent: pD,
        finalPrice: pOn ? +(basePrice - basePrice * pD / 100).toFixed(2) : basePrice,
        active: p.isActive !== false,
        isAvailable: !(p.isAvailable === false || p.available === false),
      };
      if (isCustom) {
        const minQ = Math.max(1, parseInt(p.minQuantity) || 1);
        let unitP = parseFloat(p.unitPrice) || 0;
        /* اشتقاق سعر الوحدة من finalPrice للباقة المرجعية عند غياب unitPrice */
        if (unitP <= 0 && variants.length) unitP = +(variants[0].finalPrice / minQ).toFixed(8);
        set.pricingType = 'custom_amount';
        set.minQuantity = minQ;
        set.maxQuantity = Math.max(minQ, parseInt(p.maxQuantity) || 1000000);
        set.step = Math.max(1, parseInt(p.step) || Math.max(1, Math.round(minQ / 100)));
        set.unitPrice = unitP;
        set.minQtyPrice = +(unitP * minQ).toFixed(2);
        set.price = unitP; set.finalPrice = unitP; set.isOnSale = false; set.discountPercent = 0;
        set.unit = String(p.unitName || p.unit || 'وحدة');
        /* authType من حقول الاستيراد أو الافتراضي */
        set.authType = (p.requiresEmail && p.requiresPassword) ? 'email_password'
          : p.requiresEmail ? 'email_only'
          : (p.authType && ['id_only','email_password','email_only'].includes(p.authType)) ? p.authType : 'id_only';
        set.requiresAccountId = set.authType === 'id_only';
      }
      if (p.playerIdLabel) set.unit = String(p.playerIdLabel);
      if (p.contactWhatsapp) set.contactWhatsapp = String(p.contactWhatsapp).replace(/\D/g, '');
      if (p.contactTelegram) set.contactTelegram = String(p.contactTelegram).replace(/^@/, '');
      if (Array.isArray(p.modes)) set.modes = p.modes.filter(x => ['online', 'onsite'].includes(x));
      return { updateOne: { filter: { name: set.name, cat: set.cat }, update: { $set: set }, upsert: true } };
    });
    /* v22: جلب أيقونة تلقائياً لأي منتج بلا صورة */
    for (const op of prodOps) {
      const st = op.updateOne.update.$set;
      if (!st.image) {
        const icon = await fetchPlayIcon(st.name);
        st.image = icon || avatarFallback(st.name);
      }
    }
    if (prodOps.length) await Product.bulkWrite(prodOps);

    res.json({ ok: true, categories: catOps.length, products: prodOps.length });
  } catch (e) { res.status(500).json({ message: 'فشل الاستيراد: ' + e.message }); }
});

module.exports = router;
