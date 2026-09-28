const crypto = require('crypto');
const { sendTelegram } = require('../utils/notify');
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


/* ═══ v47 — دورة OTP الكاملة لتعديل بيانات الأدمن عبر تليجرام ═══ */
const adminOtps = new Map(); // userId -> { hash, expires }

router.post('/request-admin-otp', authRequired, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'للمسؤولين فقط' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    adminOtps.set(String(req.user._id), {
      hash: crypto.createHash('sha256').update(code).digest('hex'),
      expires: Date.now() + 5 * 60 * 1000, /* صالح 5 دقائق */
    });
    await sendTelegram('🔐 رمز التحقق لتعديل بيانات حساب المدير:\nالكود: [ ' + code + ' ]\nصالح لمدة 5 دقائق فقط. لا تشارك هذا الرمز مع أي شخص.');
    res.json({ ok: true, message: 'أُرسل رمز التحقق إلى تليجرام الإدارة' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

function consumeAdminOtp(userId, code) {
  const rec = adminOtps.get(userId);
  if (!rec || rec.expires < Date.now()) return false;
  if (crypto.createHash('sha256').update(String(code || '')).digest('hex') !== rec.hash) return false;
  adminOtps.delete(userId); /* رمز لمرة واحدة */
  return true;
}

router.put('/admin-profile', authRequired, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'للمسؤولين فقط' });
    const bcrypt = require('bcryptjs');
    const { User } = require('../models');
    /* v48: وثيقة حية مباشرة من قاعدة البيانات — لا اعتماد على req.user المحتمل قِدمه */
    const admin = await User.findById(req.user._id);
    if (!admin) return res.status(404).json({ message: 'الحساب غير موجود' });
    const name = String(req.body.name || '').trim();
    /* توحيد تطبيع الهاتف مع مسار تسجيل الدخول: أرقام فقط بدون أصفار بادئة */
    const phone = String(req.body.phone || '').replace(/\D/g, '').replace(/^0+/, '');
    const password = String(req.body.password || '');
    const changes = [];
    if (name && name !== admin.name) changes.push({ key: 'name', label: '✏️ تم تغيير الاسم إلى: ' + name });
    if (phone && phone !== admin.phone) changes.push({ key: 'phone', label: '📱 تم تعديل رقم الهاتف إلى: ' + phone });
    if (password) changes.push({ key: 'password', label: '🔑 تم تغيير كلمة المرور' });
    if (!changes.length) return res.status(400).json({ message: 'لا توجد تغييرات لحفظها' });
    if (!consumeAdminOtp(String(admin._id), req.body.otp))
      return res.status(400).json({ message: 'رمز التحقق غير صحيح أو منتهي — اطلب رمزاً جديداً' });
    if (changes.some(c => c.key === 'phone')) {
      const dup = await User.findOne({ phone, _id: { $ne: admin._id } });
      if (dup) return res.status(400).json({ message: 'رقم الهاتف مستخدم لحساب آخر' });
      admin.phone = phone;
    }
    if (changes.some(c => c.key === 'name')) admin.name = name;
    if (changes.some(c => c.key === 'password')) admin.password = await bcrypt.hash(password, 10);
    admin.sessionResetAt = new Date();
    await admin.save();
    /* v48: تحقق ذاتي إلزامي بعد الحفظ — فشله يعني فشل العملية */
    const check = await User.findById(admin._id).lean();
    const vName = !name || check.name === name;
    const vPhone = !phone || check.phone === phone;
    const vPass = !password || (await bcrypt.compare(password, check.password));
    if (!vName || !vPhone || !vPass)
      return res.status(500).json({ message: '⚠️ فشل تأكيد الحفظ في قاعدة البيانات — لم تُعتمد التعديلات' });
    const now = new Date().toLocaleString('ar-EG', { timeZone: 'Asia/Aden' });
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    await sendTelegram('🚨 <b>إشعار أمني — تم تعديل بيانات حساب المدير بنجاح:</b>\n- التعديلات المعتمدة:\n'
      + changes.map(c => '  • ' + c.label).join('\n')
      + '\n- اسم المدير: ' + check.name
      + '\n- التوقيت: ' + now
      + '\n- عنوان IP: <code>' + ip + '</code>');
    res.json({ ok: true, user: { name: check.name, phone: check.phone, role: check.role } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
