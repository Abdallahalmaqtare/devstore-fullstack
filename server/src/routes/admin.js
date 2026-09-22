const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Order } = require('../models');
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

module.exports = router;
