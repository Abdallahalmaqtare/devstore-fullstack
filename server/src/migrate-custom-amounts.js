/* v36 — سكربت ترحيل/تحديث منتجات الكمية المخصصة مباشرة على قاعدة البيانات
   التشغيل:  node server/src/migrate-custom-amounts.js [path/to/test_import.json]
   (بدون مسار ملف: يصلح أي منتج custom_amount موجود أصلاً في القاعدة) */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Product, Category } = require('./models');

function mapProduct(p) {
  const rawVariants = Array.isArray(p.variants) ? p.variants : [];
  const isService = p.type === 'service';
  const isCustom = !isService && p.pricingType === 'custom_amount';
  const minQ = Math.max(1, parseInt(p.minQuantity) || 1);
  let unitP = parseFloat(p.unitPrice) || 0;
  if (unitP <= 0 && rawVariants.length) {
    const v0 = rawVariants[0];
    const ref = parseFloat(v0.finalPrice != null ? v0.finalPrice : (v0.originalPrice != null ? v0.originalPrice : v0.price)) || 0;
    if (ref > 0) unitP = +(ref / minQ).toFixed(8);
  }
  const variants = (isService || isCustom) ? [] : rawVariants
    .filter(v => v && v.name && !isNaN(parseFloat(v.originalPrice != null ? v.originalPrice : v.price)))
    .map(v => {
      const base = parseFloat(v.originalPrice != null ? v.originalPrice : v.price);
      const on = v.isOnSale === true && (parseFloat(v.discountPercent) || 0) > 0;
      const d = on ? Math.min(100, Math.max(0, parseFloat(v.discountPercent))) : 0;
      return { name: String(v.name).trim(), price: base, icon: String(v.icon || ''),
               isOnSale: on, discountPercent: d, finalPrice: on ? +(base - base * d / 100).toFixed(2) : base };
    });
  const set = {
    name: String(p.name).trim(),
    cat: String(p.category || p.cat).toLowerCase().trim(),
    desc: String(p.description || p.desc || ''),
    type: isService ? 'service' : 'product',
    image: String(p.image || ''),
    variants,
    active: p.isActive !== false,
  };
  if (p.playerIdLabel && !isCustom) set.unit = String(p.playerIdLabel);
  if (Array.isArray(p.modes)) set.modes = p.modes.filter(x => ['online', 'onsite'].includes(x));
  if (p.contactWhatsapp) set.contactWhatsapp = String(p.contactWhatsapp).replace(/\D/g, '');
  if (p.contactTelegram) set.contactTelegram = String(p.contactTelegram).replace(/^@/, '');
  if (isCustom) {
    set.pricingType = 'custom_amount';
    set.minQuantity = minQ;
    set.maxQuantity = Math.max(minQ, parseInt(p.maxQuantity) || 1000000);
    set.step = Math.max(1, parseInt(p.step) || Math.max(1, Math.round(minQ / 100)));
    set.unitPrice = unitP;
    set.minQtyPrice = +(unitP * minQ).toFixed(2);
    set.unit = String(p.unitName || p.unit || 'وحدة');
    set.price = unitP; set.finalPrice = unitP; set.isOnSale = false; set.discountPercent = 0;
    set.authType = (p.requiresEmail && p.requiresPassword) ? 'email_password'
      : p.requiresEmail ? 'email_only'
      : (p.authType && ['id_only','email_password','email_only'].includes(p.authType)) ? p.authType : 'id_only';
    set.requiresAccountId = set.authType === 'id_only';
  } else {
    set.requiresAccountId = !!(p.requiresPlayerId || p.requiresAccountId);
    set.pricingType = p.pricingType === 'custom_amount' ? 'custom_amount' : 'packages';
    const basePrice = parseFloat(p.price) || 0;
    const pOn = !isService && p.isOnSale === true && (parseFloat(p.discountPercent) || 0) > 0;
    const pD = pOn ? Math.min(100, Math.max(0, parseFloat(p.discountPercent))) : 0;
    set.price = isService ? 0 : basePrice;
    set.isOnSale = pOn; set.discountPercent = pD;
    set.finalPrice = pOn ? +(basePrice - basePrice * pD / 100).toFixed(2) : basePrice;
  }
  return set;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ متصل بقاعدة البيانات');
  const file = process.argv[2];
  if (file) {
    const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    const cats = Array.isArray(data.categories) ? data.categories : [];
    const prods = Array.isArray(data.products) ? data.products : [];
    const catOps = cats.filter(c => c && (c.id || c.slug)).map(c => ({
      updateOne: { filter: { slug: String(c.id || c.slug).toLowerCase().trim() },
        update: { $set: { slug: String(c.id || c.slug).toLowerCase().trim(),
          nameAr: String(c.nameAr || c.id || '').trim(), nameEn: String(c.nameEn || ''),
          icon: String(c.icon || '🗂️'), kind: c.kind === 'services' ? 'services' : 'shop',
          active: c.isActive !== false } }, upsert: true } }));
    if (catOps.length) await Category.bulkWrite(catOps);
    let customFixed = 0;
    const prodOps = prods.filter(p => p && p.name && (p.category || p.cat)).map(p => {
      const set = mapProduct(p);
      if (set.pricingType === 'custom_amount') customFixed++;
      return { updateOne: { filter: { name: set.name, cat: set.cat }, update: { $set: set }, upsert: true } };
    });
    if (prodOps.length) await Product.bulkWrite(prodOps);
    console.log(`📦 تمت مزامنة ${prodOps.length} منتجاً (${customFixed} كمية مخصصة — أُزيلت variants منها)`);
  }
  /* إصلاح شامل: أي منتج custom_amount في القاعدة ما زال يملك variants */
  const fix = await Product.updateMany({ pricingType: 'custom_amount' }, { $set: { variants: [] } });
  console.log(`🧹 تصفير variants لمنتجات custom_amount الموجودة: ${fix.modifiedCount} مستند`);
  await mongoose.disconnect();
  console.log('✅ اكتمل الترحيل — استجابة GET /api/products أصبحت خالية من variants للمنتجات المخصصة');
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
