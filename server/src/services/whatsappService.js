/* ═══ v54 — خدمة واتساب: رسائل مخصصة بالنوع + مبلغ مزدوج + OTP + إشعار الاكتمال ═══
   وحدة مستقلة آمنة الفشل: أي خطأ فيها لا يؤثر على السيرفر أو تليجرام. */
const path = require('path');
const fs = require('fs');

let sock = null;
let qrText = null;
let status = 'disconnected';
let starting = false;

const AUTH_DIR = path.join(process.cwd(), 'auth_info_baileys');

/* تنسيق الرقم إلى JID دولي: 77xxxxxxx → 9677xxxxxxx@s.whatsapp.net */
function formatPhoneToWhatsApp(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('7')) d = '967' + d;
  if (d.length === 8) d = '967' + d;
  return d ? d + '@s.whatsapp.net' : null;
}

/* v56: تنظيف الأرقام + مقارنة مرنة وآمنة بمطابقة آخر 9 أرقام (تتجاوز مفتاح الدولة والصفر البادئ) */
/* v57: استخراج الأرقام فقط — بالتسمية المطلوبة */
function getDigits(str) { return (str || '').toString().replace(/\D/g, ''); }
function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}
function isSamePhoneNumber(phone1, phone2) {
  const p1 = cleanPhone(phone1);
  const p2 = cleanPhone(phone2);
  if (!p1 || !p2) return false;
  if (p1 === p2) return true;
  const last9_1 = p1.slice(-9);
  const last9_2 = p2.slice(-9);
  return last9_1 === last9_2 && last9_1.length >= 8;
}

/* سطر الإجمالي المزدوج: $9.78 (ما يعادل: 5,280 YER) */
function totalLine(order) {
  const usd = (+order.total || 0).toFixed(2);
  if (order.currency && order.currency !== 'USD' && order.totalLocal > 0)
    return '💰 الإجمالي: ' + usd + '$ (ما يعادل: ' + Number(order.totalLocal).toLocaleString('en') + ' ' + order.currency + ')';
  return '💰 الإجمالي: ' + usd + '$';
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

    sock = makeWASocket({ version, auth: state, printQRInTerminal: false, logger: pino({ level: 'silent' }), browser: ['DevStore', 'Chrome', '1.0'] });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
      try {
        if (u.qr) { qrText = u.qr; status = 'qr'; console.log('📲 واتساب: امسح رمز QR من لوحة الأدمن ← «ربط واتساب المتجر»:'); qrcodeTerminal.generate(u.qr, { small: true }); }
        if (u.connection === 'open') { status = 'connected'; qrText = null; console.log('✅ واتساب المتجر متصل وجاهز'); }
        if (u.connection === 'close') {
          const code = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output ? u.lastDisconnect.error.output.statusCode : 0;
          status = 'disconnected'; sock = null; starting = false;
          if (code !== DisconnectReason.loggedOut) setTimeout(() => init().catch(() => {}), 5000);
          else console.warn('⚠️ واتساب: سُجّل الخروج — احذف مجلد auth_info_baileys وأعد المسح');
        }
      } catch (e) { console.warn('WA event error:', e.message); }
    });

    /* ═══ رد آلي: طلب رمز التحقق (OTP) + استفسار عن الطلب ═══ */
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;
          const jid = msg.key.remoteJid;
          if (!jid || jid.endsWith('@g.us')) continue;
          const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
          if (!body) continue;
          const senderDigits = jid.split('@')[0];

          /* — v57: طلب رمز التحقق — المنطق المضمون (معالجة @lid + آخر 9 أرقام + سجل تتبع) — */
          if (body.indexOf('رمز التحقق') !== -1 || body.indexOf('كود التحقق') !== -1 || body.indexOf('رمز التفعيل') !== -1) {
            /* 1) رقم المرسل الفعلي الحقيقي — معالجة حسابات واتساب الحديثة (@lid) */
            let senderJid = msg.key.remoteJid || '';
            if (senderJid.endsWith('@lid')) {
              senderJid = msg.key.participant || msg.participant || '';
            }
            const senderDigits = getDigits(senderJid.split('@')[0]);
            /* 2) الرقم المكتوب في نص الرسالة — Regex مرن يتحمل الأقواس والأسطر الجديدة */
            const matches = body.match(/(967\d{9}|\d{9})/g);
            /* إن لم يكتب رقماً في النص، نعتمد رقم مرسل الرسالة نفسه (يطابق ذاتياً) */
            const requestedDigits = matches ? getDigits(matches[0]) : senderDigits;
            /* 3) سجل تشخيصي: يُظهر الصيغة التي يستقبلها السيرفر بالضبط */
            console.log('[OTP Check] Actual Sender: ' + senderDigits + ' | Requested: ' + requestedDigits);
            /* 4) مقارنة آخر 9 أرقام حصراً — تتجاوز مفتاح الدولة 967 والأصفار البادئة */
            const senderLast9 = senderDigits.slice(-9);
            const requestedLast9 = requestedDigits.slice(-9);
            const isMatch = senderLast9 && requestedLast9 && (senderLast9 === requestedLast9);
            /* في حال عدم التطابق — وكان المرسل ليس معرف @lid مجهول — نرسل التحذير */
            if (!isMatch && !senderJid.endsWith('@lid')) {
              await sock.sendMessage(msg.key.remoteJid, { text:
                '⚠️ عذراً عزيزي العميل!\n' +
                'لا يمكن إرسال رمز التحقق؛ لأن رقم الواتساب الذي تراسلنا منه حالياً لا يتطابق مع رقم الحساب المطلوب في الموقع.\n\n' +
                '💡 يرجى إرسال الطلب مباشرة من نفس رقم هاتفك المربوط بحسابك في متجر DevStore.' });
              continue;
            }
            /* 5) التطابق تحقق ✅ — جلب الكود الفعّال للرقم وإرساله فوراً */
            const targetPhone = requestedDigits || senderDigits;
            const v9 = targetPhone.replace(/^967/, '');
            const { Otp } = require('../models');
            const otp = await Otp.findOne({
              delivered: { $ne: true },
              $or: [{ phone: targetPhone }, { phone: v9 }, { phone: new RegExp(v9 + '$') }],
            }).sort('-createdAt').lean();
            if (otp && otp.codePlain) {
              await Otp.updateOne({ _id: otp._id }, { $set: { delivered: true } });
              await sock.sendMessage(msg.key.remoteJid, { text:
                '🔑 رمز التحقق الخاص بك في متجر DevStore هو:\n\n*' + otp.codePlain + '*\n\n⏱️ صالح لمدة 5 دقائق. لا تشاركه مع أي شخص.' });
            } else {
              await sock.sendMessage(msg.key.remoteJid, { text:
                '⚠️ لا يوجد رمز تحقق فعّال لهذا الرقم حالياً.\nيرجى طلب رمز جديد من صفحة تسجيل الدخول في المتجر أولاً.' });
            }
            continue;
          }


          /* — استفسار عن حالة الطلب — */
          if (!/كود|رمز|تفعيل|طلب|حالة/i.test(body)) continue;
          const { Order } = require('../models');
          const v9s = senderDigits.replace(/^967/, '');
          const order = await Order.findOne({
            $or: [{ customerPhone: senderDigits }, { customerPhone: v9s }, { customerPhone: new RegExp(v9s + '$') }],
          }).sort('-createdAt').lean();
          if (!order) continue;
          await sock.sendMessage(jid, { text:
            'مرحباً بك في متجر DevStore 🌟\n\n' +
            '🔢 رقم طلبك: *' + order.code + '*\n' +
            '📦 الحالة الحالية: *' + order.status + '*\n' + totalLine(order) + '\n\n' +
            (order.status === 'مكتمل' ? '✅ طلبك مكتمل — تفاصيل التفعيل أُرسلت إليك.\n' : '⏳ طلبك قيد المعالجة — سنرسل التفاصيل فور اكتماله.\n') +
            'شكراً لتعاملك معنا! 🌟' });
        }
      } catch (e) { console.warn('WA auto-reply error:', e.message); }
    });
  } catch (e) {
    console.warn('⚠️ تعذّر تشغيل خدمة واتساب (المتجر يعمل طبيعياً بدونها):', e.message);
    sock = null; starting = false; status = 'disconnected';
  }
}

async function sendMessage(phone, text) {
  try {
    if (!sock || status !== 'connected') return false;
    const jid = formatPhoneToWhatsApp(phone);
    if (!jid) return false;
    await sock.sendMessage(jid, { text });
    return true;
  } catch (e) { console.warn('WA send error:', e.message); return false; }
}

/* تأكيد استلام الطلب — مخصص بحسب نوع المنتج (آيدي شحن أم كود تفعيل) */
async function sendOrderConfirmation(order) {
  try {
    const items = Array.isArray(order.items) ? order.items : [];
    const firstId = items.find(i => i.accountId && String(i.accountId).trim());
    let msg = 'مرحباً بك في متجر DevStore 🌟\n\n' +
      '✅ استلمنا طلبك بنجاح!\n' +
      '🔢 رقم الطلب: *' + order.code + '*\n' + totalLine(order) + '\n' +
      '📦 الحالة: قيد المراجعة\n\n';
    if (firstId) {
      msg += '🆔 الآيدي المسجل: *' + firstId.accountId + '*\n' +
        '🎮 سيتم شحن طلبك إلى هذا الآيدي فور تأكيده.\n\n';
    } else {
      msg += '🔑 سنرسل لك كود/رقم التفعيل فور تأكيد طلبك.\n\n';
    }
    msg += '💬 للاستعلام عن حالة طلبك أرسل كلمة «كود» في أي وقت.\nشكراً لتعاملك معنا! 🌟';
    return sendMessage(order.customerPhone, msg);
  } catch (e) { return false; }
}

/* إشعار العميل عند اكتمال الطلب */
async function sendOrderCompleted(order) {
  try {
    const items = Array.isArray(order.items) ? order.items : [];
    const productNames = items.map(i => i.name).join('، ') || 'طلبك';
    let msg = '🎉 مرحباً بك عزيزي العميل!\n' +
      'تم إكمال وتنفيذ طلبك بنجاح ✅\n\n' +
      '🔢 رقم الطلب: ' + order.code + '\n' +
      '📦 المنتج: ' + productNames + '\n' + totalLine(order) + '\n\n';
    const codeItem = items.find(i => i.accountId && /كود|code/i.test(String(i.extra || i.name || '')));
    if (codeItem) msg += '🔑 الكود: *' + codeItem.accountId + '*\n\n';
    msg += 'نتمنى لك تجربة ممتعة، ويسعدنا دائماً خدمتك! 🌟';
    return sendMessage(order.customerPhone, msg);
  } catch (e) { return false; }
}

async function getStatus() {
  let qrImage = null;
  if (qrText) { try { qrImage = await require('qrcode').toDataURL(qrText, { width: 280, margin: 1 }); } catch (e) {} }
  return { status, qrImage, connected: status === 'connected' };
}

module.exports = { init, sendMessage, sendOrderConfirmation, sendOrderCompleted, getStatus, formatPhoneToWhatsApp };
