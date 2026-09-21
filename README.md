# DevStore — متجر رقمي + منصة تعليمية (Full-Stack)

واجهة أمامية (HTML/CSS/JS) + خادم Node.js/Express + MongoDB + JWT + Cloudinary + Telegram Bot.

## التشغيل المحلي

```bash
npm install
cp .env.example .env   # ثم عبّئ القيم
npm run dev            # http://localhost:3000
node server/src/seed.js  # مرة واحدة: بيانات أولية (منتجات + طرق دفع)
```

- المتجر: `http://localhost:3000`
- لوحة الإدارة: `http://localhost:3000/admin.html` (ادخل بحساب ADMIN_PHONE / ADMIN_PASSWORD من ملف .env)

## إعداد الخدمات المجانية

### 1) MongoDB Atlas (قاعدة البيانات)
1. أنشئ حساباً على cloud.mongodb.com ← Build a Database ← **M0 Free**
2. Database Access ← أضف مستخدماً بكلمة مرور
3. Network Access ← أضف `0.0.0.0/0` (مطلوب لـ Render)
4. Connect ← Drivers ← انسخ الرابط وضعه في `MONGODB_URI`

### 2) Cloudinary (تخزين صور السندات)
1. أنشئ حساباً على cloudinary.com (الخطة المجانية: 25GB)
2. من Dashboard انسخ: Cloud Name / API Key / API Secret إلى `.env`

### 3) Telegram Bot (الإشعارات الفورية)
1. في تليجرام افتح `@BotFather` ← `/newbot` ← انسخ التوكن إلى `TELEGRAM_BOT_TOKEN`
2. أرسل أي رسالة لبوتك، ثم افتح: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. انسخ قيمة `chat.id` إلى `TELEGRAM_CHAT_ID`

## النشر على Render (مجاناً)

الواجهة والخادم **مدمجان في خدمة واحدة** (Express يقدّم مجلد `public`) — الأسهل والأنسب للخطة المجانية:

1. ارفع المشروع إلى GitHub
2. Render ← New ← **Web Service** ← اربط المستودع
3. Build Command: `npm install` — Start Command: `node server/src/index.js`
4. أضف Environment Variables من `.env.example` (كل القيم الحساسة تُضبط هنا، ولا ترفع `.env` أبداً)
5. بعد التشغيل نفّذ البذر مرة واحدة من Render Shell: `node server/src/seed.js`

بديل: ملف `render.yaml` المرفق ينشئ الخدمة تلقائياً عبر New ← Blueprint.

## الأمان والصلاحيات
- تسجيل دخول بهاتف + كلمة مرور مشفّرة (bcrypt) وجلسات JWT لمدة 30 يوماً
- دوران: `user` (تصفح وشراء) و`admin` (لوحة التحكم) — حساب الأدمن يُنشأ من متغيرات البيئة فقط
- لوحة الإدارة محمية من جهة الخادم (كل مسارات /api للأدمن تتحقق من الدور) ومن جهة الواجهة
- الإجمالي يُحسب من قاعدة البيانات وليس من المتصفح (منع التلاعب بالأسعار)
- صور السندات على Cloudinary ولا تستهلك مساحة Render
