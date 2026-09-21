const mongoose = require('mongoose');
const { Schema, model } = mongoose;

/* ===== المستخدمون (مع دور admin / user) ===== */
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== المنتجات / الخدمات / الدورات ===== */
const productSchema = new Schema({
  name: { type: String, required: true },
  desc: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  cat: { type: String, enum: ['games', 'numbers', 'tools', 'courses'], required: true },
  icon: { type: String, default: '📦' },
  unit: { type: String, default: '' },          // مثل: "يبدأ من"
  countrySelect: { type: Boolean, default: false }, // يطلب اختيار دولة (الأرقام الوهمية)
  modes: [{ type: String, enum: ['online', 'onsite'] }], // للدورات
  meta: { type: String, default: '' },          // للدورات: المدة والمستوى
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== طرق الدفع اليدوية (يديرها الأدمن ديناميكياً) ===== */
const paymentMethodSchema = new Schema({
  name: { type: String, required: true },        // مثال: الكريمي جوال
  account: { type: String, required: true },     // رقم المحفظة / الحساب
  instructions: { type: String, default: '' },   // تعليمات تظهر للعميل
  active: { type: Boolean, default: true },
}, { timestamps: true });

/* ===== الطلبات ===== */
const orderSchema = new Schema({
  code: { type: String, unique: true },          // DS-XXXX
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: String,
  customerPhone: String,
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    price: Number,
    qty: Number,
    extra: String,                               // مثل: الدولة المختارة
  }],
  total: { type: Number, required: true },
  paymentMethod: { name: String, account: String },
  receiptUrl: { type: String, default: '' },     // رابط سند الحوالة (Cloudinary)
  status: { type: String, enum: ['قيد المراجعة', 'مكتمل', 'ملغي'], default: 'قيد المراجعة' },
}, { timestamps: true });

module.exports = {
  User: model('User', userSchema),
  Product: model('Product', productSchema),
  PaymentMethod: model('PaymentMethod', paymentMethodSchema),
  Order: model('Order', orderSchema),
};
