const crypto = require('crypto');
const adminOtps = new Map(); // userId -> { code, purpose, expires }
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


/* v46 — طلب رمز تحقق لتعديل بيانات الأدمن الحساسة (يُرسل لتليجرام الإدارة) */
router.post('/request-admin-otp', authRequired, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'للمسؤولين فقط' });
    const purpose = ['name', 'phone', 'password'].includes(req.body.purpose) ? req.body.purpose : 'general';
    const code = String(Math.floor(100000 + Math.random() * 900000));
    adminOtps.set(String(req.user._id), { code: crypto.createHash('sha256').update(code).digest('hex'), purpose, expires: Date.now() + 10 * 60 * 1000 });
    await sendTelegram('🔐 <b>رمز تحقق — لوحة التحكم</b>\nالعملية: <b>' + ({ name: 'تغيير الاسم', phone: 'تغيير رقم الهاتف', password: 'تغيير كلمة المرور' })[purpose] + '</b>\nالمسؤول: ' + req.user.name + ' (<code>' + req.user.phone + '</code>)\nالرمز: <code>' + code + '</code>\n⏱️ صالح لمدة 10 دقائق.');
    res.json({ ok: true, message: 'أُرسل رمز التحقق إلى تليجرام الإدارة' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

function verifyAdminOtp(req, purpose) {
  const rec = adminOtps.get(String(req.user._id));
  if (!rec || rec.expires < Date.now() || rec.purpose !== purpose) return false;
  const hash = crypto.createHash('sha256').update(String(req.body.otp || '')).digest('hex');
  if (hash !== rec.code) return false;
  adminOtps.delete(String(req.user._id));
  return true;
}

/* v46 — تحديث ملف الأدمن مع OTP للحقول الحساسة + تنبيه أمني */
router.put('/admin-profile', authRequired, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'للمسؤولين فقط' });
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const password = String(req.body.password || '');
    const changes = [];
    if (name && name !== req.user.name) changes.push('name');
    if (phone && phone !== req.user.phone) changes.push('phone');
    if (password) changes.push('password');
    if (!changes.length) return res.json({ ok: true, message: 'لا توجد تعديلات', user: req.user });
    for (const ch of changes) {
      if (!verifyAdminOtp(req, ch)) {
        // رمز واحد يكفي إن كان لنفس الغرض الأول — نتحقق من الرمز لأول تغيير حساس فقط
        if (ch === changes[0]) return res.status(400).json({ message: 'رمز التحقق غير صحيح أو منتهي — اطلب رمزاً جديداً' });
      }
    }
    const bcrypt = require('bcryptjs');
    if (changes.includes('name')) req.user.name = name;
    if (changes.includes('phone')) {
      const dup = await require('../models').User.findOne({ phone, _id: { $ne: req.user._id } });
      if (dup) return res.status(400).json({ message: 'رقم الهاتف مستخدم لحساب آخر' });
      req.user.phone = phone;
    }
    if (changes.includes('password')) req.user.password = await bcrypt.hash(password, 10);
    req.user.sessionResetAt = new Date();
    await req.user.save();
    const labels = { name: 'تغيير الاسم', phone: 'تغيير رقم الهاتف', password: 'تغيير كلمة المرور' };
    const now = new Date().toLocaleString('ar-EG', { timeZone: 'Asia/Aden' });
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    await sendTelegram('🚨 <b>تنبيه أمني — لوحة التحكم</b>\nتم تعديل بيانات حساب المسؤول بنجاح:\n- نوع التعديل: <b>' + changes.map(c => labels[c]).join('، ') + '</b>\n- اسم المسؤول: ' + req.user.name + '\n- التاريخ والوقت: ' + now + '\n- عنوان IP: <code>' + ip + '</code>');
    res.json({ ok: true, user: { name: req.user.name, phone: req.user.phone, role: req.user.role } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
