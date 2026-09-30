/* ═══ v53 — خدمة واتساب ويب المستقلة (Baileys) ═══
   تعمل كوحدة منفصلة: جلسة محفوظة في ./auth_info_baileys، QR لمرة واحدة،
   إرسال تأكيد الطلبات تلقائياً + رد آلي على استفسارات العملاء بالكود/الحالة.
   آمنة الفشل: أي خطأ فيها لا يؤثر على السيرفر أو تليجرام إطلاقاً. */
const path = require('path');
const fs = require('fs');

let sock = null;
let qrText = null;          /* آخر QR بانتظار المسح */
let status = 'disconnected';/* disconnected | qr | connected */
let starting = false;

const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');

/* تنسيق الرقم إلى JID دولي: 77xxxxxxx → 9677xxxxxxx@s.whatsapp.net */
function formatPhoneToWhatsApp(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('7')) d = '967' + d;   /* يمن افتراضياً */
  if (d.length === 8) d = '967' + d;
  return d ? d + '@s.whatsapp.net' : null;
}

async function init() {
  if (starting || sock) return;
  starting = true;
  try {
    const baileys = require('@whiskeysockets/baileys');
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
    const qrcodeTerminal = require('qrcode-terminal');
    const pino = require('pino');

    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['DevStore', 'Chrome', '1.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
      try {
        if (u.qr) {
          qrText = u.qr; status = 'qr';
          console.log('📲 واتساب: امسح رمز QR من لوحة الأدمن ← «ربط واتساب المتجر» (أو من الطرفية):');
          qrcodeTerminal.generate(u.qr, { small: true });
        }
        if (u.connection === 'open') {
          status = 'connected'; qrText = null;
          console.log('✅ واتساب المتجر متصل وجاهز لإرسال الأكواد');
        }
        if (u.connection === 'close') {
          const code = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output ? u.lastDisconnect.error.output.statusCode : 0;
          status = 'disconnected'; sock = null; starting = false;
          if (code !== DisconnectReason.loggedOut) setTimeout(() => init().catch(() => {}), 5000); /* إعادة اتصال تلقائية */
          else console.warn('⚠️ واتساب: سُجّل الخروج — احذف مجلد auth_info_baileys وأعد المسح');
        }
      } catch (e) { console.warn('WA event error:', e.message); }
    });

    /* رد آلي: العميل يسأل عن كوده/طلبه من نفس رقمه المسجل */
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;
          const jid = msg.key.remoteJid;
          if (!jid || jid.endsWith('@g.us')) continue;
          const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
          if (!text) continue;
          const senderDigits = jid.split('@')[0];
          const { Order } = require('../models');
          /* ابحث بأحدث طلب لهذا الرقم (بكل صيغه المحتملة) */
          const v9 = senderDigits.replace(/^967/, '');
          const order = await Order.findOne({
            $or: [{ customerPhone: senderDigits }, { customerPhone: v9 }, { customerPhone: new RegExp(v9 + '$') }],
          }).sort('-createdAt').lean();
          if (!order) continue;
          const wantsCode = /كود|رمز|تفعيل|طلب/i.test(text) || text.includes(order.code);
          if (!wantsCode) continue;
          await sock.sendMessage(jid, { text:
            'مرحباً بك في متجر DevStore 🌟\n\n' +
            '🔢 رقم طلبك: *' + order.code + '*\n' +
            '📦 الحالة الحالية: *' + order.status + '*\n' +
            '💰 الإجمالي: $' + order.total + '\n\n' +
            (order.status === 'مكتمل' ? '✅ طلبك مكتمل — تفاصيل التفعيل أُرسلت إليك.\n' : '⏳ طلبك قيد المعالجة — سنرسل كود التفعيل فور اكتماله.\n') +
            'شكراً لتعاملك معنا! 🌟' });
        }
      } catch (e) { console.warn('WA auto-reply error:', e.message); }
    });
  } catch (e) {
    console.warn('⚠️ تعذّر تشغيل خدمة واتساب (المتجر يعمل طبيعياً بدونها):', e.message);
    sock = null; starting = false; status = 'disconnected';
  }
}

/* إرسال رسالة نصية — آمنة الفشل (لا ترمي أخطاء للأعلى) */
async function sendMessage(phone, text) {
  try {
    if (!sock || status !== 'connected') return false;
    const jid = formatPhoneToWhatsApp(phone);
    if (!jid) return false;
    await sock.sendMessage(jid, { text });
    return true;
  } catch (e) { console.warn('WA send error:', e.message); return false; }
}

/* تأكيد الطلب تلقائياً على واتساب العميل */
async function sendOrderConfirmation(order) {
  return sendMessage(order.customerPhone,
    'مرحباً بك في متجر DevStore 🌟\n\n' +
    '✅ استلمنا طلبك بنجاح!\n' +
    '🔢 رقم الطلب: *' + order.code + '*\n' +
    '💰 الإجمالي: $' + order.total + '\n' +
    '📦 الحالة: قيد المراجعة\n\n' +
    'سنرسل لك كود التفعيل فور تأكيد طلبك.\n' +
    '💬 للاستعلام أرسل كلمة «كود» في أي وقت.\n\nشكراً لتعاملك معنا! 🌟');
}

/* حالة الاتصال + QR للوحة الأدمن */
async function getStatus() {
  let qrImage = null;
  if (qrText) {
    try { qrImage = await require('qrcode').toDataURL(qrText, { width: 280, margin: 1 }); } catch (e) {}
  }
  return { status, qrImage, connected: status === 'connected' };
}

module.exports = { init, sendMessage, sendOrderConfirmation, getStatus, formatPhoneToWhatsApp };
