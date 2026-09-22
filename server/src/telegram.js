/* ============================================================
   معالج بوت تليجرام — Deep Linking + Telegram Contact Verification
   التدفق الكامل:
   ① العميل يطلب OTP من المتجر ← الخادم ينشئ OTP + linkToken
   ② زر "✈️ استلام الكود عبر تليجرام" يفتح t.me/<BOT>?start=req_<TOKEN>
   ③ /start req_<TOKEN> ← التحقق من التوكن ثم طلب مشاركة جهة الاتصال
      (Reply Keyboard بخاصية request_contact)
   ④ message.contact ← التأكد أن contact.user_id === from.id (منع
      إعادة التوجيه) ثم مطابقة رقم تليجرام مع رقم الحساب المطلوب
   ⑤ تطابق ← إرسال كود الـ OTP فوراً / عدم تطابق ← رفض + تنبيه
   ============================================================ */
const express = require('express');
const router = express.Router();
const { Otp, User } = require('./models');
const { sendTelegram } = require('./utils/notify');

const OTP_TTL_MS = 10 * 60 * 1000;
const NL = '\n';

async function tgApi(method, payload) {
  try {
    const r = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) { console.error('tgApi ' + method + ':', e.message); return null; }
}

function send(chatId, text, extra) {
  return tgApi('sendMessage', Object.assign({ chat_id: chatId, text: text, parse_mode: 'HTML' }, extra || {}));
}

/* تطبيع رقم الهاتف: أرقام فقط + إزالة البادئة الدولية 00 */
function normPhone(p) {
  var d = String(p || '').replace(/\D/g, '');
  if (d.indexOf('00') === 0) d = d.slice(2);
  return d;
}

/* مطابقة متسامحة: تطابق كامل أو بآخر 9 أرقام (يتحمل اختلاف صيغة كود الدولة) */
function samePhone(a, b) {
  var x = normPhone(a), y = normPhone(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9);
}

const REMOVE_KB = { reply_markup: { remove_keyboard: true } };

router.post('/webhook', async (req, res) => {
  try {
    const msg = req.body && req.body.message;
    if (!msg || !msg.chat) return res.sendStatus(200);
    const chatId = msg.chat.id;

    /* ─── ④ استقبال جهة الاتصال (نتيجة ضغط زر مشاركة الرقم) ─── */
    if (msg.contact) {
      const otp = await Otp.findOne({ pendingChatId: String(chatId), delivered: { $ne: true } }).sort('-createdAt');

      if (!otp || (Date.now() - otp.createdAt.getTime()) > OTP_TTL_MS) {
        await send(chatId, '❌ لا يوجد طلب تحقق نشط أو انتهت صلاحيته (10 دقائق).' + NL + 'ارجع للمتجر واطلب رمزاً جديداً.', REMOVE_KB);
        return res.sendStatus(200);
      }

      /* منع إعادة توجيه رقم شخص آخر: جهة الاتصال يجب أن تكون للمُرسل نفسه */
      if (!msg.contact.user_id || String(msg.contact.user_id) !== String(msg.from && msg.from.id)) {
        await send(chatId, '⚠️ يجب مشاركة رقمك أنت عبر الزر المخصص — لا يمكن قبول رقم شخص آخر.', REMOVE_KB);
        return res.sendStatus(200);
      }

      /* مطابقة رقم تليجرام مع رقم الهاتف المسجل داخل التوكن (targetPhone) */
      if (!samePhone(msg.contact.phone_number, otp.phone)) {
        await send(chatId,
          '⚠️ <b>فشل التحقق من الهوية</b>' + NL + NL +
          'رقم حسابك على تليجرام لا يتطابق مع رقم الهاتف المطلوب لحساب المتجر (<code>' + otp.phone + '</code>).' + NL +
          'يرجى المراسلة من نفس الرقم أو التواصل مع الدعم.', REMOVE_KB);
        await sendTelegram('🚫 <b>محاولة استلام OTP مرفوضة</b>' + NL +
          '📱 الرقم المطلوب: <code>' + otp.phone + '</code>' + NL +
          '✈️ الوارد من تليجرام: <code>' + normPhone(msg.contact.phone_number) + '</code>');
        return res.sendStatus(200);
      }

      /* ✅ تطابق — تسليم الكود فوراً ومنع إعادة استخدام التوكن */
      otp.delivered = true;
      otp.pendingChatId = null;
      await otp.save();
      await User.findOneAndUpdate({ phone: otp.phone }, { telegramChatId: String(chatId) });

      await send(chatId,
        '🔐 رمز التحقق الخاص بك في DevStore هو:' + NL + NL + '<b>' + otp.codePlain + '</b>' + NL + NL +
        '⏱️ صالح لمدة 10 دقائق.' + NL + 'لا تشارك هذا الرمز مع أي شخص.', REMOVE_KB);

      const purposeAr = otp.purpose === 'register' ? 'إنشاء حساب' : 'استعادة كلمة مرور';
      await sendTelegram('✈️ استلم العميل (<code>' + otp.phone + '</code>) رمز ' + purposeAr + ' آلياً عبر البوت بعد التحقق من هويته ✅');
      return res.sendStatus(200);
    }

    if (!msg.text) return res.sendStatus(200);
    const text = String(msg.text).trim();

    /* ─── /start عادي بدون توكن ─── */
    if (text === '/start' || text === '/start verify') {
      await send(chatId,
        '👋 أهلاً بك في بوت <b>DevStore</b>!' + NL + NL +
        'لاستلام رمز التحقق: اطلبه من المتجر ثم اضغط زر «✈️ استلام الكود عبر تليجرام» — سيصلك الرمز هنا فوراً بعد تأكيد رقمك.');
      return res.sendStatus(200);
    }

    /* ─── ③ /start req_<TOKEN> (و otp_ للروابط الصادرة قبل التحديث) ─── */
    var token = null;
    if (text.indexOf('/start req_') === 0) token = text.slice('/start req_'.length).trim();
    else if (text.indexOf('/start otp_') === 0) token = text.slice('/start otp_'.length).trim();

    if (token) {
      const otp = await Otp.findOne({ linkToken: token }).sort('-createdAt');

      if (!otp || (Date.now() - otp.createdAt.getTime()) > OTP_TTL_MS) {
        await send(chatId, '❌ هذا الرابط غير صالح أو انتهت صلاحيته (10 دقائق).' + NL + 'ارجع للمتجر واطلب رمزاً جديداً.');
        return res.sendStatus(200);
      }
      if (otp.delivered) {
        await send(chatId, 'ℹ️ تم تسليم رمز هذا الطلب مسبقاً. إن لم يصلك، اطلب رمزاً جديداً من المتجر.');
        return res.sendStatus(200);
      }
      if (otp.purpose === 'reset' && !(await User.findOne({ phone: otp.phone }))) {
        await send(chatId, '❌ لا يوجد حساب مسجل بهذا الرقم في المتجر.');
        return res.sendStatus(200);
      }

      /* ربط الطلب بهذه المحادثة + طلب مشاركة جهة الاتصال للتحقق من الهوية */
      otp.pendingChatId = String(chatId);
      await otp.save();

      await send(chatId,
        '🔒 <b>خطوة أخيرة للتحقق من هويتك</b>' + NL + NL +
        'لحماية حسابك، اضغط الزر بالأسفل لمشاركة رقم هاتفك المسجل في تليجرام.' + NL +
        'سيصلك رمز التحقق فوراً إذا تطابق مع رقم حسابك في المتجر (<code>' + otp.phone + '</code>).',
        {
          reply_markup: {
            keyboard: [[{ text: '📲 تأكيد ومشاركة رقم هاتفي', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (e) {
    console.error('Telegram webhook error:', e.message);
    res.sendStatus(200); /* لا نعيد الخطأ لتليجرام لتجنب إعادة المحاولة المفرطة */
  }
});

/* تسجيل الـ Webhook عند إقلاع الخادم (يتطلب PUBLIC_URL) */
async function setupWebhook(baseUrl) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !baseUrl) return console.warn('⚠️ PUBLIC_URL أو TELEGRAM_BOT_TOKEN غير مضبوط — لن يعمل الرد الآلي');
  const url = baseUrl.replace(/\/$/, '') + '/api/telegram/webhook';
  try {
    const r = await fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, drop_pending_updates: true }),
    });
    const data = await r.json();
    console.log(data.ok ? '✅ Telegram Webhook مسجل: ' + url : '❌ setWebhook: ' + data.description);
  } catch (e) { console.error('❌ setWebhook:', e.message); }
}

module.exports = { router, setupWebhook };
