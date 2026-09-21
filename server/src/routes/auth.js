const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Order, Otp, SiteSettings } = require('../models');
const { authRequired, adminOnly, signToken } = require('../middleware/auth');
const { sendTelegram } = require('../utils/notify');

const publicUser = u => ({ id: u._id, name: u.name, phone: u.phone, role: u.role });
/* توحيد الرقم: أرقام فقط — تُستخدم نفس الدالة في التسجيل والدخول لضمان التطابق */
const cleanPhone = p => String(p || '').replace(/\D/g, '');
/* كشف انتهاء الصلاحية من createdAt (نفس مرجعية TTL) — عمر الرمز 10 دقائق */
const OTP_TTL_MS = 10 * 60 * 1000;
const isExpired = otp => (Date.now() - otp.createdAt.getTime()) > OTP_TTL_MS;

async function issueOtp(phone, purpose, payload) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await Otp.deleteMany({ phone, purpose });
  await Otp.create({ phone, purpose, payload, codeHash: await bcrypt.hash(code, 8) });

  const purposeAr = purpose === 'register' ? 'تفعيل حساب جديد' : 'استعادة كلمة المرور';
  await sendTelegram(
    `🔐 <b>رمز تحقق جديد — ${purposeAr}</b>\n` +
    `📱 الهاتف: <code>${phone}</code>\n` +
    `🔢 الرمز: <b>${code}</b>\n` +
    `⏱️ صالح 10 دقائق — سلّمه للعميل عبر واتساب`
  );

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: '+' + phone, From: process.env.TWILIO_FROM, Body: `رمز التحقق DevStore: ${code}` }),
      });
    } catch (e) { console.error('Twilio SMS:', e.message); }
  }
}

/* التحقق: لا يُحذف الرمز إلا بعد نجاح المطابقة فقط */
async function checkOtp(phone, purpose, code) {
  const otp = await Otp.findOne({ phone, purpose }).sort('-createdAt');
  if (!otp || isExpired(otp)) return { err: 'الرمز منتهي — اطلب رمزاً جديداً' };
  if (otp.attempts >= 5) return { err: 'محاولات كثيرة — اطلب رمزاً جديداً' };
  if (!(await bcrypt.compare(String(code || ''), otp.codeHash))) {
    otp.attempts += 1;
    await otp.save();
    return { err: 'الرمز غير صحيح' };
  }
  return { otp }; // الحذف يتم في المستدعي بعد نجاح العملية كاملة
}

/* POST /api/auth/send-otp */
router.post('/send-otp', async (req, res) => {
  const phone = cleanPhone(req.body?.phone);
  const { purpose, name, password } = req.body || {};
  if (!phone || !['register', 'reset'].includes(purpose))
    return res.status(400).json({ message: 'بيانات غير مكتملة' });

  if (purpose === 'register') {
    if (!name?.trim() || !password || password.length < 6)
      return res.status(400).json({ message: 'الاسم وكلمة المرور (6 أحرف+) مطلوبة' });
    if (await User.findOne({ phone }))
      return res.status(409).json({ message: 'رقم الهاتف مسجل مسبقاً — سجّل الدخول' });
    await issueOtp(phone, 'register', { name: name.trim(), password: await bcrypt.hash(password, 10) });
  } else {
    if (!(await User.findOne({ phone })))
      return res.status(404).json({ message: 'لا يوجد حساب بهذا الرقم' });
    await issueOtp(phone, 'reset');
  }

  const s = await SiteSettings.findOne({ key: 'site' }).lean();
  const wa = cleanPhone(s?.whatsapp);
  res.json({
    ok: true,
    whatsappUrl: wa ? `https://wa.me/${wa}?text=${encodeURIComponent('مرحباً، أطلب رمز التحقق لرقم ' + phone)}` : '',
  });
});

/* POST /api/auth/verify-otp */
router.post('/verify-otp', async (req, res) => {
  const phone = cleanPhone(req.body?.phone);
  const { code, purpose } = req.body || {};
  const { err, otp } = await checkOtp(phone, purpose, code);
  if (err) return res.status(400).json({ message: err });

  if (purpose === 'register') {
    if (await User.findOne({ phone })) return res.status(409).json({ message: 'الحساب موجود مسبقاً' });
    const user = await User.create({ name: otp.payload.name, phone, password: otp.payload.password });
    await Otp.deleteOne({ _id: otp._id }); // حذف بعد النجاح فقط
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }
  /* reset: لا نحذف الرمز هنا — يُحذف في reset-password بعد تغيير كلمة المرور بنجاح */
  res.json({ ok: true });
});

/* POST /api/auth/reset-password */
router.post('/reset-password', async (req, res) => {
  const phone = cleanPhone(req.body?.phone);
  const { code, password } = req.body || {};
  if (!password || password.length < 6)
    return res.status(400).json({ message: 'كلمة المرور الجديدة 6 أحرف على الأقل' });
  const { err, otp } = await checkOtp(phone, 'reset', code);
  if (err) return res.status(400).json({ message: err });

  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: 'الحساب غير موجود' });
  user.password = await bcrypt.hash(password, 10);
  await user.save();
  await Otp.deleteOne({ _id: otp._id }); // حذف بعد اكتمال العملية
  res.json({ token: signToken(user), user: publicUser(user) });
});

/* POST /api/auth/login — يدعم remember (تذكرني) */
router.post('/login', async (req, res) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    const remember = req.body?.remember !== false; // الافتراضي تذكّر
    const user = await User.findOne({ phone });
    if (!user || !(await bcrypt.compare(String(req.body?.password || ''), user.password)))
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    if (!user.active) return res.status(403).json({ message: 'الحساب موقوف — تواصل مع الدعم' });
    res.json({ token: signToken(user, remember), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ message: 'خطأ في الخادم: ' + e.message });
  }
});

/* POST /api/auth/admin-login */
router.post('/admin-login', async (req, res) => {
  try {
    const phone = cleanPhone(req.body?.phone);
    const user = await User.findOne({ phone, role: 'admin' });
    if (!user || !(await bcrypt.compare(String(req.body?.password || ''), user.password)))
      return res.status(401).json({ message: 'بيانات دخول المدير غير صحيحة' });
    if (!user.active) return res.status(403).json({ message: 'الحساب موقوف' });
    res.json({ token: signToken(user, true), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ message: 'خطأ في الخادم: ' + e.message });
  }
});

router.get('/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

router.get('/users', authRequired, adminOnly, async (req, res) => {
  const users = await User.find().select('-password').sort('-createdAt').lean();
  const counts = await Order.aggregate([{ $group: { _id: '$user', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map(c => [String(c._id), c.n]));
  res.json(users.map(u => ({
    id: u._id, name: u.name, phone: u.phone, role: u.role, active: u.active,
    date: u.createdAt?.toISOString().slice(0, 10), orders: map[String(u._id)] || 0,
  })));
});

router.put('/users/:id/toggle', authRequired, adminOnly, async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'غير موجود' });
  if (u.role === 'admin') return res.status(400).json({ message: 'لا يمكن إيقاف المدير' });
  u.active = !u.active;
  await u.save();
  res.json({ id: u._id, active: u.active });
});

module.exports = router;
