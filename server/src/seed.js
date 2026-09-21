/* بيانات أولية — شغّله مرة واحدة: node server/src/seed.js */
require('dotenv').config();
const mongoose = require('mongoose');
const { Product, PaymentMethod, SiteSettings } = require('./models');

const products = [
  // 🎮 ألعاب (شحن يتطلب Player ID)
  { type: 'product', cat: 'games', icon: '🟥', name: 'شدات ببجي موبايل (UC)', desc: 'شحن فوري عبر ID — باقات 60 إلى 8100 شدة.', price: 1.20, unit: 'يبدأ من', requiresAccountId: true },
  { type: 'product', cat: 'games', icon: '💎', name: 'جواهر فري فاير', desc: 'شحن جواهر فوري وآمن عبر ID اللاعب.', price: 1.00, unit: 'يبدأ من', requiresAccountId: true },
  { type: 'product', cat: 'games', icon: '🎁', name: 'بطاقات جوجل بلاي', desc: 'بطاقات هدايا أمريكية وسعودية بفئات متعددة.', price: 5.00, unit: 'يبدأ من' },

  // 📱 تطبيقات (اشتراكات وبرامج)
  { type: 'product', cat: 'apps', icon: '👑', name: 'اشتراك شاهد VIP', desc: 'اشتراك شهري رسمي على حسابك أو حساب جديد.', price: 4.00, unit: 'شهرياً' },
  { type: 'product', cat: 'apps', icon: '📺', name: 'اشتراكات IPTV وتطبيقات المشاهدة', desc: 'ياسين TV وغيرها — تفعيل فوري.', price: 3.50, unit: 'يبدأ من' },
  { type: 'product', cat: 'apps', icon: '🤖', name: 'اشتراك ChatGPT Plus', desc: 'تفعيل رسمي لحسابك لمدة شهر.', price: 20.00, unit: 'شهرياً' },

  // 💬 أرقام وهمية
  { type: 'product', cat: 'numbers', icon: '📱', name: 'رقم وهمي — واتساب', desc: 'رقم جاهز لتفعيل واتساب مع كود التفعيل فوراً.', price: 1.50, countrySelect: true },
  { type: 'product', cat: 'numbers', icon: '✈️', name: 'رقم وهمي — تليجرام', desc: 'رقم موثوق لتفعيل تليجرام، ضمان استلام الكود.', price: 1.50, countrySelect: true },
  { type: 'product', cat: 'numbers', icon: '🌐', name: 'رقم وهمي — خدمات دولية', desc: 'تفعيل فيسبوك، تيك توك، Signal وأكثر من 50 خدمة.', price: 2.00, countrySelect: true },

  // 🛠️ أدوات المبرمجين والصيانة
  { type: 'product', cat: 'tools', icon: '🔧', name: 'SamFw Tool — أرصدة', desc: 'شحن كريدت SamFw لتخطي FRP وفتح الشبكات.', price: 2.50, unit: 'للرصيد الواحد' },
  { type: 'product', cat: 'tools', icon: '🧰', name: 'Chimera Tool — كريدت', desc: 'أرصدة وتفعيلات Chimera الأصلية بأفضل سعر.', price: 9.00, unit: 'يبدأ من' },
  { type: 'product', cat: 'tools', icon: '📡', name: 'DFS CDMA Tool — تفعيل', desc: 'تفعيل رسمي لبرمجة هواتف CDMA وضبط الشبكات.', price: 15.00, unit: 'سنوي' },

  // 🎓 خدمات وتدريب (تواصل مباشر — بدون سعر)
  { type: 'service', cat: 'courses', icon: '📲', name: 'تطوير تطبيقات الجوال — Flutter & Dart', desc: 'من الصفر حتى نشر تطبيقك على المتاجر: واجهات، إدارة حالة، ربط API.', modes: ['online', 'onsite'], meta: 'دورة تدريبية • 3 أشهر' },
  { type: 'service', cat: 'courses', icon: '📡', name: 'برمجة الهواتف وضبط الشبكات (CDMA / VoLTE)', desc: 'تفعيل أنظمة CDMA وخدمة VoLTE لشبكة يمن موبايل.', modes: ['onsite'], meta: 'دورة تدريبية • 6 أسابيع' },
  { type: 'service', cat: 'courses', icon: '💼', name: 'دليلك للعمل الحر — ملف IT Specialist على Upwork', desc: 'بناء بروفايل احترافي والفوز بأول عميل دولي.', modes: ['online', 'onsite'], meta: 'دورة تدريبية • 4 أسابيع' },
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
  if (!(await Product.countDocuments())) { await Product.insertMany(products); console.log('✅ تم إدراج المنتجات والخدمات'); }
  else console.log('ℹ️ المنتجات موجودة مسبقاً — احذف المجموعة لإعادة البذر');
  if (!(await PaymentMethod.countDocuments())) { await PaymentMethod.insertMany(methods); console.log('✅ تم إدراج طرق الدفع'); }
  await SiteSettings.findOneAndUpdate({ key: 'site' }, {}, { upsert: true });
  console.log('✅ إعدادات الموقع جاهزة');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
