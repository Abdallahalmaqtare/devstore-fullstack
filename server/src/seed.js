/* بيانات أولية — شغّله مرة واحدة: node server/src/seed.js */
require('dotenv').config();
const mongoose = require('mongoose');
const { Product, PaymentMethod } = require('./models');

const products = [
  { cat: 'games', icon: '🟥', name: 'شدات ببجي موبايل (UC)', desc: 'شحن فوري عبر ID — باقات 60 إلى 8100 شدة.', price: 1.20, unit: 'يبدأ من' },
  { cat: 'games', icon: '💎', name: 'ألماس فري فاير', desc: 'شحن ألماس فوري وآمن عبر ID اللاعب.', price: 1.00, unit: 'يبدأ من' },
  { cat: 'games', icon: '🎁', name: 'بطاقات جوجل بلاي', desc: 'بطاقات هدايا أمريكية وسعودية بفئات متعددة.', price: 5.00, unit: 'يبدأ من' },
  { cat: 'numbers', icon: '📱', name: 'رقم وهمي — واتساب', desc: 'رقم جاهز لتفعيل واتساب مع كود التفعيل فوراً.', price: 1.50, countrySelect: true },
  { cat: 'numbers', icon: '✈️', name: 'رقم وهمي — تليجرام', desc: 'رقم موثوق لتفعيل تليجرام، ضمان استلام الكود.', price: 1.50, countrySelect: true },
  { cat: 'tools', icon: '🔧', name: 'SamFw Tool — أرصدة', desc: 'شحن كريدت SamFw لتخطي FRP وفتح الشبكات.', price: 2.50, unit: 'للرصيد الواحد' },
  { cat: 'tools', icon: '🧰', name: 'Chimera Tool — كريدت', desc: 'أرصدة وتفعيلات Chimera الأصلية بأفضل سعر.', price: 9.00, unit: 'يبدأ من' },
  { cat: 'tools', icon: '📡', name: 'DFS CDMA Tool — تفعيل', desc: 'تفعيل رسمي لبرمجة هواتف CDMA وضبط الشبكات.', price: 15.00, unit: 'سنوي' },
  { cat: 'courses', icon: '📲', name: 'تطوير تطبيقات الجوال — Flutter & Dart', desc: 'من الصفر حتى نشر تطبيقك على المتاجر.', price: 60, modes: ['online', 'onsite'], meta: '3 أشهر • مبتدئ → محترف' },
  { cat: 'courses', icon: '📡', name: 'برمجة الهواتف وضبط الشبكات (CDMA / VoLTE)', desc: 'تفعيل أنظمة CDMA وخدمة VoLTE لشبكة يمن موبايل.', price: 45, modes: ['onsite'], meta: '6 أسابيع • متوسط' },
  { cat: 'courses', icon: '💼', name: 'دليلك للعمل الحر — ملف IT Specialist على Upwork', desc: 'بناء بروفايل احترافي والفوز بأول عميل دولي.', price: 30, modes: ['online', 'onsite'], meta: '4 أسابيع • جميع المستويات' },
];

const methods = [
  { name: 'الكريمي جوال', account: '77XXXXXXX', instructions: 'حوّل باسم: DevStore' },
  { name: 'النجم / محفظة النجم', account: '73XXXXXXX', instructions: '' },
  { name: 'USDT (TRC20)', account: 'TXxxxxxxxxxxxxxxxxxxx', instructions: 'شبكة TRON فقط' },
];

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  if (!(await Product.countDocuments())) { await Product.insertMany(products); console.log('✅ تم إدراج المنتجات'); }
  if (!(await PaymentMethod.countDocuments())) { await PaymentMethod.insertMany(methods); console.log('✅ تم إدراج طرق الدفع'); }
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
