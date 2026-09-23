/* v22: جلب أيقونات التطبيقات من Google Play + بديل UI-Avatars */
const gplay = require('google-play-scraper');

function avatarFallback(name) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(String(name || 'App')) + '&background=2563eb&color=fff&size=128';
}

/* يعيد رابط أيقونة التطبيق أو بديل UI-Avatars — لا يرمي أخطاء أبداً */
async function fetchPlayIcon(term) {
  try {
    const results = await gplay.search({ term: String(term || ''), num: 1, lang: 'ar', country: 'sa' });
    if (results && results.length && results[0].icon) return results[0].icon;
  } catch (e) { /* تجاهل — سنستخدم البديل */ }
  return null;
}

module.exports = { fetchPlayIcon, avatarFallback };
