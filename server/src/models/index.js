const mongoose = require('mongoose');
const { Schema, model } = mongoose;

/* ===== المستخدمون (admin / user) ===== */
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== رموز التحقق OTP (صالحة 10 دقائق ثم تُحذف تلقائياً) ===== */
const otpSchema = new Schema({
  phone: { type: String, required: true },
  codeHash: { type: String, required: true },
  purpose: { type: String, enum: ['register', 'reset'], required: true },
  payload: { name: String, password: String },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* ===== المنتجات / الخدمات ===== */
const productSchema = new Schema({
  name: { type: String, required: true },
  desc: { type: String, default: '' },
  price: { type: Number, default: 0, min: 0 },
  type: { type: String, enum: ['product', 'service'], default: 'product' },
  cat: { type: String, enum: ['games', 'numbers', 'tools', 'courses'], required: true },
  icon: { type: String, default: '📦' },
  unit: { type: String, default: '' },
  countrySelect: { type: Boolean, default: false },
  /* يطلب من العميل إدخال معرّف الحساب (Player ID) قبل الإضافة للسلة */
  requiresAccountId: { type: Boolean, default: false },
  modes: [{ type: String, enum: ['online', 'onsite'] }],
  meta: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== طرق الدفع اليدوية ===== */
const paymentMethodSchema = new Schema({
  name: { type: String, required: true },
  account: { type: String, required: true },
  instructions: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== الطلبات ===== */
const orderSchema = new Schema({
  code: { type: String, unique: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: String,
  customerPhone: String,
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: String, price: Number, qty: Number,
    extra: String,        // الدولة المختارة مثلاً
    accountId: String,    // معرّف الحساب / Player ID
  }],
  total: { type: Number, required: true },
  paymentMethod: { name: String, account: String },
  receiptUrl: { type: String, default: '' },
  status: { type: String, enum: ['قيد المراجعة', 'مكتمل', 'ملغي'], default: 'قيد المراجعة' },
}, { timestamps: true });

/* ===== إعدادات الموقع ===== */
const settingsSchema = new Schema({
  key: { type: String, unique: true, default: 'site' },
  whatsapp: { type: String, default: '967700000000' },
  telegram: { type: String, default: 'devstore_support' },
  email: { type: String, default: '' },
});

module.exports = {
  User: model('User', userSchema),
  Otp: model('Otp', otpSchema),
  Product: model('Product', productSchema),
  PaymentMethod: model('PaymentMethod', paymentMethodSchema),
  Order: model('Order', orderSchema),
  SiteSettings: model('SiteSettings', settingsSchema),
};
