
/* v15: قالب سعر موحّد — شارة واحدة + سعر نهائي + سعر أصلي مشطوب (يُبنى مرة واحدة فقط) */
function priceMarkup(p) {
  if (p && p.isOnSale && p.discountPercent > 0) {
    return '<span class="discount-badge">خصم ' + p.discountPercent + '%</span> ' +
           '<span class="current-price">' + fmtPrice(effPrice(p)) + '</span> ' +
           '<del class="old-price">' + fmtPrice(p.price) + '</del>';
  }
  return fmtPrice(effPrice(p));
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
      : '<div class="product-price">' + priceMarkup(p) + ' <small>' + (p.unit || '') + '</small></div>' +
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

(function(){ var _lb=document.getElementById('loginBtn'); if(_lb) _lb.addEventListener('click', function () {
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
    setTimeout(function(){ try{ location.reload(); }catch(e){} }, 700);
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
  function tick() { arrange(); injectPdfUi(); enhanceOrders(); }
  new MutationObserver(tick).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
})();

/* ════════════ v15: ربط لوحة الحساب في القائمة الجانبية ════════════ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function toast(m) { try { showToast(m); } catch (e) {} }
  function tk() { return (window.API && API.token) ? API.token() : null; }
  function openDrawer() { var d=$('sideDrawer'), o=$('drawerOverlay'); if(!d) return; d.classList.add('open'); d.setAttribute('aria-hidden','false'); if(o) o.classList.add('show'); document.body.style.overflow='hidden'; }
  function closeDrawer() { var d=$('sideDrawer'), o=$('drawerOverlay'); if(!d) return; d.classList.remove('open'); d.setAttribute('aria-hidden','true'); if(o) o.classList.remove('show'); document.body.style.overflow=''; }
  window.DS_openDrawer = openDrawer;
  function hitLogin() { var lb=$('loginBtn'); if(lb){ lb.click(); return; } var am=$('authModal'); if(am){ am.classList.add('show'); am.classList.add('open'); am.style.display='flex'; } }
  function needAuth() { if (!tk()) { toast('⚠️ سجّل الدخول أولاً'); hitLogin(); return true; } return false; }

  var mb = $('menuBtn'); if (mb) mb.addEventListener('click', function (e) { e.preventDefault(); openDrawer(); });
  var xb = $('drawerClose'); if (xb) xb.addEventListener('click', closeDrawer);
  var ov = $('drawerOverlay'); if (ov) ov.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  if (location.search.indexOf('drawer=1') !== -1) setTimeout(openDrawer, 350);

  async function syncUser() {
    var name = 'زائر', phone = '—';
    try {
      var me = null;
      try { me = await API.req('/auth/me'); } catch (e) { try { me = await API.req('/users/me'); } catch (e2) {} }
      var u = (me && (me.user || me)) || null;
      if (u && u.name) { name = u.name; phone = u.phone || '—'; }
      else {
        var cached = (window.API && API.user) ? API.user() : null;
        if(!cached) ['ds-user','ds_user','devstore_user','user'].forEach(function (k) { try { var v = localStorage.getItem(k) || sessionStorage.getItem(k); if (v) cached = JSON.parse(v); } catch (e) {} });
        if (cached) { name = cached.name || name; phone = cached.phone || phone; }
      }
    } catch (e) {}
    if ($('drawerUserName')) $('drawerUserName').textContent = name;
    if ($('drawerUserPhone')) $('drawerUserPhone').textContent = phone;
    var logged = !!tk();
    if ($('drawerTools')) $('drawerTools').style.display = logged ? '' : 'none';
    if ($('drawerSessionInfo')) $('drawerSessionInfo').textContent = logged
      ? '🟢 أنت مسجل الدخول بجلسة نشطة على هذا الجهاز.' : '🔴 لا توجد جلسة دخول حالياً.';
  }

  var pb = $('drawerProfileBtn');
  if (pb) pb.addEventListener('click', function () { if (needAuth()) return; hitLogin(); closeDrawer(); });

  var pwb = $('drawerPwBtn');
  if (pwb) pwb.addEventListener('click', async function () {
    if (needAuth()) return;
    var c=$('drawerCurPw'), n=$('drawerNewPw');
    if (!c.value || n.value.length < 6) return toast('⚠️ أدخل كلمة المرور الحالية وجديدة (6 أحرف+)');
    try {
      await API.req('/users/change-password', { method: 'PUT', body: { currentPassword: c.value, newPassword: n.value, oldPassword: c.value } });
      c.value=''; n.value=''; toast('✅ تم تغيير كلمة المرور بنجاح');
    } catch (e) { toast('❌ ' + e.message); }
  });
  var sb = $('drawerSessionBtn');
  if (sb) sb.addEventListener('click', function () {
    var i=$('drawerSessionInfo');
    if (i) i.textContent = tk() ? ('🟢 جلسة نشطة على هذا الجهاز — ' + new Date().toLocaleString('ar-EG')) : '🔴 لا توجد جلسة دخول';
    toast(tk() ? '🟢 جلسة الدخول نشطة' : '🔴 غير مسجل الدخول');
  });

  var ob = $('drawerOrdersBtn');
  if (ob) ob.addEventListener('click', function () {
    if (needAuth()) return;
    hitLogin(); closeDrawer();
    setTimeout(function () {
      var t=[].slice.call(document.querySelectorAll('button,a,[role="tab"]')).find(function(el){ return /طلباتي|سجل الطلبات/.test(el.textContent||''); });
      if (t) t.click();
    }, 500);
  });

  async function exportPdf() {
    if (needAuth()) return;
    try {
      var res = await API.req('/orders/my-orders');
      var list = Array.isArray(res) ? res : (res && res.orders) || [];
      var f=$('drawerRepFrom').value, tt=$('drawerRepTo').value;
      if (f) list = list.filter(function(o){ return new Date(o.createdAt) >= new Date(f); });
      if (tt) list = list.filter(function(o){ return new Date(o.createdAt) <= new Date(tt+'T23:59:59'); });
      if (!list.length) return toast('⚠️ لا توجد طلبات في هذا النطاق');
      var rates = {}, sel = document.getElementById('currencySelect');
      try { var cs = await API.req('/currencies'); (Array.isArray(cs)?cs:(cs.currencies||[])).forEach(function(c){ rates[c.code]=c.rate; }); } catch (e) {}
      function loc(usd){ var code = sel && sel.value; return (code && code!=='USD' && rates[code]) ? ' / ' + Math.round(usd*rates[code]) + ' ' + code : ''; }
      var rows = list.map(function(o){
        var items = (o.items||[]).map(function(i){return i.name;}).join(' + ');
        var ids = (o.items||[]).map(function(i){return i.accountId;}).filter(Boolean).join(' ، ') || '—';
        return '<tr><td>'+o.code+'</td><td>'+new Date(o.createdAt).toLocaleString('ar-EG')+'</td><td>'+items+'</td><td>'+ids+'</td><td>$'+o.total+loc(o.total)+'</td><td>'+((o.paymentMethod&&o.paymentMethod.name)||'—')+'</td><td>'+o.status+'</td></tr>';
      }).join('');
      var html = '<div dir="rtl" style="font-family:Tahoma,Arial;padding:16px;background:#fff;color:#111">'
        + '<div style="display:flex;justify-content:space-between;border-bottom:3px solid #6c5ce7;padding-bottom:8px;margin-bottom:10px"><h2 style="margin:0;color:#6c5ce7">⚡ DevStore</h2><b>كشف حساب / تقرير الطلبات</b></div>'
        + '<div style="font-size:12px;margin-bottom:10px">👤 العميل: <b>'+$('drawerUserName').textContent+'</b> | 📱 <b dir="ltr">'+$('drawerUserPhone').textContent+'</b><br>🕒 أُصدر في: '+new Date().toLocaleString('ar-EG')+'</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:11px" border="1" cellpadding="6"><thead><tr style="background:#6c5ce7;color:#fff"><th>رقم الطلب</th><th>التاريخ والوقت</th><th>الخدمة / الباقة</th><th>ID</th><th>المبلغ</th><th>طريقة الدفع</th><th>الحالة</th></tr></thead><tbody>'+rows+'</tbody></table>'
        + '<p style="margin-top:12px;font-size:10px;color:#888">صادر آلياً من منصة DevStore</p></div>';
      var host=document.createElement('div'); host.innerHTML=html; document.body.appendChild(host);
      if (window.html2pdf) html2pdf().set({ margin:8, filename:'DevStore-report.pdf', html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'a4',orientation:'landscape'} }).from(host).save().then(function(){ host.remove(); });
      else { toast('❌ مكتبة PDF غير محمّلة'); host.remove(); }
    } catch (e) { toast('❌ ' + e.message); }
  }
  var pdfb = $('drawerPdfBtn'); if (pdfb) pdfb.addEventListener('click', exportPdf);

  (async function () {
    try {
      var s = await API.req('/settings/site'); var st = s && (s.settings || s);
      var wa = (st && (st.whatsapp || st.supportWhatsapp || st.phone || '')) + '';
      var tg = (st && (st.telegram || st.supportTelegram || '')) + '';
      if ($('drawerWa')) $('drawerWa').href = wa ? ('https://wa.me/' + wa.replace(/\D/g,'')) : '#';
      if ($('drawerTg')) $('drawerTg').href = tg ? ('https://t.me/' + tg.replace(/^@/,'')) : '#';
      if (wa && $('drawerWa')) $('drawerWa').textContent = '💬 واتساب الدعم (' + wa + ')';
    } catch (e) {}
  })();

  var lo = $('drawerLogout');
  if (lo) lo.addEventListener('click', function () {
    if (!confirm('تسجيل الخروج من حسابك؟')) return;
    try { Object.keys(localStorage).forEach(function (k) { if (/token|ds_|devstore|user/i.test(k)) localStorage.removeItem(k); }); } catch (e) {}
    try { Object.keys(sessionStorage).forEach(function (k) { if (/token|ds_|devstore|user/i.test(k)) sessionStorage.removeItem(k); }); } catch (e) {}
    if (window.API && API.logout) { try { API.logout(); } catch (e) {} }
    location.reload();
  });

  document.querySelectorAll('.drawer-link[data-nav-cat]').forEach(function (a) {
    a.addEventListener('click', function () {
      var cat = a.dataset.navCat;
      setTimeout(function () {
        var t = [].slice.call(document.querySelectorAll('button,[class*="chip"],[class*="filter"]')).find(function (el) { return (el.textContent||'').indexOf(cat) !== -1; });
        if (t) t.click();
      }, 250);
      closeDrawer();
    });
  });

  var n = 0; (function loop(){ syncUser(); if (++n < 10) setTimeout(loop, 1200); })();
})();


/* ════════════ v16: Accordion + i18n (عربي/إنجليزي) ════════════ */
(function () {
  var $ = function (id) { return document.getElementById(id); };

  /* ── القوائم القابلة للطي: فتح واحد وإغلاق الباقي ── */
  document.querySelectorAll('.acc-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.acc-item');
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.acc-item.open').forEach(function (o) { o.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ── حفظ الاسم من القائمة مباشرة ── */
  function toast(m){ try{ showToast(m); }catch(e){} }
  var ni = $('drawerNameInput'), un = $('drawerUserName');
  if (un && ni) new MutationObserver(function(){ if (document.activeElement !== ni) ni.value = un.textContent === 'زائر' ? '' : un.textContent; }).observe(un, { childList: true, characterData: true, subtree: true });
  var ns = $('drawerNameSave');
  if (ns) ns.addEventListener('click', async function () {
    var v = (ni.value || '').trim();
    if (v.length < 2) return toast('⚠️ أدخل اسماً صحيحاً');
    try { await API.req('/users/profile', { method: 'PUT', body: { name: v } }); if (un) un.textContent = v; toast('✅ تم حفظ الاسم'); }
    catch (e) { toast('❌ ' + e.message); }
  });

  /* ── i18n: قاموس مركزي ── */
  var I18N = {
    'الرئيسية':'Home','المتجر الرقمي':'Digital Store','الدورات والخدمات':'Courses & Services','اتصل بنا':'Contact Us',
    '🛍️ المتجر الرقمي':'🛍️ Digital Store','🎮 الألعاب وشحن الحسابات':'🎮 Games & Top-ups','📱 التطبيقات':'📱 Apps',
    '🛠️ أدوات المبرمجين':'🛠️ Developer Tools','🎓 الدورات والخدمات':'🎓 Courses & Services','📞 اتصل بنا':'📞 Contact Us',
    '👤 الملف الشخصي':'👤 Profile','الاسم المعروض':'Display name','اسمك':'Your name','حفظ الاسم':'Save Name',
    'عرض وتعديل بياناتي':'View & Edit My Info','فتح الملف الشخصي الكامل':'Open Full Profile',
    '🔒 الأمن والخصوصية':'🔒 Security & Privacy','🔒 الأمان والخصوصية':'🔒 Security & Privacy',
    'كلمة المرور الحالية':'Current password','كلمة المرور الجديدة':'New password','تغيير كلمة المرور':'Change Password',
    'إدارة الجلسة وحالة الدخول':'Session & Login Status',
    '📄 التقارير وسجل الطلبات':'📄 Reports & Orders','استعراض سجل الطلبات وحالاتها':'Browse Orders & Statuses',
    'تصدير كشف الحساب والفواتير PDF ⬇️':'Export Statement & Invoices PDF ⬇️',
    '🚪 تسجيل الخروج':'🚪 Logout','🌙 تبديل الوضع الليلي / النهاري':'🌙 Toggle Dark / Light Mode',
    '✈️ دعم تليجرام':'✈️ Telegram Support','زائر':'Guest',
    'أضف للسلة 🛒':'Add to Cart 🛒','💬 تواصل للاتفاق':'💬 Contact to Arrange','تواصل للاتفاق':'Contact to Arrange',
    'شراء فوري':'Buy Now','تحقق':'Verify','إعادة إرسال الرمز':'Resend Code','سلة المشتريات':'Shopping Cart',
    'تسجيل الدخول':'Login','إنشاء حساب':'Sign Up','إتمام الطلب':'Checkout',
    '🚀 بوابتك التقنية الشاملة في اليمن والعالم العربي':'🚀 Your Tech Gateway in Yemen & the Arab World',
    '🛍️ تصفح المتجر الرقمي':'🛍️ Browse Digital Store'
  };
  var TOAST_EN = {
    '⚠️ سجّل الدخول أولاً':'⚠️ Please log in first','✅ تم حفظ الاسم':'✅ Name saved',
    '✅ تم تغيير كلمة المرور بنجاح':'✅ Password changed successfully','⚠️ أدخل اسماً صحيحاً':'⚠️ Enter a valid name',
    '✅ تم إلغاء الطلب':'✅ Order cancelled','⚠️ لا توجد طلبات في هذا النطاق':'⚠️ No orders in this range'
  };
  var PH_EN = { 'كلمة المرور الحالية':'Current password','كلمة المرور الجديدة':'New password','اسمك':'Your name' };
  var PREFIX_EN = { '💬 واتساب الدعم':'💬 WhatsApp Support','📦 عرض الباقات':'📦 View Packages','🟢 جلسة نشطة':'🟢 Active session' };
  var lang = localStorage.getItem('lang') || 'ar';
  var translating = false;

  function translateLeaf(el) {
    var t = el.textContent; if (!t) return;
    var k = t.trim();
    if (lang === 'en') {
      if (el.dataset.i18nOrig === undefined) el.dataset.i18nOrig = t;
      if (I18N[k] !== undefined) { el.textContent = t.replace(k, I18N[k]); return; }
      Object.keys(PREFIX_EN).forEach(function (p) { if (k.indexOf(p) === 0) el.textContent = t.replace(p, PREFIX_EN[p]); });
    } else if (el.dataset.i18nOrig !== undefined) { el.textContent = el.dataset.i18nOrig; }
  }
  function applyLang(l) {
    lang = l; localStorage.setItem('lang', l);
    document.documentElement.lang = l;
    document.documentElement.dir = (l === 'en') ? 'ltr' : 'rtl';
    translating = true;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length === 0) translateLeaf(el);
      if (el.placeholder !== undefined && el.placeholder) {
        if (l === 'en') { if (el.dataset.phOrig === undefined) el.dataset.phOrig = el.placeholder; if (PH_EN[el.dataset.phOrig]) el.placeholder = PH_EN[el.dataset.phOrig]; }
        else if (el.dataset.phOrig) el.placeholder = el.dataset.phOrig;
      }
    });
    translating = false;
    var lt = $('langToggle'); if (lt) lt.textContent = (l === 'en') ? '🌐 العربية' : '🌐 English';
  }
  var lt = $('langToggle');
  if (lt) lt.addEventListener('click', function () { applyLang(lang === 'en' ? 'ar' : 'en'); });
  /* ترجمة لحظية للمحتوى الديناميكي عند الإنجليزية */
  var mo = new MutationObserver(function () { if (lang === 'en' && !translating) { translating = true; document.querySelectorAll('body *').forEach(function (el) { if (el.children.length === 0) translateLeaf(el); }); translating = false; } });
  mo.observe(document.body, { childList: true, subtree: true });
  /* ترجمة رسائل Toast المعروفة */
  if (typeof window.showToast === 'function') {
    var _st = window.showToast;
    window.showToast = function (m) { if (lang === 'en' && TOAST_EN[m]) m = TOAST_EN[m]; _st(m); };
  }
  applyLang(lang);
})();


/* ════════════ v17: نوافذ الحساب المستقلة ════════════ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function toast(m){ try{ showToast(m); }catch(e){} }
  function tk(){ return (window.API && API.token) ? API.token() : null; }
  function openM(id){ var m=$(id); if(!m) return; m.classList.add('show'); m.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function closeM(id){ var m=$(id); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  function closeDrawer(){ var d=$('sideDrawer'),o=$('drawerOverlay'); if(d){d.classList.remove('open');} if(o){o.classList.remove('show');} }
  function needAuth(){ if(!tk()){ toast('⚠️ سجّل الدخول أولاً'); var lb=$('loginBtn'); if(lb) lb.click(); return true; } return false; }
  document.querySelectorAll('.modal-close').forEach(function(b){ b.addEventListener('click', function(){ closeM(b.dataset.close); }); });
  document.querySelectorAll('.ds-modal').forEach(function(m){ m.addEventListener('click', function(e){ if(e.target===m) closeM(m.id); }); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') document.querySelectorAll('.ds-modal.show').forEach(function(m){ closeM(m.id); }); });

  /* الملف الشخصي */
  var bp=$('drawerOpenProfile');
  if (bp) bp.addEventListener('click', function(){
    if (needAuth()) return; closeDrawer();
    var un=$('drawerUserName'), up=$('drawerUserPhone');
    if ($('modalNameInput') && un) $('modalNameInput').value = un.textContent==='زائر'?'':un.textContent;
    if ($('modalPhoneInput') && up) $('modalPhoneInput').value = up.textContent;
    openM('modalProfile');
  });
  var mns=$('modalNameSave');
  if (mns) mns.addEventListener('click', async function(){
    var v=($('modalNameInput').value||'').trim(); if(v.length<2) return toast('⚠️ أدخل اسماً صحيحاً');
    try{ await API.req('/users/profile',{method:'PUT',body:{name:v}}); var un=$('drawerUserName'); if(un)un.textContent=v; toast('✅ تم حفظ الاسم'); }
    catch(e){ toast('❌ '+e.message); }
  });

  /* الأمان */
  var bs=$('drawerOpenSecurity');
  if (bs) bs.addEventListener('click', function(){
    if (needAuth()) return; closeDrawer();
    if ($('secSessionInfo')) $('secSessionInfo').textContent = tk() ? '🟢 جلسة نشطة على هذا الجهاز — '+new Date().toLocaleString('ar-EG') : '🔴 لا توجد جلسة';
    openM('modalSecurity');
  });
  var sps=$('secPwSave');
  if (sps) sps.addEventListener('click', async function(){
    var c=$('secCurPw'),n=$('secNewPw'),n2=$('secNewPw2');
    if(!c.value||n.value.length<6) return toast('⚠️ أدخل كلمة المرور الحالية وجديدة (6 أحرف+)');
    if(n.value!==n2.value) return toast('⚠️ تأكيد كلمة المرور غير متطابق');
    try{ await API.req('/users/change-password',{method:'PUT',body:{currentPassword:c.value,newPassword:n.value,oldPassword:c.value}});
      c.value='';n.value='';n2.value=''; toast('✅ تم تغيير كلمة المرور بنجاح'); }
    catch(e){ toast('❌ '+e.message); }
  });
  var sla=$('secLogoutAll');
  if (sla) sla.addEventListener('click', function(){
    if(!confirm('تسجيل الخروج من كافة الأجهزة؟')) return;
    try{ Object.keys(localStorage).forEach(function(k){ if(/token|ds_|devstore|user/i.test(k)) localStorage.removeItem(k); }); }catch(e){}
    try{ Object.keys(sessionStorage).forEach(function(k){ if(/token|ds_|devstore|user/i.test(k)) sessionStorage.removeItem(k); }); }catch(e){}
    if (window.API && API.logout){ try{ API.logout(); }catch(e){} }
    location.reload();
  });

  /* التقارير وسجل الطلبات */
  var CANCEL_MIN=30, ORDERS=[];
  try{ API.req('/orders/cancel-window').then(function(r){ if(r&&r.minutes!=null) CANCEL_MIN=r.minutes; }); }catch(e){}
  function stBadge(st){ var c = st==='مكتمل'?'#2ed573':(st==='ملغي'?'#ff6b81':'#ffa502'); return '<span style="color:'+c+';font-weight:800">'+st+'</span>'; }
  function renderOrders(){
    var host=$('reportsList'); if(!host) return;
    if(!ORDERS.length){ host.innerHTML='<p class="drawer-note">لا توجد طلبات بعد.</p>'; return; }
    host.innerHTML = ORDERS.map(function(o){
      var items=(o.items||[]).map(function(i){return i.name;}).join(' + ');
      var ids=(o.items||[]).map(function(i){return i.accountId;}).filter(Boolean).join(' ، ');
      var dt=new Date(o.createdAt).toLocaleString('ar-EG');
      var extra='';
      if(o.status==='قيد المراجعة'){
        var left=CANCEL_MIN*60000-(Date.now()-new Date(o.createdAt).getTime());
        extra = left>0
          ? '<button class="oc-cancel" data-cancel="'+o._id+'">🚫 إلغاء الطلب ('+Math.ceil(left/60000)+'د متبقية)</button>'
          : '<span class="oc-expired">انتهت مهلة الإلغاء التلقائي — تواصل مع الدعم</span>';
      }
      return '<div class="order-card"><div class="oc-head"><span>'+o.code+'</span>'+stBadge(o.status)+'</div>'
        +'<div class="oc-row">🧾 '+items+(ids?'<br>🆔 '+ids:'')+'<br>🕒 '+dt+'<br>💰 $'+o.total+'</div>'+extra+'</div>';
    }).join('');
    host.querySelectorAll('[data-cancel]').forEach(function(b){
      b.addEventListener('click', async function(){
        if(!confirm('تأكيد إلغاء هذا الطلب؟')) return;
        try{ await API.req('/orders/'+b.dataset.cancel+'/cancel',{method:'POST'}); toast('✅ تم إلغاء الطلب'); loadOrders(); }
        catch(e){ toast('❌ '+e.message); }
      });
    });
  }
  async function loadOrders(){
    try{ var res=await API.req('/orders/my-orders'); ORDERS = Array.isArray(res)?res:(res&&res.orders)||[]; renderOrders(); }
    catch(e){ var host=$('reportsList'); if(host) host.innerHTML='<p class="drawer-note">تعذر التحميل</p>'; }
  }
  var br=$('drawerOpenReports');
  if (br) br.addEventListener('click', function(){ if(needAuth()) return; closeDrawer(); openM('modalReports'); loadOrders(); });

  async function exportPdf(){
    try{
      var list=ORDERS.slice();
      var f=$('repFromM').value, t=$('repToM').value;
      if(f) list=list.filter(function(o){return new Date(o.createdAt)>=new Date(f);});
      if(t) list=list.filter(function(o){return new Date(o.createdAt)<=new Date(t+'T23:59:59');});
      if(!list.length) return toast('⚠️ لا توجد طلبات في هذا النطاق');
      var rates={}, sel=document.getElementById('currencySelect');
      try{ var cs=await API.req('/currencies'); (Array.isArray(cs)?cs:(cs.currencies||[])).forEach(function(c){rates[c.code]=c.rate;}); }catch(e){}
      function loc(u){ var code=sel&&sel.value; return (code&&code!=='USD'&&rates[code])?' / '+Math.round(u*rates[code])+' '+code:''; }
      var rows=list.map(function(o){
        var items=(o.items||[]).map(function(i){return i.name;}).join(' + ');
        var ids=(o.items||[]).map(function(i){return i.accountId;}).filter(Boolean).join(' ، ')||'—';
        return '<tr><td>'+o.code+'</td><td>'+new Date(o.createdAt).toLocaleString('ar-EG')+'</td><td>'+items+'</td><td>'+ids+'</td><td>$'+o.total+loc(o.total)+'</td><td>'+((o.paymentMethod&&o.paymentMethod.name)||'—')+'</td><td>'+o.status+'</td></tr>';
      }).join('');
      var html='<div dir="rtl" style="font-family:Tahoma,Arial;padding:16px;background:#fff;color:#111">'
        +'<div style="display:flex;justify-content:space-between;border-bottom:3px solid #6c5ce7;padding-bottom:8px;margin-bottom:10px"><h2 style="margin:0;color:#6c5ce7">⚡ DevStore</h2><b>كشف حساب / تقرير الطلبات</b></div>'
        +'<div style="font-size:12px;margin-bottom:10px">👤 '+($('drawerUserName')||{}).textContent+' | 📱 <b dir="ltr">'+($('drawerUserPhone')||{}).textContent+'</b><br>🕒 '+new Date().toLocaleString('ar-EG')+'</div>'
        +'<table style="width:100%;border-collapse:collapse;font-size:11px" border="1" cellpadding="6"><thead><tr style="background:#6c5ce7;color:#fff"><th>رقم الطلب</th><th>التاريخ والوقت</th><th>الخدمة</th><th>ID</th><th>المبلغ</th><th>الدفع</th><th>الحالة</th></tr></thead><tbody>'+rows+'</tbody></table>'
        +'<p style="margin-top:12px;font-size:10px;color:#888">صادر آلياً من منصة DevStore</p></div>';
      var host=document.createElement('div'); host.innerHTML=html; document.body.appendChild(host);
      if(window.html2pdf) html2pdf().set({margin:8,filename:'DevStore-report.pdf',html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}}).from(host).save().then(function(){host.remove();});
      else { toast('❌ مكتبة PDF غير محمّلة'); host.remove(); }
    }catch(e){ toast('❌ '+e.message); }
  }
  var rpb=$('reportsPdfBtn'); if(rpb) rpb.addEventListener('click', exportPdf);
})();

/* ═══ v17: إصلاح زر اللغة (ربط مباشر مضمون) ═══ */
(function(){
  var btn = document.getElementById('langToggle');
  if (!btn) return;
  if (!btn.dataset.v17bound) {
    btn.dataset.v17bound = '1';
    btn.addEventListener('click', function(){
      var cur = localStorage.getItem('lang') || 'ar';
      var nxt = (cur === 'en') ? 'ar' : 'en';
      localStorage.setItem('lang', nxt);
      document.documentElement.lang = nxt;
      document.documentElement.dir = (nxt === 'en') ? 'ltr' : 'rtl';
      btn.textContent = (nxt === 'en') ? '🌐 العربية' : '🌐 English';
      location.reload();
    });
  }
  var cur = localStorage.getItem('lang') || 'ar';
  btn.textContent = (cur === 'en') ? '🌐 العربية' : '🌐 English';
})();

})();
