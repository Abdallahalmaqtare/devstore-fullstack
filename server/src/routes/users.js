const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authRequired } = require('../middleware/auth');

const cleanPhone = p => String(p || '').replace(/[\s\-()+]/g, '').replace(/\D/g, '');

/* PUT /api/users/profile */
router.put('/profile', authRequired, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const phone = cleanPhone(req.body?.phone);
  if (!name || !phone) return res.status(400).json({ message: 'الاسم ورقم الهاتف مطلوبان' });

  const clash = await User.findOne({ phone, _id: { $ne: req.user._id } });
  if (clash) return res.status(409).json({ message: 'رقم الهاتف مستخدم في حساب آخر' });

  const user = await User.findById(req.user._id);
  user.name = name; user.phone = phone;
  await user.save();
  res.json({ user: { id: user._id, name: user.name, phone: user.phone, role: user.role } });
});

/* PUT /api/users/change-password */
router.put('/change-password', authRequired, async (req, res) => {
  const { current, next } = req.body || {};
  if (!next || next.length < 6) return res.status(400).json({ message: 'كلمة المرور الجديدة 6 أحرف على الأقل' });

  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(current || '', user.password)))
    return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });

  user.password = await bcrypt.hash(next, 10);
  await user.save();
  res.json({ ok: true, message: 'تم تحديث كلمة المرور' });
});

module.exports = router;
