
/* ═══ v23: جلب أيقونة التطبيق تلقائياً عبر محرك DuckDuckGo ═══ */
function getAppIcon(product) {
  if (product.image && product.image.startsWith('http') && !product.image.includes('googleusercontent')) {
    return product.image;
  }
  var match = String(product.name || '').match(/\(([^)]+)\)/);
  var cleanName = (match ? match[1] : String(product.name || 'app'))
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
  return 'https://icons.duckduckgo.com/ip3/' + cleanName + '.com.ico';
}
function appIconFallback(name) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(String(name || 'App')) + '&background=2563eb&color=fff&size=128';
}
function appIconImg(p, cls) {
  return '<img src="' + getAppIcon(p) + '" alt="' + String(p.name || '').replace(/"/g, '') + '" class="' + cls + '" '
    + 'onerror="this.onerror=null;this.src=appIconFallback(\'' + String(p.name || 'App').replace(/'/g, '') + '\');" />';
}

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
      appIconImg(g, 'variant-icon-img') +
      '<span class="variant-name">' + v.name +
        (v.isOnSale && v.discountPercent > 0 ? ' <span class="v-sale-badge">خصم ' + v.discountPercent + '% 🔥</span>' : '') + '</span>' +
      '<span class="variant-price">' +
        (v.isOnSale && v.discountPercent > 0
          ? '<span class="v-price-stack"><span class="price-new">' + fmtPrice(effPrice(v)) + '</span><span class="price-old">' + fmtPrice(v.price) + '</span></span>'
          : fmtPrice(effPrice(v))) + '</span>' +
      '<button class="buy-btn" data-variant="' + i + '" title="أضف للسلة">🛒</button>' +
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
    var isCustomItem = i.variant === 'custom' || /^custom_/.test(String(i.variant || ''));
    var acct = isCustomItem
      ? (i.accountId ? '<div class="cart-auth-summary">🔐 ' + i.accountId + '</div>' : '')
      : i.requiresAccountId
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
    return '<button class="pay-btn" data-pm="' + pm._id + '">' +
      (pm.logoUrl ? '<img class="pay-logo" src="' + pm.logoUrl + '" alt="" onerror="this.outerHTML=\'💳\'" />' : '💳') +
      ' ' + pm.name + '</button>';
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
  var missing = cart.find(function (i) { return i.requiresAccountId && !i.accountId && !(i.variant === 'custom' || /^custom/.test(String(i.variant || ''))); });
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
      var decoLock = false;
      new MutationObserver(function () {
        if (decoLock) return; decoLock = true;
        setTimeout(function () { decoLock = false; decorate(); }, 300);
      }).observe(document.body, { childList: true, subtree: true });
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

/* ════════════ v14: توزيع الأزرار + إلغاء الطلبات + تصدير PDF ════════════ */
(function () {
  /* ── 1) العملة في الشريط العلوي، الثيم في القائمة الجانبية فقط ── */
  function arrange() {
    var nav = document.querySelector('.nav-actions'), cur = document.getElementById('currencySelect'), login = document.getElementById('loginBtn');
    if (nav && cur && login && cur.parentElement !== nav) nav.insertBefore(cur, login);
    var slot = document.getElementById('drawerCurrencySlot');
    if (slot) { var row = slot.closest('.drawer-tool-row'); if (row) row.remove(); }
    var dtb = document.getElementById('drawerThemeBtn'); if (dtb) dtb.remove();
    var theme = document.getElementById('themeToggle'), tools = document.querySelector('.drawer-tools');
    if (theme && tools && theme.parentElement !== tools) {
      theme.className = 'drawer-tool-btn'; theme.style.cssText = 'width:100%;text-align:right;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;font-weight:700;cursor:pointer';
      if (!theme.querySelector('.th-label')) { var l = document.createElement('b'); l.className = 'th-label'; l.textContent = ' تبديل الثيم'; theme.appendChild(l); }
      tools.appendChild(theme);
    }
  }

  /* ── 2) مهلة إلغاء الطلبات في "طلباتي" ── */
  var CANCEL_WIN_MIN = 30;
  try { API.req('/orders/cancel-window').then(function (r) { if (r && r.minutes != null) CANCEL_WIN_MIN = r.minutes; }); } catch (e) {}
  var enhancing = false;
  async function enhanceOrders() {
    if (enhancing) return; enhancing = true;
    try {
      var res = await API.req('/orders/my-orders');
      var list = Array.isArray(res) ? res : (res && res.orders) || [];
      if (!list.length) { enhancing = false; return; }
      var map = {}; list.forEach(function (o) { if (o.code) map[o.code] = o; });
      document.querySelectorAll('tr').forEach(function (tr) {
        if (tr.dataset.v14done) return;
        var code = Object.keys(map).find(function (c) { return tr.textContent.indexOf(c) !== -1; });
        if (!code) return;
        tr.dataset.v14done = '1';
        var o = map[code];
        var td = document.createElement('td');
        var inv = document.createElement('button');
        inv.className = 'btn-invoice'; inv.textContent = '🧾'; inv.title = 'فاتورة PDF';
        inv.onclick = function () { exportOrdersPdf([o], 'فاتورة طلب ' + o.code); };
        td.appendChild(inv);
        if (o.status === 'قيد المراجعة') {
          var left = CANCEL_WIN_MIN * 60000 - (Date.now() - new Date(o.createdAt).getTime());
          if (left > 0) {
            var b = document.createElement('button');
            b.className = 'btn-cancel-order';
            b.textContent = '🚫 إلغاء (' + Math.ceil(left / 60000) + 'د)';
            b.onclick = async function () {
              if (!confirm('تأكيد إلغاء الطلب ' + o.code + '؟')) return;
              try { await API.req('/orders/' + o._id + '/cancel', { method: 'POST' }); showToast('✅ تم إلغاء الطلب'); setTimeout(function(){ location.reload(); }, 800); }
              catch (e) { showToast('❌ ' + e.message); }
            };
            td.appendChild(b);
          } else {
            var sp = document.createElement('small'); sp.className = 'cancel-expired';
            sp.textContent = 'انتهت مهلة الإلغاء التلقائي، يرجى التواصل مع الدعم';
            td.appendChild(sp);
          }
        }
        tr.appendChild(td);
      });
    } catch (e) {}
    enhancing = false;
  }

  /* ── 3) تصدير PDF (كشف حساب / فاتورة) ── */
  var CUR_LIST = [];
  try { API.req('/currencies').then(function (r) { CUR_LIST = Array.isArray(r) ? r : (r && r.currencies) || []; }); } catch (e) {}
  function localAmount(usd) {
    var sel = document.getElementById('currencySelect');
    var code = sel && sel.value;
    var c = CUR_LIST.find(function (x) { return x.code === code; });
    if (c && c.rate && code !== 'USD') return ' / ' + Math.round(usd * c.rate) + ' ' + code;
    return '';
  }
  function profileInfo() {
    var phone = (document.getElementById('pfPhone') || {}).value || '';
    var nameEl = document.querySelector('#profileModal input[type="text"], [id*="rofile"] input[type="text"]');
    return { name: nameEl ? nameEl.value : '', phone: phone };
  }
  function orderRows(list) {
    return list.map(function (o) {
      var items = (o.items || []).map(function (i) { return i.name; }).join(' + ');
      var ids = (o.items || []).map(function (i) { return i.accountId; }).filter(Boolean).join(' ، ') || '—';
      var dt = new Date(o.createdAt).toLocaleString('ar-EG');
      return '<tr><td>' + o.code + '</td><td>' + dt + '</td><td>' + items + '</td><td>' + ids + '</td><td>$' + o.total + localAmount(o.total) + '</td><td>' + ((o.paymentMethod && o.paymentMethod.name) || '—') + '</td><td>' + o.status + '</td></tr>';
    }).join('');
  }
  function pdfShell(title, infoHtml, rowsHtml) {
    return '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;padding:16px;color:#111;background:#fff">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #6c5ce7;padding-bottom:8px;margin-bottom:10px">'
      + '<h2 style="margin:0;color:#6c5ce7">⚡ DevStore</h2><b style="font-size:14px">' + title + '</b></div>'
      + '<div style="font-size:12px;margin-bottom:10px;line-height:1.9">' + infoHtml + '</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:11px" border="1" cellpadding="6">'
      + '<thead><tr style="background:#6c5ce7;color:#fff"><th>رقم الطلب</th><th>التاريخ والوقت</th><th>الخدمة / الباقة</th><th>ID</th><th>المبلغ</th><th>طريقة الدفع</th><th>الحالة</th></tr></thead>'
      + '<tbody>' + rowsHtml + '</tbody></table>'
      + '<p style="margin-top:12px;font-size:10px;color:#888">أُصدر هذا التقرير آلياً من منصة DevStore — ' + new Date().toLocaleString('ar-EG') + '</p></div>';
  }
  function savePdf(html, filename) {
    var d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d);
    html2pdf().set({ margin: 8, filename: filename, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } })
      .from(d).save().then(function () { d.remove(); });
  }
  async function exportOrdersPdf(preset, title) {
    try {
      var list = preset;
      if (!list) {
        var res = await API.req('/orders/my-orders');
        list = (Array.isArray(res) ? res : (res && res.orders) || []);
        var f = (document.getElementById('repFrom') || {}).value, t = (document.getElementById('repTo') || {}).value;
        if (f) list = list.filter(function (o) { return new Date(o.createdAt) >= new Date(f); });
        if (t) list = list.filter(function (o) { return new Date(o.createdAt) <= new Date(t + 'T23:59:59'); });
      }
      if (!list.length) { showToast('⚠️ لا توجد طلبات في هذا النطاق'); return; }
      var u = profileInfo();
      var info = '👤 العميل: <b>' + (u.name || '—') + '</b> &nbsp;|&nbsp; 📱 الهاتف: <b dir="ltr">' + (u.phone || '—') + '</b>';
      savePdf(pdfShell(title || 'كشف حساب / تقرير الطلبات', info, orderRows(list)), 'DevStore-report.pdf');
    } catch (e) { showToast('❌ ' + e.message); }
  }
  function injectPdfUi() {
    if (document.getElementById('v14PdfBox')) return;
    var host = document.getElementById('profileModal') || document.querySelector('[id*="rofile"]');
    if (!host) return;
    var box = document.createElement('div');
    box.id = 'v14PdfBox';
    box.style.cssText = 'margin-top:14px;padding:12px;border:1px dashed rgba(108,92,231,.5);border-radius:12px';
    box.innerHTML = '<b style="font-size:.9rem">📄 تصدير كشف حساب / تقرير طلباتي (PDF)</b>'
      + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">'
      + '<input type="date" id="repFrom" style="flex:1;min-width:120px;padding:7px;border-radius:8px;border:1px solid #ccc" title="من تاريخ" />'
      + '<input type="date" id="repTo" style="flex:1;min-width:120px;padding:7px;border-radius:8px;border:1px solid #ccc" title="إلى تاريخ" />'
      + '<button type="button" class="btn btn-primary" id="v14PdfBtn" style="padding:8px 14px">تصدير PDF ⬇️</button></div>'
      + '<small style="color:#888">اترك التواريخ فارغة لتصدير كل الطلبات — ولتحميل فاتورة طلب محدد استخدم زر 🧾 بجانبه في جدول الطلبات.</small>';
    host.appendChild(box);
    document.getElementById('v14PdfBtn').onclick = function () { exportOrdersPdf(null); };
  }
  var tickLock = false;
  function tick() {
    if (tickLock) return; tickLock = true;
    setTimeout(function () { tickLock = false; }, 300);
    arrange(); injectPdfUi(); enhanceOrders();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
})();


/* ════════════ v15: قائمة جانبية + واجهات مستقلة بنمط Midasbuy ════════════ */
(function () {
  function closeDrawer() {
    var d = document.getElementById('sideDrawer'), o = document.getElementById('drawerOverlay');
    if (d) d.classList.remove('open'); if (o) o.classList.remove('show');
    document.body.style.overflow = '';
  }
  function openView(name) {
    closeDrawer();
    document.querySelectorAll('.full-view').forEach(function (v) { v.classList.remove('show'); });
    var el = document.getElementById('view-' + name);
    if (el) { el.classList.add('show'); document.body.style.overflow = 'hidden'; window.scrollTo(0, 0); }
    if (name === 'profile') fillProfile();
    if (name === 'orders') renderFvOrders();
  }
  function closeViews() {
    document.querySelectorAll('.full-view').forEach(function (v) { v.classList.remove('show'); });
    document.body.style.overflow = '';
  }
  function user() { try { return JSON.parse(localStorage.getItem('ds-user') || sessionStorage.getItem('ds-user') || 'null'); } catch (e) { return null; } }
  function fillProfile() {
    var u = user() || {};
    var s = function (id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; if (el && el.tagName !== 'INPUT') el.textContent = v || ''; };
    s('fvName', u.name); s('fvPhone', u.phone);
    var setT = function (el, v) { if (el && el.textContent !== v) el.textContent = v; };
    setT(document.getElementById('fvProfileName'), u.name || 'زائر');
    setT(document.getElementById('fvProfilePhone'), u.phone || '');
    setT(document.getElementById('drawerUserName'), u.name || 'زائر');
    setT(document.getElementById('drawerUserPhone'), u.phone || '');
  }
  var CANCEL_WIN = 30;
  try { API.req('/orders/cancel-window').then(function (r) { if (r && r.minutes != null) CANCEL_WIN = r.minutes; }); } catch (e) {}
  async function renderFvOrders() {
    var box = document.getElementById('fvOrdersList'); if (!box) return;
    box.innerHTML = '<p class="fv-muted">جاري تحميل طلباتك...</p>';
    try {
      var res = await API.req('/orders/my-orders');
      var list = Array.isArray(res) ? res : (res && res.orders) || [];
      if (!list.length) { box.innerHTML = '<p class="fv-muted">لا توجد طلبات بعد.</p>'; return; }
      box.innerHTML = '';
      list.forEach(function (o) {
        var items = (o.items || []).map(function (i) { return i.name; }).join(' + ');
        var card = document.createElement('div'); card.className = 'fv-card fv-order';
        var statusCls = o.status === 'مكتمل' ? 'st-done' : (o.status === 'ملغي' ? 'st-cancel' : 'st-pending');
        card.innerHTML = '<div class="fv-order-head"><b>' + (o.code || '') + '</b><span class="fv-status ' + statusCls + '">' + o.status + '</span></div>'
          + '<p class="fv-order-items">' + items + '</p>'
          + '<div class="fv-order-meta"><span>💰 $' + o.total + '</span><span>🕒 ' + new Date(o.createdAt).toLocaleString('ar-EG') + '</span></div>'
          + '<div class="fv-order-actions"></div>';
        var act = card.querySelector('.fv-order-actions');
        var inv = document.createElement('button'); inv.className = 'btn btn-outline fv-mini'; inv.textContent = '🧾 فاتورة PDF';
        inv.onclick = function () { exportOrdersPdf([o], 'فاتورة طلب ' + o.code); };
        act.appendChild(inv);
        if (o.status === 'قيد المراجعة') {
          var left = CANCEL_WIN * 60000 - (Date.now() - new Date(o.createdAt).getTime());
          if (left > 0) {
            var c = document.createElement('button'); c.className = 'btn-cancel-order fv-mini';
            c.textContent = '🚫 إلغاء (' + Math.ceil(left / 60000) + 'د)';
            c.onclick = async function () {
              if (!confirm('تأكيد إلغاء الطلب ' + o.code + '؟')) return;
              try { await API.req('/orders/' + o._id + '/cancel', { method: 'POST' }); showToast('✅ تم إلغاء الطلب'); renderFvOrders(); }
              catch (e) { showToast('❌ ' + e.message); }
            };
            act.appendChild(c);
          } else {
            var sp = document.createElement('small'); sp.className = 'cancel-expired';
            sp.textContent = 'انتهت مهلة الإلغاء التلقائي، يرجى التواصل مع الدعم';
            act.appendChild(sp);
          }
        }
        box.appendChild(card);
      });
    } catch (e) { box.innerHTML = '<p class="fv-muted">⚠️ ' + e.message + '</p>'; }
  }
  function doLogout() {
    if (!confirm('🚪 هل أنت متأكد من تسجيل الخروج؟\n\nاضغط OK للتأكيد أو Cancel للإلغاء')) return;
    localStorage.removeItem('ds-token'); localStorage.removeItem('ds-user');
    sessionStorage.removeItem('ds-token'); sessionStorage.removeItem('ds-user');
    showToast('👋 تم تسجيل الخروج'); setTimeout(function () { location.reload(); }, 700);
  }
  function wire() {
    document.querySelectorAll('.drawer-link[data-view]').forEach(function (b) {
      if (b.dataset.w) return; b.dataset.w = '1';
      b.addEventListener('click', function () { openView(b.dataset.view); });
    });
    document.querySelectorAll('[data-back]').forEach(function (b) {
      if (b.dataset.w) return; b.dataset.w = '1';
      b.addEventListener('click', closeViews);
    });
    var dl = document.getElementById('drawerLogout'); if (dl && !dl.dataset.w) { dl.dataset.w = '1'; dl.addEventListener('click', doLogout); }
    var fl = document.getElementById('fvLogout'); if (fl && !fl.dataset.w) { fl.dataset.w = '1'; fl.addEventListener('click', doLogout); }
    var sn = document.getElementById('fvSaveName');
    if (sn && !sn.dataset.w) { sn.dataset.w = '1'; sn.addEventListener('click', async function () {
      try {
        var r = await API.req('/users/profile', { method: 'PUT', body: { name: document.getElementById('fvName').value.trim() } });
        var u = user() || {}; u.name = (r.user && r.user.name) || u.name;
        var store = localStorage.getItem('ds-user') ? localStorage : sessionStorage;
        store.setItem('ds-user', JSON.stringify(u));
        fillProfile(); showToast('✅ تم حفظ الاسم');
      } catch (e) { showToast('❌ ' + e.message); }
    }); }
    var cp = document.getElementById('fvChangePass');
    /* v19: إعادة ربط قوية مباشرة بالزر (تتجاوز أي تعارض سابق) */
    (function () {
      var btn = document.getElementById('fvChangePass');
      if (!btn || btn.dataset.v19) return; btn.dataset.v19 = '1';
      btn.onclick = async function (ev) {
        ev.preventDefault();
        var cur = (document.getElementById('fvCurPass') || {}).value || '';
        var nw = (document.getElementById('fvNewPass') || {}).value || '';
        if (!cur) { showToast('⚠️ أدخل كلمة المرور الحالية'); return; }
        if (!nw || nw.length < 6) { showToast('⚠️ كلمة المرور الجديدة 6 أحرف على الأقل'); return; }
        var orig = btn.textContent; btn.disabled = true; btn.textContent = '⏳ جاري التحديث...';
        try {
          await API.req('/users/change-password', { method: 'PUT', body: { currentPassword: cur, newPassword: nw } });
          document.getElementById('fvCurPass').value = ''; document.getElementById('fvNewPass').value = '';
          showToast('✅ تم تغيير كلمة المرور بنجاح');
        } catch (e) {
          showToast('❌ ' + (e.message || 'فشل تغيير كلمة المرور'));
        }
        btn.disabled = false; btn.textContent = orig;
      };
    })();

    if (cp && !cp.dataset.w) { cp.dataset.w = '1'; cp.addEventListener('click', async function () {
      try {
        await API.req('/users/change-password', { method: 'PUT', body: { currentPassword: document.getElementById('fvCurPass').value, newPassword: document.getElementById('fvNewPass').value } });
        document.getElementById('fvCurPass').value = ''; document.getElementById('fvNewPass').value = '';
        showToast('✅ تم تحديث كلمة المرور');
      } catch (e) { showToast('❌ ' + e.message); }
    }); }
    var dtb = document.getElementById('drawerThemeBtn'), tt = document.getElementById('themeToggle');
    if (dtb && tt && !dtb.dataset.w) { dtb.dataset.w = '1'; dtb.addEventListener('click', function () { tt.click(); }); }
    fillProfile();
  }
  /* v16 fix: بدون MutationObserver — wire() يُستدعى مرة واحدة فقط (العناصر ثابتة) */
  function wireOnce() { wire(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireOnce); else wireOnce();
})();


/* ════════════ v17: ترتيب ذيل القائمة + حماية الزوار + الجلسات + تحديث صامت ════════════ */
(function () {
  function cu() { try { return JSON.parse(localStorage.getItem('ds-user') || sessionStorage.getItem('ds-user') || 'null'); } catch (e) { return null; } }
  function closeDrawer17() {
    var d = document.getElementById('sideDrawer'), o = document.getElementById('drawerOverlay');
    if (d) d.classList.remove('open'); if (o) o.classList.remove('show');
    document.body.style.overflow = '';
  }
  /* ── 1) ترتيب ذيل القائمة: اللغة ← الثيم ← تسجيل الخروج (في الأخير) ── */
  function arrangeFooter() {
    var tools = document.querySelector('.drawer-tools');
    var lang = document.querySelector('.drawer-lang');
    var theme = document.getElementById('drawerThemeBtn');
    var lo = document.getElementById('drawerLogout');
    if (!tools || !lang || !theme || !lo) return;
    if (!lo.classList.contains('drawer-tool-btn')) {
      lo.classList.add('drawer-tool-btn'); lo.classList.remove('drawer-link');
      lo.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:center;gap:6px';
      lo.innerHTML = '🚪 تسجيل الخروج';
    }
    if (tools.lastElementChild !== lo) { tools.innerHTML = ''; tools.appendChild(lang); tools.appendChild(theme); tools.appendChild(lo); }
    lo.style.display = cu() ? 'flex' : 'none'; /* يظهر للمسجلين فقط */
  }
  /* ── 2) حارس الزوار: منع فتح صفحات الحساب دون تسجيل ── */
  function guard() {
    document.querySelectorAll('.drawer-link[data-view], .drawer-tool-btn[data-view]').forEach(function (b) {
      if (b.dataset.g17) return; b.dataset.g17 = '1';
      b.addEventListener('click', function (e) {
        if (cu()) return; /* مسجّل ← يمر للمعالج الأصلي */
        e.stopImmediatePropagation(); e.preventDefault();
        closeDrawer17();
        showToast('🔐 يرجى تسجيل الدخول أولاً للوصول إلى هذه الصفحة');
        var lb = document.getElementById('loginBtn'); if (lb) lb.click();
      }, true); /* capture: يسبق معالج v15 */
    });
  }
  /* ── 3) كرت الجلسة الحقيقي + الخروج من كل الأجهزة ── */
  function parseUA(ua) {
    var os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'غير معروف';
    var br = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : 'متصفح';
    return br + ' على ' + os;
  }
  async function loadSession() {
    var box = document.getElementById('fvSessionInfo');
    if (!box || !cu()) return;
    try {
      var r = await API.req('/users/session-info');
      box.innerHTML = '🖥️ الجهاز: <b>' + parseUA(r.ua || '') + '</b><br>'
        + '🕒 وقت تسجيل الدخول: <b>' + (r.loginAt ? new Date(r.loginAt).toLocaleString('ar-EG') : '—') + '</b><br>'
        + '🌐 عنوان IP: <b dir="ltr">' + (r.ip || '—') + '</b>';
    } catch (e) { box.innerHTML = '<span class="fv-muted">تعذر جلب بيانات الجلسة</span>'; }
  }
  function injectSession() {
    var sv = document.getElementById('view-security');
    if (!sv || document.getElementById('fvSessionInfo')) return;
    var cards = sv.querySelectorAll('.fv-card');
    if (cards.length < 2) return;
    var c = cards[1];
    c.innerHTML = '<h4>🟢 حالة الجلسة</h4>'
      + '<p class="fv-muted" id="fvSessionInfo" style="line-height:2">جاري جلب بيانات الجلسة...</p>'
      + '<button class="btn btn-outline btn-block" id="fvLogout">🚪 تسجيل الخروج من هذا الجهاز</button>'
      + '<button class="btn btn-primary btn-block" id="fvLogoutAll" style="margin-top:8px;background:#ff4757;border-color:#ff4757">⛔ تسجيل الخروج من كافة الأجهزة</button>';
    document.getElementById('fvLogout').onclick = function () {
      if (!confirm('🚪 هل أنت متأكد من تسجيل الخروج؟\n\nاضغط OK للتأكيد أو Cancel للإلغاء')) return;
      localStorage.removeItem('ds-token'); localStorage.removeItem('ds-user');
      sessionStorage.removeItem('ds-token'); sessionStorage.removeItem('ds-user');
      showToast('👋 تم تسجيل الخروج'); setTimeout(function () { location.reload(); }, 700);
    };
    document.getElementById('fvLogoutAll').onclick = async function () {
      if (!confirm('سيتم إنهاء جلستك على جميع الأجهزة فوراً — متابعة؟')) return;
      try {
        await API.req('/users/logout-all', { method: 'POST' });
        localStorage.clear(); sessionStorage.clear();
        showToast('✅ تم إنهاء جميع الجلسات — سجّل الدخول من جديد');
        setTimeout(function () { location.reload(); }, 900);
      } catch (e) { showToast('❌ ' + e.message); }
    };
    loadSession();
  }
  /* تحميل بيانات الجلسة عند فتح واجهة الأمان */
  document.querySelectorAll('[data-view="security"]').forEach(function (b) {
    if (b.dataset.s17) return; b.dataset.s17 = '1';
    b.addEventListener('click', function () { setTimeout(loadSession, 350); });
  });
  /* ── 4) تحديث صامت بعد العمليات (دون أن يلاحظ العميل) ── */
  var _fetch = window.fetch;
  window.fetch = function () {
    return _fetch.apply(this, arguments).then(function (r) {
      try {
        var m = (arguments[1] && arguments[1].method || 'GET').toUpperCase();
        if (r.ok && m !== 'GET' && String(arguments[0]).indexOf('/auth/') === -1)
          document.dispatchEvent(new CustomEvent('ds:silent-refresh'));
      } catch (e) {}
      return r;
    });
  };
  var srLock = false;
  document.addEventListener('ds:silent-refresh', function () {
    if (srLock) return; srLock = true;
    setTimeout(function () { srLock = false; }, 600);
    ['loadProducts', 'renderProducts', 'loadStore', 'loadCategories', 'renderCart'].forEach(function (fn) {
      try { if (typeof window[fn] === 'function') window[fn](); } catch (e) {}
    });
    var ov = document.getElementById('view-orders');
    if (ov && ov.classList.contains('show')) {
      var b = document.querySelector('[data-view="orders]') || document.querySelector('[data-view="orders"]');
      if (b) b.click(), b.click(); /* إعادة فتح = إعادة جلب */
    }
  });
  /* تشغيل */
  function tick17() { arrangeFooter(); guard(); injectSession(); }
  var l17 = false;
  new MutationObserver(function () {
    if (l17) return; l17 = true;
    setTimeout(function () { l17 = false; tick17(); }, 300);
  }).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick17); else tick17();
})();

/* v23b: استبدال أيقونات بطاقات المتجر بصور getAppIcon (تغطية شاملة عبر المراقب) */
(function () {
  var prodCache = {};
  async function ensureCache() {
    try {
      var list = await API.req('/products');
      (list || []).forEach(function (p) { prodCache[p.name] = p; });
    } catch (e) {}
  }
  function upgradeIcons() {
    /* كل عنصر أيقونة داخل بطاقة: إن كان يحمل إيموجي فقط نستبدله بصورة التطبيق */
    document.querySelectorAll('.group-icon, .card-icon, .product-icon, [class*="icon"]').forEach(function (el) {
      if (el.dataset.v23img || el.closest('#sideDrawer') || el.closest('.navbar') || el.closest('.drawer-tools')) return;
      var card = el.closest('[class*="card"], [class*="group"], [class*="product"]');
      if (!card) return;
      var name = '';
      Object.keys(prodCache).forEach(function (n) { if (card.textContent.indexOf(n) !== -1 && n.length > name.length) name = n; });
      if (!name) return;
      var prod = prodCache[name];
      /* فقط إذا كان العنصر يحتوي إيموجي/نص قصير وليس صورة */
      var txt = (el.textContent || '').trim();
      if (el.querySelector('img') || txt.length > 4) return;
      el.dataset.v23img = '1';
      el.innerHTML = '';
      var img = document.createElement('img');
      img.src = getAppIcon(prod);
      img.alt = prod.name;
      img.className = 'group-icon-img';
      img.onerror = function () { this.onerror = null; this.src = appIconFallback(prod.name); };
      el.appendChild(img);
    });
  }
  var l23 = false;
  new MutationObserver(function () {
    if (l23) return; l23 = true;
    setTimeout(function () { l23 = false; upgradeIcons(); }, 400);
  }).observe(document.body, { childList: true, subtree: true });
  function init() { ensureCache().then(upgradeIcons); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


/* ════════════ v24: هوية المتجر الديناميكية + شعارات الدفع في السلة ════════════ */
(function () {
  /* ── تطبيق الهوية في الهيدر لكل الزوار ── */
  async function applyBranding() {
    try {
      var b = await (await fetch('/api/settings/branding?t=' + Date.now(), { cache: 'no-store' })).json();
      var nameEl = document.querySelector('.brand-name');
      if (nameEl && b.siteName) {
        var parts = b.siteName.split(/\s+/);
        nameEl.innerHTML = parts.length > 1 ? '<b>' + parts[0] + '</b>' + parts.slice(1).join(' ') : '<b>' + b.siteName + '</b>';
      }
      var iconEl = document.querySelector('.brand-icon');
      if (iconEl && b.logoUrl) {
        iconEl.innerHTML = '<img src="' + b.logoUrl + '" alt="" style="width:30px;height:30px;border-radius:9px;object-fit:cover;vertical-align:middle" />';
      }
    } catch (e) {}
  }
  /* ── شعارات بوابات الدفع في السلة ── */
  var pmCache = [];
  async function loadPm() {
    for (const ep of ['/settings/payment-methods', '/payment-methods']) {
      try { var r = await API.req(ep); if (Array.isArray(r)) { pmCache = r; return; } } catch (e) {}
    }
  }
  function addPayLogos() {
    return; /* v27: معطّلة — الشعار يُبنى مرة واحدة داخل زر الدفع مباشرة */
    if (!pmCache.length) return;
    document.querySelectorAll('[class*="pay"], [class*="Pay"]').forEach(function (el) {
      if (el.dataset.v24logo || el.closest('#sideDrawer')) return;
      var name = '';
      pmCache.forEach(function (m) { if (m.name && m.logoUrl && el.textContent.indexOf(m.name) !== -1 && m.name.length > name.length) name = m.name; });
      if (!name) return;
      var m = pmCache.find(function (x) { return x.name === name; });
      if (!m || !m.logoUrl) return;
      el.dataset.v24logo = '1';
      var img = document.createElement('img');
      img.src = m.logoUrl; img.alt = m.name; img.className = 'pay-logo';
      img.onerror = function () { this.style.display = 'none'; };
      el.insertBefore(img, el.firstChild);
    });
  }
  var l24 = false;
  new MutationObserver(function () {
    if (l24) return; l24 = true;
    setTimeout(function () { l24 = false; addPayLogos(); }, 400);
  }).observe(document.body, { childList: true, subtree: true });
  function init() { applyBranding(); loadPm().then(addPayLogos); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();


/* ════════════ v25: تطبيق هوية المتجر بصلابة (تصحيح عدم الظهور) ════════════ */
(function () {
  async function applyBranding25() {
    try {
      var b = await (await fetch('/api/settings/branding?t=' + Date.now(), { cache: 'no-store' })).json();
      if (b && b.siteName) {
        ['siteBrandName', 'siteBrandNameDrawer'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) { var parts = b.siteName.split(/\s+/);
            el.innerHTML = parts.length > 1 ? '<b>' + parts[0] + '</b>' + parts.slice(1).join(' ') : '<b>' + b.siteName + '</b>'; }
        });
        document.title = b.siteName;
      }
      if (b && b.logoUrl) {
        [['siteBrandLogo', 'siteBrandEmoji'], ['siteBrandLogoDrawer', 'siteBrandEmojiDrawer']].forEach(function (pair) {
          var img = document.getElementById(pair[0]), emo = document.getElementById(pair[1]);
          if (img) { img.src = b.logoUrl; img.style.display = 'inline-block'; }
          if (emo) emo.style.display = 'none';
        });
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBranding25); else applyBranding25();
  window.addEventListener('load', applyBranding25);
})();


/* ═══ v28: جلب إعدادات الموقع ديناميكياً فور التحميل (siteName + siteLogo) ═══ */
async function loadSiteSettings() {
  try {
    const res = await fetch('/api/settings?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    var name = data.siteName || '', logo = data.siteLogo || '';
    if (name) {
      ['siteBrandName', 'siteBrandNameDrawer'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { var parts = name.split(/\s+/);
          el.innerHTML = parts.length > 1 ? '<b>' + parts[0] + '</b>' + parts.slice(1).join(' ') : '<b>' + name + '</b>'; }
      });
      var legacy = document.querySelector('.brand-name:not(#siteBrandName):not(#siteBrandNameDrawer)');
      if (legacy) legacy.innerHTML = '<b>' + name + '</b>';
      document.title = name;
    }
    if (logo) {
      [['siteBrandLogo', 'siteBrandEmoji'], ['siteBrandLogoDrawer', 'siteBrandEmojiDrawer']].forEach(function (pair) {
        var img = document.getElementById(pair[0]), emo = document.getElementById(pair[1]);
        if (img) { img.src = logo; img.style.display = 'inline-block'; }
        if (emo) emo.style.display = 'none';
      });
    }
  } catch (err) { console.error('Error loading settings:', err); }
}
document.addEventListener('DOMContentLoaded', loadSiteSettings);
window.addEventListener('load', loadSiteSettings);


/* ════════════ v29: منتجات الكمية المخصصة (Custom Quantity Checkout) ════════════ */
(function () {
  var _prodCache = null;
  function findProduct(id) {
    if (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) {
      var f = PRODUCTS.find(function (p) { return String(p._id) === String(id); });
      if (f) return f;
    }
    return _prodCache ? _prodCache.find(function (p) { return String(p._id) === String(id); }) : null;
  }
  try { fetch('/api/products').then(function (r) { return r.json(); }).then(function (l) { _prodCache = l; }); } catch (e) {}

  function unitOf(g) {
    /* v30: الاشتقاق التلقائي — سعر الوحدة = سعر الحد الأدنى ÷ الحد الأدنى */
    var base = 0;
    if (g.minQtyPrice > 0 && g.minQuantity > 0) base = g.minQtyPrice / g.minQuantity;
    else if (g.unitPrice != null && g.unitPrice > 0) base = g.unitPrice;
    else base = g.price || 0;
    if (g.isOnSale && g.discountPercent > 0) return +(base - base * g.discountPercent / 100).toFixed(6);
    return +base.toFixed ? +base.toFixed(6) : base;
  }
  function closeCqm() { var m = document.getElementById('cqmOverlay'); if (m) m.remove(); document.body.style.overflow = ''; }

  function openCustomModal(g) {
    closeCqm();
    var unit = unitOf(g);
    var min = g.minQuantity || 1, max = g.maxQuantity || 1000000;
    var step = (g.step && g.step > 1) ? g.step : Math.max(1, Math.round(min / 100));
    var at = g.authType || 'id_only';
    var authHtml = '', hint = '';
    if (at === 'email_password') {
      authHtml = '<input type="email" id="cqmEmail" class="cqm-input" placeholder="البريد الإلكتروني" dir="ltr" />'
        + '<input type="text" id="cqmPass" class="cqm-input" placeholder="كلمة المرور (مرئية للتأكد)" dir="ltr" autocomplete="off" />';
      hint = '📧 الشحن عبر الحساب — أدخل البريد وكلمة المرور بدقة تامة';
    } else if (at === 'email_only') {
      authHtml = '<input type="email" id="cqmEmail" class="cqm-input" placeholder="البريد الإلكتروني (Supercell ID)" dir="ltr" />';
      hint = '✉️ الشحن عبر البريد الإلكتروني فقط';
    } else {
      authHtml = '<input type="text" id="cqmId" class="cqm-input" placeholder="أدخل الايدي (Player ID)" dir="ltr" />';
      hint = '🆔 الشحن عبر الايدي';
    }
    var iconHtml = '';
    try { if (typeof appIconImg === 'function') iconHtml = appIconImg(g, 'cqm-img'); } catch (e) {}
    var ov = document.createElement('div');
    ov.id = 'cqmOverlay'; ov.className = 'cqm-overlay';
    ov.innerHTML =
      '<div class="cqm-box" dir="rtl">'
      + '<button type="button" class="cqm-close" id="cqmClose">✕</button>'
      + '<div class="cqm-head">' + iconHtml
      + '<div class="cqm-title"><b>' + g.name + '</b><small>' + min + ' وحدة = $' + (g.minQtyPrice || +(unit * min).toFixed(2)) + '</small></div>'
      + '<span class="cqm-badge" id="cqmBadge">$0.00</span></div>'
      + '<label class="cqm-label">🔢 الكمية المطلوبة</label>'
      + '<div class="cqm-qty"><button type="button" id="cqmMinus">−</button>'
      + '<input type="number" id="cqmQty" value="' + min + '" step="' + step + '" inputmode="numeric" />'
      + '<button type="button" id="cqmPlus">+</button></div>'
      + '<small class="cqm-meta">الحد الأدنى ' + min + ' • الأقصى ' + max + ' • الخطوة ' + step + '</small>'
      + '<p class="cqm-warn" id="cqmWarn"></p>'
      + '<div class="cqm-totalrow">الإجمالي: <b id="cqmTotal">$0.00</b></div>'
      + authHtml
      + '<small class="cqm-hint">' + hint + '</small>'
      + '<button type="button" class="btn btn-primary btn-block cqm-buy" id="cqmBuy" disabled>🛒 أضف للسلة</button>'
      + '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';

    var qtyEl = document.getElementById('cqmQty');
    var buyBtn = document.getElementById('cqmBuy');
    function recalc() {
      var q = parseInt(qtyEl.value) || 0;
      var total = +(unit * q).toFixed(2);
      document.getElementById('cqmTotal').textContent = '$' + total;
      document.getElementById('cqmBadge').textContent = '$' + total;
      var warn = document.getElementById('cqmWarn');
      if (q < min) { warn.textContent = '⚠️ يجب أن تكون الكمية أكبر من أو تساوي ' + min; buyBtn.disabled = true; }
      else if (q > max) { warn.textContent = '⚠️ الحد الأقصى المسموح به ' + max; buyBtn.disabled = true; }
      else { warn.textContent = ''; buyBtn.disabled = false; }
    }
    qtyEl.addEventListener('input', recalc);
    document.getElementById('cqmMinus').onclick = function () { qtyEl.value = Math.max(min, (parseInt(qtyEl.value) || min) - step); recalc(); };
    document.getElementById('cqmPlus').onclick = function () { qtyEl.value = Math.min(max, (parseInt(qtyEl.value) || 0) + step); recalc(); };
    document.getElementById('cqmClose').onclick = closeCqm;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeCqm(); });

    buyBtn.onclick = function () {
      var q = parseInt(qtyEl.value) || 0;
      if (q < min || q > max) return;
      var accountId = '';
      if (at === 'id_only') {
        accountId = (document.getElementById('cqmId').value || '').trim();
        if (!accountId) { showToast('⚠️ أدخل الايدي أولاً'); return; }
      } else if (at === 'email_only') {
        accountId = (document.getElementById('cqmEmail').value || '').trim();
        if (!accountId || accountId.indexOf('@') === -1) { showToast('⚠️ أدخل بريداً إلكترونياً صحيحاً'); return; }
        accountId = '📧 ' + accountId;
      } else {
        var em = (document.getElementById('cqmEmail').value || '').trim();
        var pw = (document.getElementById('cqmPass').value || '').trim();
        if (!em || em.indexOf('@') === -1) { showToast('⚠️ أدخل بريداً إلكترونياً صحيحاً'); return; }
        if (!pw) { showToast('⚠️ أدخل كلمة المرور'); return; }
        accountId = '📧 ' + em + ' | 🔑 ' + pw;
      }
      addCustomToCart(g, q, accountId);
      closeCqm();
      setTimeout(function () { var cb = document.getElementById('cartBtn'); if (cb) cb.click(); }, 250);
    };
    recalc();
  }

  function addCustomToCart(g, qty, accountId) {
    /* v33: إضافة مباشرة مضمونة للسلة — بلا وسيط، بنفس بنية عناصر السلة الأصلية */
    var unit = unitOf(g);
    try {
      var item = {
        id: g._id,
        variant: 'custom',
        extra: accountId,
        name: g.name + ' — ' + qty + ' ' + (g.unit || 'وحدة'),
        price: unit,
        qty: qty,
        accountId: accountId,
        requiresAccountId: false   /* البيانات سُجلت في النافذة — لا حقل ولا فحص في السلة */
      };
      item.key = [item.id, item.variant, item.extra].filter(Boolean).join('|');
      var wrote = false;
      try {
        if (typeof cart !== 'undefined' && Array.isArray(cart)) {
          var dup = cart.find(function (x) { return x.key === item.key; });
          if (dup) { dup.qty = qty; dup.accountId = accountId; dup.extra = accountId; dup.price = unit; }
          else cart.push(item);
          wrote = true;
        }
      } catch (e0) {}
      try {
        var stored = JSON.parse(localStorage.getItem('ds-cart') || '[]');
        var d2 = stored.find(function (x) { return x.key === item.key; });
        if (d2) { d2.qty = qty; d2.accountId = accountId; d2.extra = accountId; d2.price = unit; }
        else stored.push(item);
        localStorage.setItem('ds-cart', JSON.stringify(stored));
        wrote = true;
      } catch (e1) {}
      try { if (typeof saveCart === 'function') saveCart(); } catch (e2) {}
      try { if (typeof renderCart === 'function') renderCart(); } catch (e3) {}
      if (wrote) showToast('✅ أُضيف إلى السلة: ' + g.name + ' × ' + qty);
      else showToast('❌ تعذر الإضافة للسلة');
    } catch (e) { console.error('addCustomToCart:', e); showToast('❌ تعذر الإضافة للسلة'); }
  }

  /* اعتراض النقر على منتجات الكمية المخصصة قبل المعالجات الأصلية (مرحلة الالتقاط) */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-buy]');
    var grp = e.target.closest('[data-group]');
    var id = btn ? btn.dataset.buy : (grp ? grp.dataset.group : null);
    if (!id) return;
    var g = findProduct(id);
    if (!g || g.pricingType !== 'custom_amount') return;
    e.preventDefault(); e.stopImmediatePropagation();
    openCustomModal(g);
  }, true);
})();




/* ════════════ v34: إعادة هيكلة السلة + فلاتر الخدمات + العدادات الحية ════════════ */
(function () {
  /* ── 1) هيكلة السلة: قائمة تمرير + شريط سفلي ثابت + شيت دفع تصاعدي ── */
  function restructureCart() {
    var panel = document.getElementById('cartPanel');
    if (!panel || document.getElementById('paySheet')) return;
    var footer = panel.querySelector('.cart-footer');
    var payMethods = panel.querySelector('.pay-methods');
    if (!footer || !payMethods) return;

    /* ابحث عن زر تأكيد الطلب الأصلي وانقله للشريط السفلي (يحتفظ بمعرّفه ومستمعيه) */
    var confirmBtn = null;
    panel.querySelectorAll('button').forEach(function (b) { if (/تأكيد/.test(b.textContent)) confirmBtn = b; });

    /* شيت الدفع التصاعدي — نقل عقدة payMethods الفعلية إليه (تبقى المعرّفات والمستمعون سليمة) */
    var overlay = document.createElement('div');
    overlay.id = 'paySheetOverlay'; overlay.className = 'pay-sheet-overlay';
    var sheet = document.createElement('div');
    sheet.id = 'paySheet'; sheet.className = 'pay-sheet';
    sheet.innerHTML = '<div class="pay-sheet-handle"></div><div class="pay-sheet-head"><h4>💳 اختر طريقة الدفع</h4><button type="button" class="modal-close" id="paySheetClose">✕</button></div>';
    sheet.appendChild(payMethods);
    document.body.appendChild(overlay);
    document.body.appendChild(sheet);

    /* الشريط السفلي الثابت */
    footer.classList.add('cart-bottom-bar');
    var actions = document.createElement('div');
    actions.className = 'cart-actions';
    var openBtn = document.createElement('button');
    openBtn.type = 'button'; openBtn.id = 'openPaySheet'; openBtn.className = 'btn btn-outline pay-open-btn';
    openBtn.innerHTML = '💳 <span id="paySheetBtnLabel">اختر طريقة الدفع</span>';
    actions.appendChild(openBtn);
    if (confirmBtn) { confirmBtn.classList.add('cart-confirm-btn'); actions.appendChild(confirmBtn); }
    footer.appendChild(actions);

    function openSheet() { sheet.classList.add('open'); overlay.classList.add('show'); }
    function closeSheet() { sheet.classList.remove('open'); overlay.classList.remove('show'); }
    openBtn.addEventListener('click', openSheet);
    overlay.addEventListener('click', closeSheet);
    sheet.querySelector('#paySheetClose').addEventListener('click', closeSheet);

    /* عند اختيار طريقة دفع: حدّث اسم الزر وأغلق الشيت (المستمع الأصلي يبقى يضبط selectedPmId) */
    document.addEventListener('click', function (e) {
      var pb = e.target.closest('#payGrid .pay-btn');
      if (!pb) return;
      var label = document.getElementById('paySheetBtnLabel');
      if (label) label.textContent = pb.textContent.trim();
      setTimeout(closeSheet, 250);
    });
  }

  /* ── 2) فلاتر أقسام الدورات والخدمات الفرعية ── */
  function buildCourseFilters() {
    var sec = document.getElementById('courses');
    if (!sec || document.getElementById('coursesFilters')) return;
    if (typeof CATEGORIES === 'undefined' || typeof COURSES === 'undefined') return;
    var svcCats = CATEGORIES.filter(function (c) { return c.kind === 'services'; });
    if (!svcCats.length) return;
    var bar = document.createElement('div');
    bar.id = 'coursesFilters'; bar.className = 'store-filters courses-filters';
    bar.innerHTML = '<button class="filter-chip active" data-cfilter="all">الكل</button>' +
      svcCats.map(function (c) { return '<button class="filter-chip" data-cfilter="' + c.slug + '">' + (c.icon || '') + ' ' + c.nameAr + '</button>'; }).join('');
    var head = sec.querySelector('h2, .section-head, .section-title') || sec.firstElementChild;
    if (head && head.parentElement) head.parentElement.insertBefore(bar, head.nextSibling);
    else sec.insertBefore(bar, sec.firstChild);
    bar.addEventListener('click', function (e) {
      var chip = e.target.closest('.filter-chip'); if (!chip) return;
      bar.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      var slug = chip.dataset.cfilter;
      var cards = sec.querySelectorAll('[class*="card"], [class*="course"]');
      cards.forEach(function (card) {
        if (card.id === 'coursesFilters' || card.closest('#coursesFilters')) return;
        var match = null;
        COURSES.forEach(function (c) { if (card.textContent.indexOf(c.name) !== -1 && (!match || c.name.length > match.name.length)) match = c; });
        card.style.display = (slug === 'all' || !match || match.cat === slug) ? '' : 'none';
      });
    });
  }

  /* ── 3) العدادات الحية من قاعدة البيانات ── */
  async function loadLiveStats() {
    try {
      var d = await (await fetch('/api/settings/stats?t=' + Date.now(), { cache: 'no-store' })).json();
      document.querySelectorAll('.hero-stats .stat, .stats .stat, [class*="stats"] .stat').forEach(function (st) {
        var b = st.querySelector('b'); var label = (st.textContent || '');
        if (!b) return;
        var val = null;
        if (/خدمة|منجزة/.test(label)) val = d.services;
        else if (/طالب|متدرب/.test(label)) val = d.trainees;
        else if (/دعم/.test(label)) val = d.support;
        if (val != null) { b.dataset.count = val; b.textContent = '+' + val; }
      });
    } catch (e) {}
  }

  var l34 = false;
  new MutationObserver(function () {
    if (l34) return; l34 = true;
    setTimeout(function () { l34 = false; restructureCart(); buildCourseFilters(); }, 300);
  }).observe(document.body, { childList: true, subtree: true });
  function init() { restructureCart(); buildCourseFilters(); loadLiveStats(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', loadLiveStats);
})();
