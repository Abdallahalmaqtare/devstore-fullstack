
/* v12: السعر الفعلي بعد الخصم */
function effPrice(p) {
  return (p && p.isOnSale && p.discountPercent > 0)
    ? +(p.price - p.price * p.discountPercent / 100).toFixed(2)
    : (p ? p.price : 0);
}
/* ============================================================
   DevStore — الواجهة العامة (v6): مجموعات وباقات + توجيه مباشر
   ============================================================ */

var PRODUCTS = [], COURSES = [], PAY_METHODS = [], SITE = {};
var CATEGORIES = [], CURRENCIES = [];
var currentCurrency = localStorage.getItem('ds-currency') || 'USD';

/* رموز الاتصال الدولية لمحدد الهاتف */
var DIALS = [
  ['967', '🇾🇪 اليمن'], ['966', '🇸🇦 السعودية'], ['971', '🇦🇪 الإمارات'],
  ['20', '🇪🇬 مصر'], ['964', '🇮🇶 العراق'], ['965', '🇰🇼 الكويت'],
  ['974', '🇶🇦 قطر'], ['973', '🇧🇭 البحرين'], ['968', '🇴🇲 عُمان'],
  ['962', '🇯🇴 الأردن'], ['963', '🇸🇾 سوريا'], ['218', '🇱🇾 ليبيا'],
  ['216', '🇹🇳 تونس'], ['213', '🇩🇿 الجزائر'], ['212', '🇲🇦 المغرب'],
  ['249', '🇸🇩 السودان'], ['90', '🇹🇷 تركيا'], ['92', '🇵🇰 باكستان'],
  ['91', '🇮🇳 الهند'], ['1', '🇺🇸 أمريكا'], ['44', '🇬🇧 بريطانيا'],
];

/* ربط كل محدد رمز دولة بحقله + القيمة الافتراضية 967 */
function initDialPickers() {
  ['loginDial', 'regDial', 'forgotDial'].forEach(function (id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = DIALS.map(function (d) {
      return '<option value="' + d[0] + '"' + (d[0] === '967' ? ' selected' : '') + '>' + d[1] + ' +' + d[0] + '</option>';
    }).join('');
  });
}

/* دمج رمز الدولة مع الرقم المحلي: إزالة الصفر الأول ثم الدمج — ناتج صافٍ بلا + ولا مسافات */
function fullPhone(dialId, phoneId) {
  var dial = document.getElementById(dialId) ? document.getElementById(dialId).value : '967';
  var local = normalizePhone(document.getElementById(phoneId).value).replace(/^0+/, '');
  return dial + local;
}

/* تنسيق السعر المزدوج: $2 / 1080 YER */
function cur() { return CURRENCIES.find(function (c) { return c.code === currentCurrency; }) || null; }
function fmtPrice(usd) {
  var c = cur();
  var base = '$' + (+usd).toFixed(2);
  if (!c || c.code === 'USD') return base;
  return base + ' <small class="local-price">/ ' + Math.round(usd * c.rate).toLocaleString('en') + ' ' + c.code + '</small>';
}
var cart = JSON.parse(localStorage.getItem('ds-cart') || '[]');
var selectedPmId = '';
var currentFilter = 'all';
var searchQuery = '';

var COUNTRIES = [
  ['🇺🇸', 'أمريكا (+1)'], ['🇬🇧', 'بريطانيا (+44)'], ['🇷🇺', 'روسيا (+7)'],
  ['🇮🇳', 'الهند (+91)'], ['🇮🇩', 'إندونيسيا (+62)'], ['🇵🇰', 'باكستان (+92)'],
  ['🇪🇬', 'مصر (+20)'], ['🇸🇦', 'السعودية (+966)'], ['🇦🇪', 'الإمارات (+971)'],
];
var CAT_LABELS = {
  games: '🎮 ألعاب', apps: '📱 تطبيقات', numbers: '💬 أرقام وهمية',
  tools: '🛠️ أدوات وصيانة', courses: '🎓 خدمات وتدريب',
};

/* عرض صورة المنتج إن وُجدت، وإلا الإيموجي */
function iconHtml(p) {
  return p.image ? '<img class="p-img" src="' + p.image + '" alt="' + p.name + '" loading="lazy" />' : (p.icon || '📦');
}

/* ---------------- تحميل البيانات ---------------- */
async function loadAll() {
  try {
    var res = await Promise.all([
      API.req('/products'),
      API.req('/settings/payment-methods'),
      API.req('/settings/site'),
      API.req('/categories'),
      API.req('/currencies'),
    ]);
    var items = res[0]; PAY_METHODS = res[1]; SITE = res[2] || {};
    CATEGORIES = res[3] || []; CURRENCIES = res[4] || [];
    var serviceSlugs = CATEGORIES.filter(function (c) { return c.kind === 'services'; }).map(function (c) { return c.slug; });
    var shopSlugs = CATEGORIES.filter(function (c) { return c.kind === 'shop'; }).map(function (c) { return c.slug; });
    PRODUCTS = items.filter(function (p) { return serviceSlugs.indexOf(p.cat) === -1; });
    COURSES = items.filter(function (p) { return serviceSlugs.indexOf(p.cat) !== -1 || (!serviceSlugs.length && p.cat === 'courses'); });
    renderFilters(shopSlugs);
    renderCurrencySelect();
    renderProducts();
    renderCourses();
    renderPayMethods();
    renderContact();
  } catch (e) { showToast('⚠️ تعذر الاتصال بالخادم: ' + e.message); }
}

function renderContact() {
  var wa = normalizePhone(SITE.whatsapp);
  var tg = (SITE.telegram || '').replace(/^@/, '');
  document.getElementById('waLink').href = wa ? 'https://wa.me/' + wa : '#';
  document.getElementById('tgLink').href = tg ? 'https://t.me/' + tg : '#';
  if (SITE.email) document.getElementById('footEmail').textContent = '📧 ' + SITE.email;
}

/* ---------------- ثيم + قائمة الجوال ---------------- */
document.getElementById('themeToggle').addEventListener('click', function () {
  var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('tg-theme', next);
});
var navLinks = document.getElementById('navLinks');
document.getElementById('menuBtn').addEventListener('click', function () { navLinks.classList.toggle('open'); });
navLinks.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { navLinks.classList.remove('open'); }); });

/* ---------------- المتجر: مجموعات وباقات + بحث ---------------- */
function renderProducts() {
  var list = PRODUCTS;
  if (currentFilter !== 'all') list = list.filter(function (p) { return p.cat === currentFilter; });
  if (searchQuery) {
    var q = searchQuery.toLowerCase();
    list = list.filter(function (p) {
      var hay = (p.name + ' ' + (p.desc || '') + ' ' + (p.variants || []).map(function (v) { return v.name; }).join(' ')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }
  document.getElementById('productsGrid').innerHTML = list.length ? list.map(function (p) {
    var isGroup = (p.variants || []).length > 0;
    var minPrice = isGroup ? Math.min.apply(null, p.variants.map(function (v) { return effPrice(v); })) : effPrice(p);
    var footer = isGroup
      ? '<div class="product-price">' + fmtPrice(minPrice) + ' <small>يبدأ من</small></div>' +
        '<button class="buy-btn group-btn" data-group="' + p._id + '">📦 عرض الباقات (' + p.variants.length + ')</button>'
      : '<div class="product-price">' + fmtPrice(effPrice(p)) + ' <small>' + (p.unit || '') + '</small></div>' +
        '<button class="buy-btn" data-buy="' + p._id + '">أضف للسلة 🛒</button>';
    var countrySel = p.countrySelect
      ? '<div class="product-extra"><select id="country-' + p._id + '"><option value="">اختر الدولة 🌍</option>' +
        COUNTRIES.map(function (c) { return '<option value="' + c[1] + '">' + c[0] + ' ' + c[1] + '</option>'; }).join('') +
        '</select></div>'
      : '';
    return '<article class="product-card' + (isGroup ? ' group-card' : '') + '"' + (isGroup ? ' data-group="' + p._id + '"' : '') + '>' +
      '<div class="product-icon">' + iconHtml(p) + '</div>' +
      '<span class="product-cat">' + (CAT_LABELS[p.cat] || '') + '</span>' +
      '<h3 class="product-name">' + p.name + '</h3>' +
      '<p class="product-desc">' + (p.desc || '') + '</p>' +
      countrySel +
      '<div class="product-footer">' + footer + '</div>' +
      '</article>';
  }).join('')
  : '<p class="cart-empty">لا توجد نتائج مطابقة لبحثك 🔍</p>';
}

/* بناء فلاتر المتجر من الأقسام الديناميكية */
function renderFilters(shopSlugs) {
  var wrap = document.getElementById('storeFilters');
  var cats = CATEGORIES.filter(function (c) { return shopSlugs.indexOf(c.slug) !== -1; });
  wrap.innerHTML = '<button class="filter-chip active" data-filter="all">الكل</button>' +
    cats.map(function (c) {
      return '<button class="filter-chip" data-filter="' + c.slug + '">' + (c.icon || '') + ' ' + c.nameAr + '</button>';
    }).join('');
}

/* محدد العملة في الشريط */
function renderCurrencySelect() {
  var sel = document.getElementById('currencySelect');
  if (!sel) return;
  if (!CURRENCIES.find(function (c) { return c.code === 'USD'; }))
    CURRENCIES.unshift({ code: 'USD', name: 'دولار أمريكي', flag: '🇺🇸', rate: 1 });
  sel.innerHTML = CURRENCIES.filter(function (c) { return c.active !== false; }).map(function (c) {
    return '<option value="' + c.code + '"' + (c.code === currentCurrency ? ' selected' : '') + '>' + c.flag + ' ' + c.code + '</option>';
  }).join('');
  sel.onchange = function () {
    currentCurrency = sel.value;
    localStorage.setItem('ds-currency', currentCurrency);
    renderProducts(); renderCart();
    showToast('💱 العملة: ' + currentCurrency);
  };
}

document.getElementById('storeFilters').addEventListener('click', function (e) {
  var chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
  chip.classList.add('active');
  currentFilter = chip.dataset.filter;
  renderProducts();
});
document.getElementById('storeSearch').addEventListener('input', function (e) {
  searchQuery = e.target.value.trim();
  renderProducts();
});

/* ---------------- نافذة باقات المجموعة ---------------- */
var groupModal = document.getElementById('groupModal');
var openGroupId = null;

function openGroupModal(id) {
  var g = PRODUCTS.find(function (p) { return p._id === id; });
  if (!g || !(g.variants || []).length) return;
  openGroupId = id;
  document.getElementById('groupIcon').innerHTML = iconHtml(g);
  document.getElementById('groupName').textContent = g.name;
  document.getElementById('groupDesc').textContent = (g.desc || '') + (g.requiresAccountId ? ' — 🆔 سيطلب معرّف الحساب في السلة' : '');
  document.getElementById('variantsList').innerHTML = g.variants.map(function (v, i) {
    return '<div class="variant-row">' +
      '<span class="variant-icon">' + (v.icon || g.icon || '🎁') + '</span>' +
      '<span class="variant-name">' + v.name + '</span>' +
      '<span class="variant-price">' +
        (v.isOnSale && v.discountPercent > 0
          ? '<span class="v-sale-badge">خصم ' + v.discountPercent + '%</span> <span class="price-old">' + fmtPrice(v.price) + '</span> <span class="price-new">' + fmtPrice(effPrice(v)) + '</span>'
          : fmtPrice(effPrice(v))) + '</span>' +
      '<button class="buy-btn" data-variant="' + i + '">أضف للسلة 🛒</button>' +
      '</div>';
  }).join('');
  groupModal.classList.add('open');
}
groupModal.addEventListener('click', function (e) {
  if (e.target === groupModal) groupModal.classList.remove('open');
  var vbtn = e.target.closest('[data-variant]');
  if (vbtn) addVariantToCart(parseInt(vbtn.dataset.variant, 10));
});
document.querySelector('[data-close="groupModal"]').addEventListener('click', function () { groupModal.classList.remove('open'); });

/* ---------------- الدورات والخدمات ---------------- */
function renderCourses() {
  document.getElementById('coursesGrid').innerHTML = COURSES.map(function (c) {
    return '<article class="course-card">' +
      '<div class="course-cover">' + iconHtml(c) + '</div>' +
      '<div class="course-body">' +
      '<h3 class="course-name">' + c.name + '</h3>' +
      '<p class="course-desc">' + (c.desc || '') + '</p>' +
      '<div class="course-modes">' +
      ((c.modes || []).indexOf('online') !== -1 ? '<span class="mode-badge mode-online">🌐 عن بُعد</span>' : '') +
      ((c.modes || []).indexOf('onsite') !== -1 ? '<span class="mode-badge mode-onsite">📍 حضوري — الحديدة</span>' : '') +
      '</div>' +
      '<div class="course-meta"><span>⏱️ ' + (c.meta || '') + '</span></div>' +
      '<div class="course-footer">' +
      '<div class="course-price course-inquiry">💬 تواصل للاتفاق</div>' +
      '<button class="buy-btn contact-btn" data-inquire="' + c._id + '">تواصل للاتفاق 📩</button>' +
      '</div></div></article>';
  }).join('');
}

/* ---------------- السلة ---------------- */
var cartPanel = document.getElementById('cartPanel');
var cartOverlay = document.getElementById('cartOverlay');
var cartItemsEl = document.getElementById('cartItems');
var cartBadge = document.getElementById('cartBadge');
var cartTotal = document.getElementById('cartTotal');
function saveCart() { localStorage.setItem('ds-cart', JSON.stringify(cart)); }
function getItemInfo(id) { return PRODUCTS.find(function (p) { return p._id === id; }); }

function addToCart(id) {
  var product = getItemInfo(id);
  if (!product) return;
  var extra = '';
  if (product.countrySelect) {
    var sel = document.getElementById('country-' + id);
    if (!sel || !sel.value) { showToast('⚠️ اختر الدولة أولاً'); if (sel) sel.focus(); return; }
    extra = sel.value;
  }
  pushItem({
    id: id, variant: '', extra: extra,
    name: product.name, price: product.price, icon: product.icon,
    image: product.image || '',
    requiresAccountId: !!product.requiresAccountId,
  });
}

function addVariantToCart(idx) {
  var g = PRODUCTS.find(function (p) { return p._id === openGroupId; });
  if (!g || !g.variants[idx]) return;
  var v = g.variants[idx];
  pushItem({
    id: g._id, variant: v.name, extra: '',
    name: g.name + ' — ' + v.name, price: effPrice(v),
    icon: v.icon || g.icon, image: g.image || '',
    requiresAccountId: !!g.requiresAccountId,
  });
  groupModal.classList.remove('open');
}

function pushItem(item) {
  var key = [item.id, item.variant, item.extra].filter(Boolean).join('|');
  var found = cart.find(function (i) { return i.key === key; });
  if (found) found.qty++;
  else { item.key = key; item.accountId = ''; item.qty = 1; cart.push(item); }
  saveCart(); renderCart();
  showToast('✅ تمت الإضافة: ' + item.name);
}

function renderCart() {
  cartBadge.textContent = cart.reduce(function (s, i) { return s + i.qty; }, 0);
  if (!cart.length) {
    cartItemsEl.innerHTML = '<p class="cart-empty">سلتك فارغة حالياً.. تصفح المتجر وأضف ما يعجبك 🛍️</p>';
    cartTotal.textContent = '$0.00'; return;
  }
  cartItemsEl.innerHTML = cart.map(function (i) {
    var acct = i.requiresAccountId
      ? '<input type="text" class="cart-acct" data-acct="' + i.key + '" value="' + (i.accountId || '') + '" dir="ltr" placeholder="🆔 معرّف الحساب / Player ID (إلزامي)" />'
      : '';
    return '<div class="cart-item">' +
      '<span class="cart-item-icon">' + (i.image ? '<img class="p-img" src="' + i.image + '" alt="" />' : i.icon) + '</span>' +
      '<div class="cart-item-info"><b>' + i.name + '</b><span>' + (i.extra ? i.extra + ' • ' : '') + fmtPrice(i.price) + '</span>' + acct + '</div>' +
      '<div class="cart-item-actions">' +
      '<button class="qty-btn" data-dec="' + i.key + '">−</button><b>' + i.qty + '</b>' +
      '<button class="qty-btn" data-inc="' + i.key + '">+</button>' +
      '<button class="remove-btn" data-remove="' + i.key + '">🗑️</button>' +
      '</div></div>';
  }).join('');
  var totalUsd = cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  cartTotal.innerHTML = fmtPrice(totalUsd);
}
renderCart();

cartItemsEl.addEventListener('input', function (e) {
  var inp = e.target.closest('[data-acct]');
  if (!inp) return;
  var item = cart.find(function (i) { return i.key === inp.dataset.acct; });
  if (item) { item.accountId = inp.value.trim(); saveCart(); }
});

document.body.addEventListener('click', function (e) {
  var grp = e.target.closest('[data-group]');
  if (grp && !e.target.closest('[data-buy]')) return openGroupModal(grp.dataset.group);

  var buy = e.target.closest('[data-buy]');
  if (buy) return addToCart(buy.dataset.buy);
  var inq = e.target.closest('[data-inquire]');
  if (inq) return openInquiry(inq.dataset.inquire);

  var inc = e.target.closest('[data-inc]');
  if (inc) { cart.find(function (i) { return i.key === inc.dataset.inc; }).qty++; saveCart(); renderCart(); return; }
  var dec = e.target.closest('[data-dec]');
  if (dec) {
    var it = cart.find(function (i) { return i.key === dec.dataset.dec; });
    if (--it.qty <= 0) cart = cart.filter(function (i) { return i.key !== it.key; });
    saveCart(); renderCart(); return;
  }
  var rem = e.target.closest('[data-remove]');
  if (rem) { cart = cart.filter(function (i) { return i.key !== rem.dataset.remove; }); saveCart(); renderCart(); }
});

function openCart() { cartPanel.classList.add('open'); cartOverlay.classList.add('open'); }
function closeCart() { cartPanel.classList.remove('open'); cartOverlay.classList.remove('open'); }
document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('cartClose').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

/* ---------------- طرق الدفع ---------------- */
function renderPayMethods() {
  var grid = document.getElementById('payGrid');
  if (!PAY_METHODS.length) { grid.innerHTML = '<p class="cart-empty">لا توجد طرق دفع مفعّلة</p>'; return; }
  grid.innerHTML = PAY_METHODS.map(function (pm) {
    return '<button class="pay-btn" data-pm="' + pm._id + '">💳 ' + pm.name + '</button>';
  }).join('');
}
document.getElementById('payGrid').addEventListener('click', function (e) {
  var btn = e.target.closest('[data-pm]');
  if (!btn) return;
  document.querySelectorAll('.pay-btn').forEach(function (b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
  selectedPmId = btn.dataset.pm;
  var pm = PAY_METHODS.find(function (p) { return p._id === selectedPmId; });
  document.getElementById('payAccount').innerHTML =
    '📲 حوّل المبلغ إلى: <b>' + pm.account + '</b>' + (pm.instructions ? '<br>📝 ' + pm.instructions : '') + '<br>ثم ارفع صورة السند 👇';
});

/* ---------------- إتمام الطلب ---------------- */
document.getElementById('checkoutBtn').addEventListener('click', async function () {
  if (!cart.length) return showToast('⚠️ السلة فارغة');
  var missing = cart.find(function (i) { return i.requiresAccountId && !i.accountId; });
  if (missing) {
    var inp = cartItemsEl.querySelector('[data-acct="' + missing.key + '"]');
    showToast('⚠️ أدخل معرّف الحساب لـ «' + missing.name + '»');
    if (inp) inp.focus();
    return;
  }
  if (!API.user()) { closeCart(); openAuth('login'); return showToast('⚠️ سجّل الدخول أولاً'); }
  if (!selectedPmId) return showToast('⚠️ اختر طريقة الدفع');
  var receipt = document.getElementById('receiptInput').files[0];
  if (!receipt) return showToast('⚠️ صورة سند الحوالة مطلوبة 📎');

  var btn = document.getElementById('checkoutBtn');
  btn.disabled = true; btn.textContent = '⏳ جارٍ الإرسال...';
  try {
    var form = new FormData();
    form.append('items', JSON.stringify(cart.map(function (i) {
      return { id: i.id, variant: i.variant || '', qty: i.qty, extra: i.extra, accountId: i.accountId };
    })));
    form.append('paymentMethodId', selectedPmId);
    form.append('receipt', receipt);
    var res = await API.req('/orders', { method: 'POST', form: form });
    cart = []; saveCart(); renderCart();
    document.getElementById('receiptInput').value = '';
    closeCart();
    showToast('🎉 تم إرسال طلبك ' + res.code + ' — قيد المراجعة');
  } catch (e) { showToast('❌ ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'تأكيد الطلب ✅'; }
});

/* ================================================================ */
/* ============================ المصادقة ============================ */
/* ================================================================ */
var authModal = document.getElementById('authModal');
var authForms = { login: 'loginForm', register: 'registerForm', forgot: 'forgotForm', otp: 'otpForm', reset: 'resetForm' };

function openAuth(which) { authModal.classList.add('open'); showAuthForm(which || 'login'); }
function showAuthForm(which) {
  document.querySelectorAll('.auth-form').forEach(function (f) { f.classList.remove('active'); });
  document.getElementById(authForms[which]).classList.add('active');
  document.querySelectorAll('#authTabs .auth-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === which); });
}

document.getElementById('loginBtn').addEventListener('click', function () {
  if (API.user()) openProfile(); else openAuth('login');
});
authModal.addEventListener('click', function (e) { if (e.target === authModal) authModal.classList.remove('open'); });
document.querySelector('[data-close="authModal"]').addEventListener('click', function () { authModal.classList.remove('open'); });
document.getElementById('authTabs').addEventListener('click', function (e) {
  var tab = e.target.closest('.auth-tab');
  if (tab) showAuthForm(tab.dataset.tab);
});
document.querySelectorAll('[data-goto]').forEach(function (el) {
  el.addEventListener('click', function (e) { e.preventDefault(); showAuthForm(el.dataset.goto); });
});
document.getElementById('forgotLink').addEventListener('click', function (e) { e.preventDefault(); showAuthForm('forgot'); });

/* --- OTP --- */
var otpState = { purpose: '', phone: '', payload: null, timer: null };
var otpInputs = document.querySelectorAll('#otpInputs input');
otpInputs.forEach(function (inp, idx) {
  inp.addEventListener('input', function () {
    inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
    if (inp.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    document.getElementById('otpCode').value = Array.prototype.map.call(otpInputs, function (i) { return i.value; }).join('');
  });
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !inp.value && idx > 0) otpInputs[idx - 1].focus();
  });
  inp.addEventListener('paste', function (e) {
    var t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    if (!t) return;
    e.preventDefault();
    t.split('').forEach(function (ch, i) { if (otpInputs[i]) otpInputs[i].value = ch; });
    document.getElementById('otpCode').value = t;
    otpInputs[Math.min(t.length, 5)].focus();
  });
});

function startOtpTimer(sec) {
  var t = document.getElementById('otpTimer'), r = document.getElementById('otpResend');
  r.classList.add('hidden'); t.classList.remove('hidden');
  clearInterval(otpState.timer);
  var s = sec || 60;
  function tick() {
    t.innerHTML = 'إعادة الإرسال متاحة بعد <b>' + s + '</b> ثانية';
    if (--s < 0) { clearInterval(otpState.timer); t.classList.add('hidden'); r.classList.remove('hidden'); }
  }
  tick(); otpState.timer = setInterval(tick, 1000);
}

/* التسليم الآلي للكود يتم عبر Webhook البوت (server-side) — الواجهة تعرض الرابط فقط */
async function requestOtp(purpose, phone, payload) {
  otpState = { purpose: purpose, phone: phone, payload: payload || null, timer: null };
  try {
    var body = { phone: phone, purpose: purpose };
    if (payload) { body.name = payload.name; body.password = payload.password; }
    var res = await API.req('/auth/send-otp', { method: 'POST', body: body });
    document.getElementById('otpHint').innerHTML =
      'أُرسل رمز مكوّن من 6 أرقام للرقم <b dir="ltr">' + phone + '</b><br>صالح 10 دقائق';
    document.getElementById('otpWaLink').href = res.whatsappUrl || '#';
    var tgLink = document.getElementById('otpTgLink');
    tgLink.classList.remove('hidden');
    if (res.telegramBotUrl) {
      tgLink.href = res.telegramBotUrl;
      tgLink.onclick = function () {
        showToast('✈️ اضغط Start ثم زر «📲 تأكيد ومشاركة رقم هاتفي» وسيصلك الرمز فوراً');
      };
    } else {
      tgLink.href = '#';
      tgLink.onclick = function (e) {
        e.preventDefault();
        showToast('⚠️ بوت تليجرام غير مُفعّل حالياً — استخدم زر واتساب بالأسفل');
      };
    }
    otpInputs.forEach(function (i) { i.value = ''; });
    document.getElementById('otpCode').value = '';
    showAuthForm('otp'); otpInputs[0].focus(); startOtpTimer(60);
  } catch (e) { showToast('❌ ' + e.message); }
}

document.getElementById('otpResend').addEventListener('click', function (e) {
  e.preventDefault();
  requestOtp(otpState.purpose, otpState.phone, otpState.payload);
});

document.getElementById('registerForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = document.getElementById('regName').value.trim();
  var phone = fullPhone('regDial', 'regPhone');
  var password = document.getElementById('regPass').value;
  if (!name || phone.length < 9 || password.length < 6)
    return showToast('⚠️ تحقق من البيانات — الهاتف بالصيغة الدولية بدون +');
  requestOtp('register', phone, { name: name, password: password });
});

document.getElementById('forgotForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var phone = fullPhone('forgotDial', 'forgotPhone');
  if (phone.length < 9) return showToast('⚠️ أدخل الرقم بالصيغة الدولية بدون +');
  requestOtp('reset', phone);
});

document.getElementById('otpForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var code = document.getElementById('otpCode').value;
  if (code.length !== 6) return showToast('⚠️ أدخل الأرقام الستة');
  try {
    if (otpState.purpose === 'register') {
      var r = await API.req('/auth/verify-otp', {
        method: 'POST', body: { phone: otpState.phone, code: code, purpose: 'register' },
      });
      API.setSession(r.token, r.user, true); authModal.classList.remove('open');
      updateUserChip();
      showToast('🎉 أهلاً ' + r.user.name + ' — تم تفعيل حسابك');
    } else {
      await API.req('/auth/verify-otp', {
        method: 'POST', body: { phone: otpState.phone, code: code, purpose: 'reset' },
      });
      showAuthForm('reset');
    }
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('resetForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var p1 = document.getElementById('resetPass').value;
  var p2 = document.getElementById('resetPass2').value;
  if (p1 !== p2) return showToast('⚠️ كلمتا المرور غير متطابقتين');
  try {
    var r = await API.req('/auth/reset-password', {
      method: 'POST',
      body: { phone: otpState.phone, code: document.getElementById('otpCode').value, password: p1 },
    });
    API.setSession(r.token, r.user, true); authModal.classList.remove('open');
    updateUserChip();
    showToast('✅ تم تحديث كلمة المرور وتسجيل الدخول');
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var phone = fullPhone('loginDial', 'loginPhone');
  var remember = document.getElementById('rememberMe').checked;
  if (phone.length < 9) return showToast('⚠️ أدخل الرقم بالصيغة الدولية بدون +');
  try {
    var r = await API.req('/auth/login', {
      method: 'POST',
      body: { phone: phone, password: document.getElementById('loginPass').value, remember: remember },
    });
    API.setSession(r.token, r.user, remember);
    authModal.classList.remove('open');
    updateUserChip();
    showToast(r.user.role === 'admin' ? '⚙️ أهلاً بالمدير — اللوحة من admin.html' : '👋 أهلاً ' + r.user.name);
  } catch (err) { showToast('❌ ' + err.message); }
});

function updateUserChip() {
  var u = API.user();
  var chip = document.getElementById('loginBtn');
  var name = document.getElementById('userChipName');
  var icon = document.getElementById('userChipIcon');
  if (u) {
    chip.classList.add('logged');
    name.textContent = u.name.split(' ')[0];
    icon.textContent = u.role === 'admin' ? '👑' : '👤';
  } else {
    chip.classList.remove('logged');
    name.textContent = ''; icon.textContent = '👤';
  }
}
updateUserChip();

/* ---------------- الملف الشخصي ---------------- */
var profileModal = document.getElementById('profileModal');
function openProfile() {
  var u = API.user();
  if (!u) return openAuth('login');
  document.getElementById('pfName').value = u.name;
  document.getElementById('pfPhone').value = u.phone;
  profileModal.classList.add('open');
  showPPage('info');
  loadMyOrders();
}
function showPPage(page) {
  document.querySelectorAll('#profileModal .auth-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.ptab === page); });
  document.querySelectorAll('.profile-form').forEach(function (f) { f.classList.toggle('active', f.dataset.ppage === page); });
}
profileModal.addEventListener('click', function (e) {
  if (e.target === profileModal) profileModal.classList.remove('open');
  var tab = e.target.closest('[data-ptab]');
  if (tab) showPPage(tab.dataset.ptab);
});
document.querySelector('[data-close="profileModal"]').addEventListener('click', function () { profileModal.classList.remove('open'); });

document.getElementById('profileInfoForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  try {
    var r = await API.req('/users/profile', {
      method: 'PUT',
      body: { name: document.getElementById('pfName').value, phone: normalizePhone(document.getElementById('pfPhone').value) },
    });
    API.setSession(API.token(), r.user, !!localStorage.getItem('ds-token'));
    updateUserChip();
    showToast('✅ تم تحديث البيانات');
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('profilePassForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var n1 = document.getElementById('pfNew').value;
  var n2 = document.getElementById('pfNew2').value;
  if (n1 !== n2) return showToast('⚠️ كلمتا المرور غير متطابقتين');
  try {
    await API.req('/users/change-password', {
      method: 'PUT', body: { current: document.getElementById('pfCur').value, next: n1 },
    });
    e.target.reset();
    showToast('✅ تم تحديث كلمة المرور');
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('logoutBtn').addEventListener('click', function () {
  API.clearSession(); profileModal.classList.remove('open');
  updateUserChip(); showToast('👋 تم تسجيل الخروج');
});

async function loadMyOrders() {
  var tbody = document.querySelector('#myOrdersTable tbody');
  var STATUS_CLASS = { 'قيد المراجعة': 'status-review', 'مكتمل': 'status-done', 'ملغي': 'status-cancel' };
  try {
    var orders = await API.req('/orders/my-orders');
    tbody.innerHTML = orders.length ? orders.map(function (o) {
      return '<tr><td><b>' + o.code + '</b></td>' +
        '<td>' + o.items.map(function (i) { return i.name + ' ×' + i.qty; }).join('، ') + '</td>' +
        '<td>' + new Date(o.createdAt).toLocaleDateString('ar') + '</td>' +
        '<td><span class="status-badge ' + STATUS_CLASS[o.status] + '">' + o.status + '</span></td></tr>';
    }).join('')
    : '<tr><td colspan="4" class="empty-row">لا توجد طلبات بعد</td></tr>';
  } catch (e2) { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">تعذر جلب الطلبات</td></tr>'; }
}

/* ================================================================ */
/* === تواصل للاتفاق — توجيه مباشر لمنسق الخدمة برسالة جاهزة ======= */
/* ================================================================ */
var inquireModal = document.getElementById('inquireModal');
var inqService = null;

inquireModal.addEventListener('click', function (e) { if (e.target === inquireModal) inquireModal.classList.remove('open'); });
document.querySelector('[data-close="inquireModal"]').addEventListener('click', function () { inquireModal.classList.remove('open'); });

function inqSelectedMode() {
  var r = document.querySelector('input[name="inqMode"]:checked');
  return r ? r.value : '';
}

function buildInquiryLinks() {
  if (!inqService) return;
  var u = API.user();
  var name = document.getElementById('inqName').value.trim() || (u && u.name) || 'زائر';
  var phone = normalizePhone(document.getElementById('inqPhone').value) || (u && u.phone) || '—';
  var category = (inqService.meta || '').split('•')[0].trim() || 'خدمة استشارية';
  var mode = inqSelectedMode();
  var modeAr = mode === 'onsite' ? 'حضوري في الحديدة' : mode === 'online' ? 'عن بُعد' : 'غير محدد';

  var text = encodeURIComponent(
    'مرحباً، أود الاستفسار والتسجيل في:\n' +
    '- الخدمة: ' + category + ' — ' + inqService.name + '\n' +
    '- نوع الحضور: ' + modeAr + '\n' +
    '- اسم العميل: ' + name + '\n' +
    '- رقم الهاتف: ' + phone
  );

  /* قناة منسق الخدمة أولاً، ثم الدعم العام */
  var wa = normalizePhone(inqService.contactWhatsapp) || normalizePhone(SITE.whatsapp);
  var tg = (inqService.contactTelegram || SITE.telegram || '').replace(/^@/, '');

  var waLink = document.getElementById('inqWa');
  var tgLink = document.getElementById('inqTg');
  if (wa) { waLink.href = 'https://wa.me/' + wa + '?text=' + text; waLink.classList.remove('btn-disabled'); }
  else waLink.removeAttribute('href');
  if (tg) { tgLink.href = 'https://t.me/' + tg; tgLink.classList.remove('btn-disabled'); }
  else tgLink.removeAttribute('href');

  document.getElementById('inqCategory').textContent = '🗂️ ' + category;
}

async function openInquiry(id) {
  inqService = COURSES.find(function (c) { return c._id === id; });
  if (!inqService) return;

  if (!SITE.whatsapp && !SITE.telegram) {
    try { SITE = await API.req('/settings/site'); } catch (e) { }
  }

  var u = API.user();
  document.getElementById('inqServiceName').textContent = inqService.name;
  document.getElementById('inqName').value = (u && u.name) || '';
  document.getElementById('inqPhone').value = (u && u.phone) || '';

  /* خيارات نوع الحضور حسب ما تدعمه الخدمة */
  var modes = inqService.modes && inqService.modes.length ? inqService.modes : ['online'];
  document.getElementById('inqModes').innerHTML = modes.map(function (m, i) {
    return '<label class="mode-option"><input type="radio" name="inqMode" value="' + m + '"' + (i === 0 ? ' checked' : '') + ' />' +
      (m === 'online' ? '🌐 عن بُعد' : '📍 حضوري — الحديدة') + '</label>';
  }).join('');
  document.querySelectorAll('input[name="inqMode"]').forEach(function (r) {
    r.addEventListener('change', buildInquiryLinks);
  });

  buildInquiryLinks();
  inquireModal.classList.add('open');
}

document.getElementById('inqName').addEventListener('input', buildInquiryLinks);
document.getElementById('inqPhone').addEventListener('input', buildInquiryLinks);

async function notifyInquiry() {
  if (!inqService) return;
  var u = API.user();
  try {
    var res = await API.req('/inquiries', {
      method: 'POST',
      body: {
        serviceId: inqService._id,
        serviceName: inqService.name,
        category: (inqService.meta || '').split('•')[0].trim(),
        mode: inqSelectedMode(),
        name: document.getElementById('inqName').value.trim() || (u && u.name) || '',
        phone: normalizePhone(document.getElementById('inqPhone').value) || (u && u.phone) || '',
      },
    });
    /* حدّث الروابط بالقنوات الرسمية من الخادم قبل فتح المحادثة */
    if (res.whatsapp || res.telegram) {
      inqService.contactWhatsapp = res.whatsapp || inqService.contactWhatsapp;
      inqService.contactTelegram = res.telegram || inqService.contactTelegram;
      buildInquiryLinks();
    }
  } catch (e) { /* لا نمنع فتح المحادثة */ }
}
document.getElementById('inqWa').addEventListener('click', notifyInquiry);
document.getElementById('inqTg').addEventListener('click', notifyInquiry);

/* ---------------- Toast ---------------- */
var toastTimer;
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
}

/* ---------------- عدّادات + متفرقات ---------------- */
var counters = document.querySelectorAll('[data-count]');
var co = new IntersectionObserver(function (entries) {
  entries.forEach(function (en) {
    if (!en.isIntersecting) return;
    var el = en.target, target = +el.dataset.count, cur = 0;
    var step = Math.max(1, Math.ceil(target / 60));
    function tick() { cur += step; if (cur >= target) { el.textContent = target + '+'; return; } el.textContent = cur; requestAnimationFrame(tick); }
    tick(); co.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(function (c) { co.observe(c); });

document.getElementById('year').textContent = new Date().getFullYear();
var sections = ['home', 'store', 'courses'];
window.addEventListener('scroll', function () {
  var current = 'home';
  sections.forEach(function (id) {
    var el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 120) current = id;
  });
  document.querySelectorAll('.nav-link').forEach(function (l) {
    l.classList.toggle('active', l.getAttribute('href') === '#' + current);
  });
}, { passive: true });

initDialPickers();
loadAll();


/* v12: شارة الخصم + عرض السعر القديم مشطوباً (مزيّن تجميلي — يعتمد /api/products) */
(function () {
  var saleMap = {};
  function eff(p) { return p.isOnSale && p.discountPercent > 0 ? +(p.price - p.price * p.discountPercent / 100).toFixed(2) : p.price; }
  function decorate() {
    document.querySelectorAll('[class*="card"], [class*="group"], [data-pid]').forEach(function (card) {
      if (card.dataset.saleDone) return;
      var name = '';
      Object.keys(saleMap).forEach(function (n) { if (card.textContent.indexOf(n) !== -1 && (!name || n.length > name.length)) name = n; });
      if (!name) return;
      var p = saleMap[name];
      card.dataset.saleDone = '1';
      card.style.position = card.style.position || 'relative';
      var b = document.createElement('span');
      b.className = 'sale-badge';
      b.textContent = 'خصم ' + p.discountPercent + '% 🔥';
      card.appendChild(b);
      /* استبدال أول عنصر يحمل سعراً دولارياً صرفاً بصيغة العرض */
      var els = card.querySelectorAll('*'), k;
      for (k = 0; k < els.length; k++) {
        var el = els[k], t = (el.textContent || '').trim();
        var mch = t.match(/^\$\s*(\d+(?:\.\d+)?)\s*$/);
        if (mch && el.children.length === 0) {
          el.innerHTML = '<span class="price-old">$' + mch[1] + '</span> <span class="price-new">$' + eff(p) + '</span>';
          break;
        }
      }
    });
  }
  async function load() {
    try {
      var list = await API.req('/products');
      (list || []).forEach(function (p) { if (p.isOnSale && p.discountPercent > 0) saleMap[p.name] = p; });
      decorate();
      new MutationObserver(function () { decorate(); }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();

/* v12: القائمة الجانبية (Off-canvas Drawer) */
(function () {
  var d = document.getElementById('sideDrawer'), o = document.getElementById('drawerOverlay'), m = document.getElementById('menuBtn');
  if (!d || !o || !m) return;
  function open() { d.classList.add('open'); o.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function close() { d.classList.remove('open'); o.classList.remove('show'); document.body.style.overflow = ''; }
  m.addEventListener('click', function (e) { e.preventDefault(); open(); });
  o.addEventListener('click', close);
  var x = document.getElementById('drawerClose'); if (x) x.addEventListener('click', close);
  d.querySelectorAll('.drawer-link').forEach(function (a) { a.addEventListener('click', close); });
  var cur = document.getElementById('currencySelect'), slot = document.getElementById('drawerCurrencySlot');
  if (cur && slot) slot.appendChild(cur);
  var dt = document.getElementById('drawerThemeBtn'), tt = document.getElementById('themeToggle');
  if (dt && tt) dt.addEventListener('click', function () { tt.click(); });
})();