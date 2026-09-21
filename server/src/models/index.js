const mongoose = require('mongoose');
const { Schema, model } = mongoose;

/* ===== المستخدمون ===== */
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== OTP — TTL 10 دقائق على createdAt ===== */
const otpSchema = new Schema({
  phone: { type: String, required: true },
  codeHash: { type: String, required: true },
  purpose: { type: String, enum: ['register', 'reset'], required: true },
  payload: { name: String, password: String },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

/* ===== باقة داخل مجموعة (باقات لعبة/تطبيق/أداة) ===== */
const variantSchema = new Schema({
  name: { type: String, required: true },   // مثال: 60 شدة UC
  price: { type: Number, required: true, min: 0 },
  icon: { type: String, default: '' },
}, { _id: false });

/* ===== المنتجات / المجموعات / الخدمات ===== */
const productSchema = new Schema({
  name: { type: String, required: true },        // للمجموعة: اسم اللعبة/التطبيق/الأداة
  desc: { type: String, default: '' },
  price: { type: Number, default: 0, min: 0 },   // يُستخدم فقط لو لا توجد باقات
  type: { type: String, enum: ['product', 'service'], default: 'product' },
  cat: { type: String, enum: ['apps', 'numbers', 'games', 'tools', 'courses'], required: true },
  icon: { type: String, default: '📦' },
  image: { type: String, default: '' },   // صورة مرفوعة من الجهاز (Cloudinary) — تتقدم على الإيموجي
  unit: { type: String, default: '' },
  /* باقات المجموعة — لو فيها عناصر يصبح المنتج "مجموعة" تُفتح باقاتها في نافذة */
  variants: { type: [variantSchema], default: [] },
  countrySelect: { type: Boolean, default: false },
  requiresAccountId: { type: Boolean, default: false },
  /* قنوات تواصل مسؤول الخدمة (للخدمات الاستشارية) — فارغة = قنوات الموقع العامة */
  contactWhatsapp: { type: String, default: '' },
  contactTelegram: { type: String, default: '' },
  modes: [{ type: String, enum: ['online', 'onsite'] }],
  meta: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== طرق الدفع ===== */
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
    name: String,        // يشمل اسم الباقة: "PUBG — 60 شدة UC"
    variant: String,
    price: Number, qty: Number,
    extra: String,
    accountId: String,
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
