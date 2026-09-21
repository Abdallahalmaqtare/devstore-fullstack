const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** رفع صورة (Buffer) إلى Cloudinary وإرجاع رابطها الآمن */
function uploadImage(buffer, folder = 'devstore/receipts') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

/** إرسال رسالة فورية إلى تليجرام عبر البوت */
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return console.warn('⚠️ إعدادات تليجرام غير مكتملة');
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await r.json();
    if (!data.ok) console.error('Telegram error:', data.description);
  } catch (e) {
    console.error('فشل إرسال إشعار تليجرام:', e.message);
  }
}

module.exports = { uploadImage, sendTelegram };
