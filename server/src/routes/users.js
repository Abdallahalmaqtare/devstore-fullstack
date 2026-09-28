const jwt = require('jsonwebtoken');
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authRequired } = require('../middleware/auth');

const cleanPhone = p => String(p || '').replace(/\D/g, '');

router.put('/profile', authRequired, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ message: 'الاسم مطلوب' });

  /* 🔒 رقم الهاتف هو معرّف الحساب الموثق — يُتجاهل أي تعديل عليه مهما كان مصدر الطلب */
  const user = await User.findById(req.user._id);
  user.name = name;
  await user.save();
  res.json({ user: { id: user._id, name: user.name, phone: user.phone, role: user.role } });
});

router.put('/change-password', authRequired, async (req, res) => {
  const { current, next } = req.body || {};
  if (!next || next.length < 6) return res.status(400).json({ message: 'كلمة المرور الجديدة 6 أحرف على الأقل' });

  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(String(current || ''), user.password)))
    return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });

  user.password = await bcrypt.hash(next, 10);
  await user.save();
  res.json({ ok: true, message: 'تم تحديث كلمة المرور' });
});


/* ═══ v17: تفاصيل الجلسة الحقيقية ═══ */
router.get('/session-info', authRequired, (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const dec = jwt.decode(token) || {};
    res.json({
      loginAt: dec.iat ? new Date(dec.iat * 1000) : null,
      ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
      ua: String(req.headers['user-agent'] || ''),
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* ═══ v17: تسجيل الخروج من كافة الأجهزة (إبطال كل التوكنات) ═══ */
router.post('/logout-all', authRequired, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { sessionResetAt: new Date() });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
