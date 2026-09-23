const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('-password');
  if (user && user.sessionResetAt && payload.iat && payload.iat * 1000 < user.sessionResetAt.getTime())
    return res.status(401).json({ message: 'انتهت الجلسة — سجّل الدخول من جديد' });
    if (!user || !user.active) return res.status(401).json({ message: 'الحساب غير صالح أو موقوف' });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'جلسة غير صالحة، سجّل الدخول من جديد' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'صلاحيات المدير مطلوبة' });
  next();
}

function signToken(user, remember = true) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: remember ? '30d' : '12h' }
  );
}

module.exports = { authRequired, adminOnly, signToken };
