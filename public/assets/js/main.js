/* ============================================================
   DevStore — الواجهة العامة: متجر + دورات + مصادقة OTP + ملف شخصي
   ============================================================ */

let PRODUCTS = [], COURSES = [], PAY_METHODS = [], SITE = {};
let cart = JSON.parse(localStorage.getItem('ds-cart') || '[]');
let selectedPmId = '';
let currentFilter = 'all';

const COUNTRIES = [
  ['🇺🇸', 'أمريكا (+1)'], ['🇬🇧', 'بريطانيا (+44)'], ['🇷🇺', 'روسيا (+7)'],
  ['🇮🇳', 'الهند (+91)'], ['🇮🇩', 'إندونيسيا (+62)'], ['🇵🇰', 'باكستان (+92)'],
  ['🇪🇬', 'مصر (+20)'], ['🇸🇦', 'السعودية (+966)'], ['🇦🇪', 'الإمارات (+971)'],
];
const CAT_LABELS = { games: '🎮 شحن الألعاب', numbers: '📱 أرقام وهمية', tools: '🛠️ أدوات وصيانة' };

/* ---------------- تحميل البيانات ---------------- */
async function loadAll() {
  try {
    const [items, pms, site] = await Promise.all([
      API.req('/products'),
      API.req('/settings/payment-methods'),
      API.req('/settings/site'),
    ]);
    PRODUCTS = items.filter(p => p.cat !== 'courses');
    COURSES = items.filter(p => p.cat === 'courses');
    PAY_METHODS = pms;
    SITE = site || {};
    renderProducts(currentFilter);
    renderCourses();
    renderPayMethods();
    renderContact();
  } catch (e) { showToast('⚠️ تعذر الاتصال بالخادم: ' + e.message); }
}

function renderContact() {
  const wa = (SITE.whatsapp || '').replace(/\D/g, '');
  const tg = (SITE.telegram || '').replace(/^@/, '');
  document.getElementById('waLink').href = wa ? `https://wa.me/${wa}` : '#';
  document.getElementById('tgLink').href = tg ? `https://t.me/${tg}` : '#';
  if (SITE.email) document.getElementById('footEmail').textContent = '📧 ' + SITE.email;
}

/* ---------------- ثيم + قائمة الجوال ---------------- */
document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('tg-theme', next);
});
const navLinks = document.getElementById('navLinks');
document.getElementById('menuBtn').addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

/* ---------------- المنتجات ---------------- */
function renderProducts(filter = 'all') {
  currentFilter = filter;
  const list = PRODUCTS.filter(p => filter === 'all' || p.cat === filter);
  document.getElementById('productsGrid').innerHTML = list.length ? list.map(p => `
    <article class="product-card">
      <div class="product-icon">${p.icon}</div>
      <span class="product-cat">${CAT_LABELS[p.cat] || ''}</span>
      <h3 class="product-name">${p.name}</h3>
      <p class="product-desc">${p.desc || ''}</p>
      ${p.countrySelect ? `
        <div class="product-extra">
          <select id="country-${p._id}"><option value="">اختر الدولة 🌍</option>
            ${COUNTRIES.map(([f, n]) => `<option value="${n}">${f} ${n}</option>`).join('')}
          </select>
        </div>` : ''}
      <div class="product-footer">
        <div class="product-price">$${p.price.toFixed(2)} <small>${p.unit || ''}</small></div>
        <button class="buy-btn" data-buy="${p._id}">شراء فوري ⚡</button>
      </div>
    </article>`).join('')
    : '<p class="cart-empty">لا توجد خدمات في هذا القسم حالياً</p>';
}
document.getElementById('storeFilters').addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  renderProducts(chip.dataset.filter);
});

/* ---------------- الدورات والخدمات (بدون سعر — تواصل للاتفاق) ---------------- */
function renderCourses() {
  document.getElementById('coursesGrid').innerHTML = COURSES.map(c => `
    <article class="course-card">
      <div class="course-cover">${c.icon}</div>
      <div class="course-body">
        <h3 class="course-name">${c.name}</h3>
        <p class="course-desc">${c.desc || ''}</p>
        <div class="course-modes">
          ${(c.modes || []).includes('online') ? '<span class="mode-badge mode-online">🌐 عن بُعد</span>' : ''}
          ${(c.modes || []).includes('onsite') ? '<span class="mode-badge mode-onsite">📍 حضوري — الحديدة</span>' : ''}
        </div>
        <div class="course-meta"><span>⏱️ ${c.meta || ''}</span></div>
        <div class="course-footer">
          <div class="course-price course-inquiry">💬 تواصل للاتفاق</div>
          <button class="buy-btn contact-btn" data-inquire="${c._id}">تواصل للاتفاق 📩</button>
        </div>
      </div>
    </article>`).join('');
}

/* ---------------- السلة ---------------- */
const cartPanel = document.getElementById('cartPanel');
const cartOverlay = document.getElementById('cartOverlay');
const cartItemsEl = document.getElementById('cartItems');
const cartBadge = document.getElementById('cartBadge');
const cartTotal = document.getElementById('cartTotal');
const saveCart = () => localStorage.setItem('ds-cart', JSON.stringify(cart));
const getItemInfo = id => PRODUCTS.find(p => p._id === id);

function addToCart(id) {
  const product = getItemInfo(id);
  if (!product) return;
  let extra = '';
  if (product.countrySelect) {
    const sel = document.getElementById(`country-${id}`);
    if (!sel?.value) { showToast('⚠️ اختر الدولة أولاً'); sel?.focus(); return; }
    extra = sel.value;
  }
  const key = extra ? `${id}|${extra}` : id;
  const found = cart.find(i => i.key === key);
  found ? found.qty++ : cart.push({ key, id, extra, qty: 1, name: product.name, price: product.price, icon: product.icon });
  saveCart(); renderCart();
  showToast(`✅ تمت الإضافة: ${product.name}`);
}
function renderCart() {
  cartBadge.textContent = cart.reduce((s, i) => s + i.qty, 0);
  if (!cart.length) {
    cartItemsEl.innerHTML = '<p class="cart-empty">سلتك فارغة حالياً.. تصفح المتجر وأضف ما يعجبك 🛍️</p>';
    cartTotal.textContent = '$0.00'; return;
  }
  cartItemsEl.innerHTML = cart.map(i => `
    <div class="cart-item">
      <span class="cart-item-icon">${i.icon}</span>
      <div class="cart-item-info"><b>${i.name}</b><span>${i.extra ? i.extra + ' • ' : ''}$${i.price.toFixed(2)}</span></div>
      <div class="cart-item-actions">
        <button class="qty-btn" data-dec="${i.key}">−</button><b>${i.qty}</b>
        <button class="qty-btn" data-inc="${i.key}">+</button>
        <button class="remove-btn" data-remove="${i.key}">🗑️</button>
      </div>
    </div>`).join('');
  cartTotal.textContent = '$' + cart.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2);
}
renderCart();

document.body.addEventListener('click', e => {
  const buy = e.target.closest('[data-buy]');
  if (buy) return addToCart(buy.dataset.buy);
  const inq = e.target.closest('[data-inquire]');
  if (inq) return openInquiry(inq.dataset.inquire);
  const inc = e.target.closest('[data-inc]');
  if (inc) { cart.find(i => i.key === inc.dataset.inc).qty++; saveCart(); renderCart(); return; }
  const dec = e.target.closest('[data-dec]');
  if (dec) {
    const it = cart.find(i => i.key === dec.dataset.dec);
    if (--it.qty <= 0) cart = cart.filter(i => i.key !== it.key);
    saveCart(); renderCart(); return;
  }
  const rem = e.target.closest('[data-remove]');
  if (rem) { cart = cart.filter(i => i.key !== rem.dataset.remove); saveCart(); renderCart(); }
});

const openCart = () => { cartPanel.classList.add('open'); cartOverlay.classList.add('open'); };
const closeCart = () => { cartPanel.classList.remove('open'); cartOverlay.classList.remove('open'); };
document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('cartClose').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

/* ---------------- طرق الدفع ---------------- */
function renderPayMethods() {
  const grid = document.getElementById('payGrid');
  if (!PAY_METHODS.length) { grid.innerHTML = '<p class="cart-empty">لا توجد طرق دفع مفعّلة</p>'; return; }
  grid.innerHTML = PAY_METHODS.map(pm => `<button class="pay-btn" data-pm="${pm._id}">💳 ${pm.name}</button>`).join('');
}
document.getElementById('payGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-pm]');
  if (!btn) return;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedPmId = btn.dataset.pm;
  const pm = PAY_METHODS.find(p => p._id === selectedPmId);
  document.getElementById('payAccount').innerHTML =
    `📲 حوّل المبلغ إلى: <b>${pm.account}</b>${pm.instructions ? '<br>📝 ' + pm.instructions : ''}<br>ثم ارفع صورة السند 👇`;
});

/* ---------------- إتمام الطلب ---------------- */
document.getElementById('checkoutBtn').addEventListener('click', async () => {
  if (!cart.length) return showToast('⚠️ السلة فارغة');
  if (!API.user()) { closeCart(); openAuth('login'); return showToast('⚠️ سجّل الدخول أولاً'); }
  if (!selectedPmId) return showToast('⚠️ اختر طريقة الدفع');
  const receipt = document.getElementById('receiptInput').files[0];
  if (!receipt) return showToast('⚠️ صورة سند الحوالة مطلوبة 📎');

  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true; btn.textContent = '⏳ جارٍ الإرسال...';
  try {
    const form = new FormData();
    form.append('items', JSON.stringify(cart.map(i => ({ id: i.id, qty: i.qty, extra: i.extra }))));
    form.append('paymentMethodId', selectedPmId);
    form.append('receipt', receipt);
    const res = await API.req('/orders', { method: 'POST', form });
    cart = []; saveCart(); renderCart();
    document.getElementById('receiptInput').value = '';
    closeCart();
    showToast(`🎉 تم إرسال طلبك ${res.code} — قيد المراجعة`);
  } catch (e) { showToast('❌ ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'تأكيد الطلب ✅'; }
});

/* ================================================================ */
/* ============ المصادقة (دخول / تسجيل + OTP / استعادة) ============ */
/* ================================================================ */
const authModal = document.getElementById('authModal');
const authForms = { login: 'loginForm', register: 'registerForm', forgot: 'forgotForm', otp: 'otpForm', reset: 'resetForm' };

function openAuth(which = 'login') {
  authModal.classList.add('open');
  showAuthForm(which);
}
function showAuthForm(which) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(authForms[which]).classList.add('active');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === which));
}

/* زر الحساب في الشريط: يفتح الملف الشخصي إن كان مسجلاً، وإلا يفتح الدخول */
document.getElementById('loginBtn').addEventListener('click', () => {
  API.user() ? openProfile() : openAuth('login');
});

authModal.addEventListener('click', e => { if (e.target === authModal) authModal.classList.remove('open'); });
document.querySelector('[data-close="authModal"]').addEventListener('click', () => authModal.classList.remove('open'));

document.getElementById('authTabs').addEventListener('click', e => {
  const tab = e.target.closest('.auth-tab');
  if (tab) showAuthForm(tab.dataset.tab);
});
document.querySelectorAll('[data-goto]').forEach(el =>
  el.addEventListener('click', e => { e.preventDefault(); showAuthForm(el.dataset.goto); }));

document.getElementById('forgotLink').addEventListener('click', e => { e.preventDefault(); showAuthForm('forgot'); });

/* --- OTP: تحكم الحقول الستة، مؤقت 60 ثانية، ورابط واتساب --- */
let otpState = { purpose: '', phone: '', payload: null, timer: null };
const otpInputs = document.querySelectorAll('#otpInputs input');
otpInputs.forEach((inp, idx) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
    if (inp.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    document.getElementById('otpCode').value = [...otpInputs].map(i => i.value).join('');
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !inp.value && idx > 0) otpInputs[idx - 1].focus();
  });
  inp.addEventListener('paste', e => {
    const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    if (!t) return;
    e.preventDefault();
    [...t].forEach((ch, i) => { if (otpInputs[i]) otpInputs[i].value = ch; });
    document.getElementById('otpCode').value = t;
    otpInputs[Math.min(t.length, 5)].focus();
  });
});

function startOtpTimer(sec = 60) {
  const t = document.getElementById('otpTimer'), r = document.getElementById('otpResend');
  r.classList.add('hidden'); t.classList.remove('hidden');
  clearInterval(otpState.timer);
  let s = sec;
  const tick = () => {
    t.innerHTML = `إعادة الإرسال متاحة بعد <b>${s}</b> ثانية`;
    if (--s < 0) { clearInterval(otpState.timer); t.classList.add('hidden'); r.classList.remove('hidden'); }
  };
  tick(); otpState.timer = setInterval(tick, 1000);
}

async function requestOtp(purpose, phone, payload) {
  otpState = { purpose, phone, payload: payload || null, timer: null };
  try {
    const body = { phone, purpose, ...(payload || {}) };
    const res = await API.req('/auth/send-otp', { method: 'POST', body });
    document.getElementById('otpHint').innerHTML =
      `أُرسل رمز مكوّن من 6 أرقام إلى الرقم <b>${phone}</b><br>صالح 10 دقائق`;
    document.getElementById('otpWaLink').href = res.whatsappUrl || '#';
    otpInputs.forEach(i => i.value = ''); document.getElementById('otpCode').value = '';
    showAuthForm('otp'); otpInputs[0].focus(); startOtpTimer(60);
  } catch (e) { showToast('❌ ' + e.message); }
}

document.getElementById('otpResend').addEventListener('click', e => {
  e.preventDefault();
  requestOtp(otpState.purpose, otpState.phone, otpState.payload);
});

/* تسجيل مستخدم جديد → طلب OTP */
document.getElementById('registerForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.replace(/\D/g, '');
  const password = document.getElementById('regPass').value;
  if (!name || !phone || password.length < 6) return showToast('⚠️ عبّئ الحقول بشكل صحيح');
  requestOtp('register', phone, { name, password });
});

/* استعادة كلمة المرور → طلب OTP */
document.getElementById('forgotForm').addEventListener('submit', e => {
  e.preventDefault();
  const phone = document.getElementById('forgotPhone').value.replace(/\D/g, '');
  requestOtp('reset', phone);
});

/* التحقق من OTP */
document.getElementById('otpForm').addEventListener('submit', async e => {
  e.preventDefault();
  const code = document.getElementById('otpCode').value;
  if (code.length !== 6) return showToast('⚠️ أدخل الأرقام الستة');
  try {
    if (otpState.purpose === 'register') {
      const { token, user } = await API.req('/auth/verify-otp', {
        method: 'POST', body: { phone: otpState.phone, code, purpose: 'register' },
      });
      API.setSession(token, user); authModal.classList.remove('open');
      updateUserChip();
      showToast(`🎉 أهلاً ${user.name} — تم تفعيل حسابك`);
    } else {
      await API.req('/auth/verify-otp', {
        method: 'POST', body: { phone: otpState.phone, code, purpose: 'reset' },
      });
      showAuthForm('reset');
    }
  } catch (err) { showToast('❌ ' + err.message); }
});

/* تعيين كلمة مرور جديدة بعد OTP */
document.getElementById('resetForm').addEventListener('submit', async e => {
  e.preventDefault();
  const p1 = document.getElementById('resetPass').value;
  const p2 = document.getElementById('resetPass2').value;
  if (p1 !== p2) return showToast('⚠️ كلمتا المرور غير متطابقتين');
  try {
    const { token, user } = await API.req('/auth/reset-password', {
      method: 'POST',
      body: { phone: otpState.phone, code: document.getElementById('otpCode').value, password: p1 },
    });
    API.setSession(token, user); authModal.classList.remove('open');
    updateUserChip();
    showToast('✅ تم تحديث كلمة المرور وتسجيل الدخول');
  } catch (err) { showToast('❌ ' + err.message); }
});

/* تسجيل الدخول العادي */
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { token, user } = await API.req('/auth/login', {
      method: 'POST',
      body: { phone: document.getElementById('loginPhone').value, password: document.getElementById('loginPass').value },
    });
    API.setSession(token, user); authModal.classList.remove('open');
    updateUserChip();
    showToast(user.role === 'admin' ? `⚙️ أهلاً بالمدير — ادخل من admin.html` : `👋 أهلاً ${user.name}`);
  } catch (err) { showToast('❌ ' + err.message); }
});

/* شريحة المستخدم في الـ Navbar */
function updateUserChip() {
  const u = API.user();
  const chip = document.getElementById('loginBtn');
  const name = document.getElementById('userChipName');
  const icon = document.getElementById('userChipIcon');
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

/* ================================================================ */
/* ========================= الملف الشخصي ========================= */
/* ================================================================ */
const profileModal = document.getElementById('profileModal');
async function openProfile() {
  const u = API.user();
  if (!u) return openAuth('login');
  document.getElementById('pfName').value = u.name;
  document.getElementById('pfPhone').value = u.phone;
  profileModal.classList.add('open');
  showPPage('info');
  loadMyOrders();
}
function showPPage(page) {
  document.querySelectorAll('#profileModal .auth-tab').forEach(t => t.classList.toggle('active', t.dataset.ptab === page));
  document.querySelectorAll('.profile-form').forEach(f => f.classList.toggle('active', f.dataset.ppage === page));
}
profileModal.addEventListener('click', e => {
  if (e.target === profileModal) profileModal.classList.remove('open');
  const tab = e.target.closest('[data-ptab]');
  if (tab) showPPage(tab.dataset.ptab);
});
document.querySelector('[data-close="profileModal"]').addEventListener('click', () => profileModal.classList.remove('open'));

document.getElementById('profileInfoForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { user } = await API.req('/users/profile', {
      method: 'PUT',
      body: { name: document.getElementById('pfName').value, phone: document.getElementById('pfPhone').value },
    });
    API.setSession(API.token(), user); updateUserChip();
    showToast('✅ تم تحديث البيانات');
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('profilePassForm').addEventListener('submit', async e => {
  e.preventDefault();
  const cur = document.getElementById('pfCur').value;
  const n1 = document.getElementById('pfNew').value;
  const n2 = document.getElementById('pfNew2').value;
  if (n1 !== n2) return showToast('⚠️ كلمتا المرور غير متطابقتين');
  try {
    await API.req('/users/change-password', { method: 'PUT', body: { current: cur, next: n1 } });
    e.target.reset();
    showToast('✅ تم تحديث كلمة المرور');
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  API.clearSession(); profileModal.classList.remove('open');
  updateUserChip(); showToast('👋 تم تسجيل الخروج');
});

async function loadMyOrders() {
  const tbody = document.querySelector('#myOrdersTable tbody');
  try {
    const orders = await API.req('/orders/my-orders');
    const STATUS_CLASS = { 'قيد المراجعة': 'status-review', 'مكتمل': 'status-done', 'ملغي': 'status-cancel' };
    tbody.innerHTML = orders.length ? orders.map(o => `
      <tr>
        <td><b>${o.code}</b></td>
        <td>${o.items.map(i => `${i.name} ×${i.qty}`).join('، ')}</td>
        <td>${new Date(o.createdAt).toLocaleDateString('ar')}</td>
        <td><span class="status-badge ${STATUS_CLASS[o.status]}">${o.status}</span></td>
      </tr>`).join('')
      : '<tr><td colspan="4" class="empty-row">لا توجد طلبات بعد</td></tr>';
  } catch { tbody.innerHTML = '<tr><td colspan="4" class="empty-row">تعذر جلب الطلبات</td></tr>'; }
}

/* ================================================================ */
/* ========== نافذة "تواصل للاتفاق" للخدمات الاستشارية ============= */
/* ================================================================ */
const inquireModal = document.getElementById('inquireModal');
inquireModal.addEventListener('click', e => { if (e.target === inquireModal) inquireModal.classList.remove('open'); });
document.querySelector('[data-close="inquireModal"]').addEventListener('click', () => inquireModal.classList.remove('open'));

async function openInquiry(id) {
  const svc = COURSES.find(c => c._id === id);
  if (!svc) return;
  document.getElementById('inqServiceName').textContent = svc.name;
  inquireModal.classList.add('open');

  // روابط أولية من إعدادات الموقع
  const text = encodeURIComponent(`السلام عليكم، أرغب بالاتفاق على خدمة: ${svc.name}`);
  const wa = (SITE.whatsapp || '').replace(/\D/g, '');
  const tg = (SITE.telegram || '').replace(/^@/, '');
  document.getElementById('inqWa').href = wa ? `https://wa.me/${wa}?text=${text}` : '#';
  document.getElementById('inqTg').href = tg ? `https://t.me/${tg}` : '#';

  // إخطار الأدمن فوراً + استلام روابط جاهزة من الخادم
  const clickHandler = async () => {
    try {
      const res = await API.req('/inquiries', {
        method: 'POST',
        body: {
          serviceName: svc.name,
          name: document.getElementById('inqName').value,
          phone: document.getElementById('inqPhone').value,
        },
      });
      if (res.whatsappUrl) document.getElementById('inqWa').href = res.whatsappUrl + '';
    } catch { /* لا نمنع فتح واتساب لو فشل الإخطار */ }
  };
  document.getElementById('inqWa').onclick = clickHandler;
  document.getElementById('inqTg').onclick = clickHandler;
}

/* ================================================================ */
/* =========================== Toast ============================== */
/* ================================================================ */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ---------------- عدّادات + متفرقات ---------------- */
const counters = document.querySelectorAll('[data-count]');
const co = new IntersectionObserver(entries => entries.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target, target = +el.dataset.count; let cur = 0;
  const step = Math.max(1, Math.ceil(target / 60));
  const tick = () => { cur += step; if (cur >= target) { el.textContent = target + '+'; return; } el.textContent = cur; requestAnimationFrame(tick); };
  tick(); co.unobserve(el);
}), { threshold: .5 });
counters.forEach(c => co.observe(c));

document.getElementById('year').textContent = new Date().getFullYear();
const sections = ['home', 'store', 'courses'];
window.addEventListener('scroll', () => {
  let current = 'home';
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 120) current = id;
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + current));
}, { passive: true });

loadAll();
