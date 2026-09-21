require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./models');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ===== مسارات الـ API =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/inquiries', require('./routes/inquiries'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

// ===== تقديم الواجهة الأمامية =====
const publicDir = path.join(__dirname, '..', '..', 'public');
app.use(express.static(publicDir));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ===== معالج الأخطاء =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'خطأ في الخادم' });
});

// ===== إنشاء حساب الأدمن عند أول تشغيل =====
async function seedAdmin() {
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !password) return console.warn('⚠️ ADMIN_PHONE/ADMIN_PASSWORD غير مضبوطة');
  if (await User.findOne({ role: 'admin' })) return;
  await User.create({
    name: process.env.ADMIN_NAME || 'المدير العام',
    phone: String(phone).replace(/\D/g, ''),
    password: await bcrypt.hash(password, 10),
    role: 'admin',
  });
  console.log('✅ تم إنشاء حساب الأدمن:', phone);
}

const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ متصل بقاعدة البيانات MongoDB');
    await seedAdmin();
    app.listen(PORT, () => console.log(`🚀 DevStore يعمل على http://localhost:${PORT}`));
  })
  .catch(err => { console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message); process.exit(1); });
