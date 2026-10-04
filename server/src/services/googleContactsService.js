/* ═══ v73 — خدمة جهات اتصال Google (People API) ═══
   حفظ عملاء DevStore تلقائياً في حساب Google ليظهروا في الهاتف وواتساب.
   تُفعَّل فقط عند اكتمال متغيرات البيئة الثلاثة؛ فشلها لا يوقف التسجيل أبداً. */
const { google } = require('googleapis');

const ENABLED = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
let service = null;
if (ENABLED) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  service = google.people({ version: 'v1', auth: oauth2Client });
} else {
  console.warn('[Google Contacts] ⚠️ متغيرات GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN غير مكتملة — الخدمة معطلة (لا تأثير على المتجر)');
}

/* تنسيق الرقم بالصيغة الدولية المتوافقة مع واتساب (يمن: 967) */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[^0-9+]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('0')) cleaned = '+967' + cleaned.substring(1);
  else if (!cleaned.startsWith('+') && !cleaned.startsWith('967')) cleaned = '+967' + cleaned;
  else if (cleaned.startsWith('967')) cleaned = '+' + cleaned;
  return cleaned;
}

/* حفظ عميل فردي في جهات اتصال Google */
async function addContact(name, phone) {
  if (!ENABLED) return { success: false, message: 'الخدمة غير مهيأة' };
  try {
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone || !name) return { success: false, message: 'بيانات غير مكتملة' };
    const response = await service.people.createContact({
      requestBody: {
        names: [{ givenName: String(name).trim(), familyName: '[عميل DevStore]' }],
        phoneNumbers: [{ value: formattedPhone, type: 'mobile' }]
      }
    });
    console.log('[Google Contacts] ✅ تم الحفظ بنجاح: ' + name + ' (' + formattedPhone + ')');
    return { success: true, contactId: response.data.resourceName };
  } catch (error) {
    console.error('[Google Contacts Error] فشل حفظ ' + name + ':', (error.response && error.response.data) || error.message);
    return { success: false, error: error.message };
  }
}

/* مزامنة جميع العملاء الحاليين دفعة واحدة — مع تأخير 600ms لتفادي Rate Limiting */
async function syncAllExistingUsers(UserModel) {
  if (!ENABLED) return { success: false, error: 'الخدمة غير مهيأة — أضف متغيرات Google في .env' };
  try {
    const users = await UserModel.find({ phone: { $exists: true, $ne: '' } });
    console.log('[Sync Contacts] بدء مزامنة ' + users.length + ' عميل حالي...');
    let successCount = 0, failCount = 0;
    for (const user of users) {
      const phone = user.phone || user.customerPhone || '';
      const name = user.name || user.customerName || '';
      if (phone && name) {
        const r = await addContact(name, phone);
        if (r.success) successCount++; else failCount++;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
    console.log('[Sync Contacts] اكتملت المزامنة — نجح: ' + successCount + ' / فشل: ' + failCount);
    return { success: true, count: successCount, failed: failCount };
  } catch (error) {
    console.error('[Sync Contacts Error]:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { addContact, syncAllExistingUsers };
