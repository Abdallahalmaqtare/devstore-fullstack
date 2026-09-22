/* ============================================================
   معالج بوت تليجرام — Deep Linking & Auto-Reply
   - يستقبل تحديثات تليجرام عبر Webhook: POST /api/telegram/webhook
   - عند /start otp_<TOKEN> يرد فوراً برمز الـ OTP للعميل
   - يحفظ telegramChatId برقم هاتف العميل للإشعارات المستقبلية
   ============================================================ */
const express = require('express');
const router = express.Router();
const { Otp, User } = require('./models');
const { sendTelegram } = require('./utils/notify');

const OTP_TTL_MS = 10 * 60 * 1000;

async function tgReply(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  try {
    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('tgReply:', e.message); }
}

router.post('/webhook', async (req, res) => {
  try {
    const msg = req.body && req.body.message;
    if (!msg || !msg.text || !msg.chat) return res.sendStatus(200);

    const text = String(msg.text).trim();
    const chatId = msg.chat.id;
    const NL = '\n';

    /* /start عادي بدون رمز ربط */
    if (text === '/start' || text === '/start verify') {
      await tgReply(chatId,
        '👋 أهلاً بك في بوت <b>DevStore</b>!' + NL + NL +
        'لاستلام رمز التحقق، ارجع للمتجر واطلب الرمز ثم اضغط زر "استلام الكود عبر تليجرام ✈️" — سيصلك الرمز هنا فوراً وتلقائياً.');
      return res.sendStatus(200);
    }

    /* /start otp_<TOKEN> — مطابقة الرمز وتسليمه */
    if (text.indexOf('/start otp_') === 0) {
      const token = text.slice('/start otp_'.length).trim();
      const otp = await Otp.findOne({ linkToken: token }).sort('-createdAt');

      if (!otp || (Date.now() - otp.createdAt.getTime()) > OTP_TTL_MS) {
        await tgReply(chatId, '❌ هذا الرابط غير صالح أو انتهت صلاحيته (10 دقائق).' + NL + 'ارجع للمتجر واطلب رمزاً جديداً.');
        return res.sendStatus(200);
      }

      await tgReply(chatId,
        '🔐 رمز التحقق الخاص بك في DevStore هو:' + NL + NL + '<b>' + otp.codePlain + '</b>' + NL + NL +
        '⏱️ صالح لمدة 10 دقائق. لا تشارك هذا الرمز مع أي شخص.');

      /* ربط محادثة العميل برقم هاتفه لإشعارات مستقبلية */
      await User.findOneAndUpdate({ phone: otp.phone }, { telegramChatId: String(chatId) });

      /* نسخة احتياطية للإدارة: تأكيد التسليم الآلي */
      const purposeAr = otp.purpose === 'register' ? 'إنشاء حساب' : 'استعادة كلمة مرور';
      await sendTelegram('✈️ استلم العميل (' + otp.phone + ') رمز ' + purposeAr + ' آلياً عبر البوت.');
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
