const jwt = require('jsonwebtoken');
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { authRequired } = require('../middleware/auth');
const { sendTelegram } = require('../utils/notify');

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
  try {
    /* v50: نفس نموذج v44 المستقر (التحقق بكلمة المرور الحالية) + دعم تعديل الهاتف + إشعار البوت */
    const { current, next } = req.body || {};
    const newPhone = String(req.body.phone || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!current) return res.status(400).json({ message: 'أدخل كلمة المرور الحالية لتأكيد هويتك' });
    if (next && next.length < 6) return res.status(400).json({ message: 'كلمة المرور الجديدة 6 أحرف على الأقل' });
    if (!next && !newPhone) return res.status(400).json({ message: 'لا توجد تعديلات — أدخل رقماً جديداً أو كلمة مرور جديدة' });
    /* وثيقة حية من قاعدة البيانات + فحص كلمة المرور الحالية */
    const admin = await User.findById(req.user._id);
    if (!admin) return res.status(404).json({ message: 'الحساب غير موجود' });
    if (!(await bcrypt.compare(String(current), admin.password)))
      return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
    const changes = [];
    if (newPhone && newPhone !== admin.phone) {
      const dup = await User.findOne({ phone: newPhone, _id: { $ne: admin._id } });
      if (dup) return res.status(400).json({ message: 'رقم الهاتف مستخدم لحساب آخر' });
      admin.phone = newPhone; /* يُعتمد في تسجيل الدخول القادم */
      changes.push('📱 تم تعديل رقم الهاتف إلى: ' + newPhone);
    }
    if (next) { admin.password = await bcrypt.hash(next, 10); changes.push('🔑 تم تغيير كلمة المرور بنجاح'); }
    if (!changes.length) return res.status(400).json({ message: 'لا توجد تغييرات لحفظها' });
    admin.sessionResetAt = new Date(); /* إبطال الجلسات الأخرى بعد تعديل حساس */
    await admin.save();
    /* تحقق ذاتي بعد الحفظ — لا نجاح إلا بقابلية الدخول فعلياً */
    const check = await User.findById(admin._id).lean();
    const okPhone = !newPhone || check.phone === newPhone;
    const okPass = !next || (await bcrypt.compare(next, check.password));
    if (!okPhone || !okPass)
      return res.status(500).json({ message: '⚠️ فشل تأكيد الحفظ في قاعدة البيانات' });
    /* إشعار فوري للبوت يوضح ما تغيّر بالتحديد */
    const now = new Date().toLocaleString('ar-EG', { timeZone: 'Asia/Aden' });
    await sendTelegram('🚨 <b>إشعار أمني — لوحة التحكم</b>\nتم تعديل بيانات حساب المسؤول بنجاح:\n'
      + changes.map(c => '• ' + c).join('\n')
      + '\n👤 الحساب: ' + check.name + '\n🕒 التوقيت: ' + now);
    res.json({ ok: true, message: 'تم الحفظ بنجاح', user: { name: check.name, phone: check.phone, role: check.role } });
  } catch (e) { res.status(500).json({ message: e.message }); }
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
