const jwt = require('jsonwebtoken');
const { User } = require('../models');

/** يتحقق من توكن JWT ويُرفق المستخدم بالطلب */
async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('-password');
    if (!user || !user.active) return res.status(401).json({ message: 'الحساب غير صالح أو موقوف' });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'جلسة غير صالحة، سجّل الدخول من جديد' });
  }
}

/** يسمح فقط لمن دوره admin */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'صلاحيات المدير مطلوبة' });
  next();
}

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { authRequired, adminOnly, signToken };
