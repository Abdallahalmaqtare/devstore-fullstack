const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Order } = require('../models');
const { authRequired, adminOnly, signToken } = require('../middleware/auth');

const publicUser = u => ({ id: u._id, name: u.name, phone: u.phone, role: u.role });

/* إنشاء حساب جديد (دور user دائماً — الأدمن يُنشأ من env فقط) */
router.post('/register', async (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password) return res.status(400).json({ message: 'كل الحقول مطلوبة' });
  if (password.length < 6) return res.status(400).json({ message: 'كلمة المرور 6 أحرف على الأقل' });

  const exists = await User.findOne({ phone: phone.trim() });
  if (exists) return res.status(409).json({ message: 'رقم الهاتف مسجل مسبقاً' });

  const user = await User.create({
    name: name.trim(), phone: phone.trim(),
    password: await bcrypt.hash(password, 10),
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

/* تسجيل الدخول بالهاتف + كلمة المرور */
router.post('/login', async (req, res) => {
  const { phone, password } = req.body || {};
  const user = await User.findOne({ phone: (phone || '').trim() });
  if (!user || !(await bcrypt.compare(password || '', user.password)))
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  if (!user.active) return res.status(403).json({ message: 'الحساب موقوف — تواصل مع الدعم' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

/* بيانات المستخدم الحالي */
router.get('/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

/* قائمة المستخدمين (للأدمن) */
router.get('/users', authRequired, adminOnly, async (req, res) => {
  const users = await User.find().select('-password').sort('-createdAt').lean();
  const counts = await Order.aggregate([{ $group: { _id: '$user', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map(c => [String(c._id), c.n]));
  res.json(users.map(u => ({
    id: u._id, name: u.name, phone: u.phone, role: u.role, active: u.active,
    date: u.createdAt?.toISOString().slice(0, 10), orders: map[String(u._id)] || 0,
  })));
});

/* تفعيل / إيقاف مستخدم */
router.put('/users/:id/toggle', authRequired, adminOnly, async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'غير موجود' });
  if (u.role === 'admin') return res.status(400).json({ message: 'لا يمكن إيقاف المدير' });
  u.active = !u.active;
  await u.save();
  res.json({ id: u._id, active: u.active });
});

module.exports = router;
