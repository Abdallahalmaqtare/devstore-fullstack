/* بيانات أولية — شغّله مرة واحدة: node server/src/seed.js */
require('dotenv').config();
const mongoose = require('mongoose');
const { Product, PaymentMethod, SiteSettings } = require('./models');

const products = [
  /* ================= 🎮 ألعاب (مجموعات بباقات) ================= */
  {
    type: 'product', cat: 'games', icon: '🟥', name: 'PUBG Mobile',
    desc: 'شحن شدات UC فوري عبر ID اللاعب — كل الباقات الرسمية.',
    requiresAccountId: true,
    variants: [
      { name: '60 شدة UC', price: 1.20, icon: '🟥' },
      { name: '325 شدة UC', price: 5.50, icon: '🟥' },
      { name: '660 شدة UC', price: 10.50, icon: '🟥' },
      { name: '1800 شدة UC', price: 27.00, icon: '🟥' },
      { name: '8100 شدة UC', price: 115.00, icon: '🟥' },
    ],
  },
  {
    type: 'product', cat: 'games', icon: '💎', name: 'Free Fire',
    desc: 'شحن جواهر فري فاير فوري وآمن عبر ID اللاعب.',
    requiresAccountId: true,
    variants: [
      { name: '100 جوهرة', price: 1.00, icon: '💎' },
      { name: '210 جوهرة', price: 2.00, icon: '💎' },
      { name: '530 جوهرة', price: 5.00, icon: '💎' },
      { name: '1080 جوهرة', price: 9.50, icon: '💎' },
    ],
  },
  {
    type: 'product', cat: 'games', icon: '🧱', name: 'Roblox',
    desc: 'شحن Robux وبطاقات روبلوكس الرسمية.',
    requiresAccountId: true,
    variants: [
      { name: '80 Robux', price: 1.00, icon: '🧱' },
      { name: '400 Robux', price: 4.50, icon: '🧱' },
      { name: '800 Robux', price: 9.00, icon: '🧱' },
    ],
  },

  /* ================= 📱 تطبيقات (مجموعات بباقات) ================= */
  {
    type: 'product', cat: 'apps', icon: '🎵', name: 'TikTok',
    desc: 'شحن كوينز تيك توك فوري على حسابك.',
    requiresAccountId: true,
    variants: [
      { name: '70 كوينز', price: 1.10, icon: '🎵' },
      { name: '350 كوينز', price: 5.50, icon: '🎵' },
      { name: '700 كوينز', price: 11.00, icon: '🎵' },
    ],
  },
  {
    type: 'product', cat: 'apps', icon: '💜', name: 'Soul',
    desc: 'شحن كوينز تطبيق Soul بأفضل الأسعار.',
    requiresAccountId: true,
    variants: [
      { name: '100 كوينز', price: 1.50, icon: '💜' },
      { name: '500 كوينز', price: 7.00, icon: '💜' },
    ],
  },
  {
    type: 'product', cat: 'apps', icon: '🎤', name: 'Tango',
    desc: 'شحن عملات تانجو لايف الرسمية.',
    requiresAccountId: true,
    variants: [
      { name: '120 عملة', price: 1.20, icon: '🎤' },
      { name: '600 عملة', price: 6.00, icon: '🎤' },
    ],
  },
  {
    type: 'product', cat: 'apps', icon: '🤖', name: 'ChatGPT Plus',
    desc: 'تفعيل اشتراك شهري رسمي لحسابك.',
    variants: [{ name: 'اشتراك شهري', price: 20.00, icon: '🤖' }],
  },

  /* ================= 💬 أرقام وهمية (منتجات مفردة) ================= */
  { type: 'product', cat: 'numbers', icon: '📱', name: 'رقم وهمي — واتساب', desc: 'رقم جاهز لتفعيل واتساب مع كود التفعيل فوراً.', price: 1.50, countrySelect: true },
  { type: 'product', cat: 'numbers', icon: '✈️', name: 'رقم وهمي — تليجرام', desc: 'رقم موثوق لتفعيل تليجرام، ضمان استلام الكود.', price: 1.50, countrySelect: true },
  { type: 'product', cat: 'numbers', icon: '🌐', name: 'رقم وهمي — خدمات دولية', desc: 'تفعيل فيسبوك، تيك توك، Signal وأكثر من 50 خدمة.', price: 2.00, countrySelect: true },

  /* ================= 🛠️ أدوات المبرمجين (مجموعات بباقات) ================= */
  {
    type: 'product', cat: 'tools', icon: '🔧', name: 'SamFw Tool',
    desc: 'أرصدة SamFw الأصلية لتخطي FRP وفتح الشبكات.',
    variants: [
      { name: 'رصيد واحد (1 Credit)', price: 2.50, icon: '🔧' },
      { name: '5 أرصدة', price: 11.00, icon: '🔧' },
      { name: '10 أرصدة', price: 20.00, icon: '🔧' },
    ],
  },
  {
    type: 'product', cat: 'tools', icon: '🧰', name: 'Chimera Tool',
    desc: 'أرصدة وتفعيلات Chimera الأصلية.',
    variants: [
      { name: '100 كريدت', price: 9.00, icon: '🧰' },
      { name: 'رخصة شهرية', price: 25.00, icon: '🧰' },
    ],
  },
  {
    type: 'product', cat: 'tools', icon: '📡', name: 'DFS CDMA Tool',
    desc: 'تفعيل رسمي لبرمجة هواتف CDMA وضبط الشبكات.',
    variants: [{ name: 'تفعيل سنوي', price: 15.00, icon: '📡' }],
  },

  /* ================= 🎓 خدمات وتدريب (تواصل مباشر مع المنسق) ================= */
  { type: 'service', cat: 'courses', icon: '📲', name: 'تطوير تطبيقات الجوال — Flutter & Dart', desc: 'من الصفر حتى نشر تطبيقك على المتاجر.', modes: ['online', 'onsite'], meta: 'دورة تدريبية • 3 أشهر' },
  { type: 'service', cat: 'courses', icon: '💻', name: 'دورة برمجة لغة C++', desc: 'أساسيات البرمجة وهياكل البيانات بلغة C++ بأسلوب عملي.', modes: ['online', 'onsite'], meta: 'دورة تدريبية • 8 أسابيع' },
  { type: 'service', cat: 'courses', icon: '📡', name: 'برمجة الهواتف وضبط الشبكات (CDMA / VoLTE)', desc: 'تفعيل أنظمة CDMA وخدمة VoLTE لشبكة يمن موبايل.', modes: ['onsite'], meta: 'دورة تدريبية • 6 أسابيع' },
  { type: 'service', cat: 'courses', icon: '💼', name: 'دليلك للعمل الحر — Upwork', desc: 'بناء بروفايل احترافي والفوز بأول عميل دولي.', modes: ['online', 'onsite'], meta: 'دورة تدريبية • 4 أسابيع' },
  { type: 'service', cat: 'courses', icon: '🎓', name: 'مشاريع التخرج البرمجية', desc: 'تنفيذ ومناقشة مشاريع التخرج باحترافية.', modes: ['online', 'onsite'], meta: 'مشروع تخرج • حسب المشروع' },
  { type: 'service', cat: 'courses', icon: '📚', name: 'التكاليف والواجبات الجامعية', desc: 'مساعدة احترافية في التكاليف البرمجية والتقارير.', modes: ['online'], meta: 'تكليف جامعي • حسب الحجم' },
  { type: 'service', cat: 'courses', icon: '🗄️', name: 'إصلاح المشاكل وقواعد البيانات', desc: 'حل مشاكل السيرفرات وقواعد البيانات واسترجاع البيانات.', modes: ['online'], meta: 'خدمة برمجية • حسب الطلب' },
];

const methods = [
  { name: 'الكريمي جوال', account: '77XXXXXXX', instructions: 'حوّل باسم: DevStore' },
  { name: 'النجم / محفظة النجم', account: '73XXXXXXX', instructions: '' },
  { name: 'USDT (TRC20)', account: 'TXxxxxxxxxxxxxxxxxxxx', instructions: 'شبكة TRON فقط' },
];

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  if (!(await Product.countDocuments())) { await Product.insertMany(products); console.log('✅ تم إدراج المجموعات والخدمات'); }
  else console.log('ℹ️ المنتجات موجودة مسبقاً — احذف المجموعة لإعادة البذر');
  if (!(await PaymentMethod.countDocuments())) { await PaymentMethod.insertMany(methods); console.log('✅ تم إدراج طرق الدفع'); }
  await SiteSettings.findOneAndUpdate({ key: 'site' }, {}, { upsert: true });
  console.log('✅ إعدادات الموقع جاهزة');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
