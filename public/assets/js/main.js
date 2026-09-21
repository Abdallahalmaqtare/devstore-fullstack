/* ============================================================
   DevStore — واجهة المتجر المتصلة بالـ API الحقيقي
   ============================================================ */

let PRODUCTS = [], COURSES = [], PAY_METHODS = [];
let cart = JSON.parse(localStorage.getItem('ds-cart') || '[]');
let selectedPmId = '';

const COUNTRIES = [
  ['🇺🇸', 'أمريكا (+1)'], ['🇬🇧', 'بريطانيا (+44)'], ['🇷🇺', 'روسيا (+7)'],
  ['🇮🇳', 'الهند (+91)'], ['🇮🇩', 'إندونيسيا (+62)'], ['🇵🇰', 'باكستان (+92)'],
  ['🇪🇬', 'مصر (+20)'], ['🇸🇦', 'السعودية (+966)'], ['🇦🇪', 'الإمارات (+971)'],
];
const CAT_LABELS = { games: '🎮 شحن الألعاب', numbers: '📱 أرقام وهمية', tools: '🛠️ أدوات وصيانة' };

/* ---------------- جلب البيانات من الخادم ---------------- */
async function loadStore() {
  try {
    const [store, courses, pms] = await Promise.all([
      API.req('/products'),
      API.req('/products?cat=courses'),
      API.req('/settings/payment-methods'),
    ]);
    PRODUCTS = store.filter(p => p.cat !== 'courses');
    COURSES = courses;
    PAY_METHODS = pms;
    renderProducts(currentFilter);
    renderCourses();
    renderPayMethods();
  } catch (e) {
    showToast('⚠️ تعذر الاتصال بالخادم: ' + e.message);
  }
}

/* ---------------- الوضع الليلي ---------------- */
document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('tg-theme', next);
});

/* ---------------- قائمة الجوال ---------------- */
const navLinks = document.getElementById('navLinks');
document.getElementById('menuBtn').addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

/* ---------------- عرض المنتجات ---------------- */
const productsGrid = document.getElementById('productsGrid');
let currentFilter = 'all';

function renderProducts(filter = 'all') {
  currentFilter = filter;
  const list = PRODUCTS.filter(p => filter === 'all' || p.cat === filter);
  productsGrid.innerHTML = list.length ? list.map(p => `
    <article class="product-card">
      <div class="product-icon">${p.icon}</div>
      <span class="product-cat">${CAT_LABELS[p.cat] || ''}</span>
      <h3 class="product-name">${p.name}</h3>
      <p class="product-desc">${p.desc || ''}</p>
      ${p.countrySelect ? `
        <div class="product-extra">
          <select id="country-${p._id}" aria-label="اختر الدولة">
            <option value="">اختر الدولة 🌍</option>
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

/* ---------------- عرض الدورات ---------------- */
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
          <div class="course-price">$${c.price}</div>
          <button class="buy-btn" data-buy="${c._id}">التحق الآن 🎓</button>
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
const getItemInfo = id => [...PRODUCTS, ...COURSES].find(p => p._id === id);

function addToCart(id) {
  const product = getItemInfo(id);
  if (!product) return;
  let extra = '';
  if (product.countrySelect) {
    const sel = document.getElementById(`country-${id}`);
    if (!sel?.value) { showToast('⚠️ الرجاء اختيار الدولة أولاً'); sel?.focus(); return; }
    extra = sel.value;
  }
  const key = extra ? `${id}|${extra}` : id;
  const found = cart.find(i => i.key === key);
  found ? found.qty++ : cart.push({ key, id, extra, qty: 1, name: product.name, price: product.price, icon: product.icon });
  saveCart(); renderCart();
  showToast(`✅ تمت إضافة «${product.name}» إلى السلة`);
}

function renderCart() {
  cartBadge.textContent = cart.reduce((s, i) => s + i.qty, 0);
  if (!cart.length) {
    cartItemsEl.innerHTML = '<p class="cart-empty">سلتك فارغة حالياً.. تصفح المتجر وأضف ما يعجبك 🛍️</p>';
    cartTotal.textContent = '$0.00';
    return;
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

/* ---------------- طرق الدفع الديناميكية + سند الحوالة ---------------- */
function renderPayMethods() {
  const grid = document.getElementById('payGrid');
  const info = document.getElementById('payAccount');
  if (!PAY_METHODS.length) {
    grid.innerHTML = '<p class="cart-empty">لا توجد طرق دفع مفعّلة — تواصل مع الدعم</p>';
    info.textContent = '';
    return;
  }
  grid.innerHTML = PAY_METHODS.map(pm =>
    `<button class="pay-btn" data-pm="${pm._id}">💳 ${pm.name}</button>`).join('');
}

document.getElementById('payGrid').addEventListener('click', e => {
  const btn = e.target.closest('[data-pm]');
  if (!btn) return;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedPmId = btn.dataset.pm;
  const pm = PAY_METHODS.find(p => p._id === selectedPmId);
  document.getElementById('payAccount').innerHTML =
    `📲 حوّل المبلغ إلى: <b>${pm.account}</b>${pm.instructions ? '<br>📝 ' + pm.instructions : ''}<br>ثم ارفع صورة السند بالأسفل 👇`;
});

/* ---------------- إتمام الطلب (إرسال للخادم + رفع السند) ---------------- */
document.getElementById('checkoutBtn').addEventListener('click', async () => {
  if (!cart.length) return showToast('⚠️ السلة فارغة');
  if (!API.user()) { closeCart(); authModal.classList.add('open'); return showToast('⚠️ سجّل الدخول أولاً لإتمام الطلب'); }
  if (!selectedPmId) return showToast('⚠️ اختر طريقة الدفع أولاً');
  const receipt = document.getElementById('receiptInput').files[0];
  if (!receipt) return showToast('⚠️ صورة سند الحوالة مطلوبة 📎');

  const btn = document.getElementById('checkoutBtn');
  btn.disabled = true; btn.textContent = '⏳ جارٍ إرسال الطلب...';
  try {
    const form = new FormData();
    form.append('items', JSON.stringify(cart.map(i => ({ id: i.id, qty: i.qty, extra: i.extra }))));
    form.append('paymentMethodId', selectedPmId);
    form.append('receipt', receipt);
    const res = await API.req('/orders', { method: 'POST', form });
    cart = []; saveCart(); renderCart();
    document.getElementById('receiptInput').value = '';
    closeCart();
    showToast(`🎉 تم إرسال طلبك ${res.code} — قيد المراجعة من الإدارة`);
  } catch (e) {
    showToast('❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'تأكيد الطلب ✅';
  }
});

/* ---------------- المصادقة ---------------- */
const authModal = document.getElementById('authModal');
document.getElementById('loginBtn').addEventListener('click', () => {
  const u = API.user();
  if (u) {
    if (confirm(`${u.name} — هل تريد تسجيل الخروج؟`)) { API.clearSession(); showToast('👋 تم تسجيل الخروج'); }
    return;
  }
  authModal.classList.add('open');
});
authModal.addEventListener('click', e => { if (e.target === authModal) authModal.classList.remove('open'); });
document.querySelector('[data-close="authModal"]').addEventListener('click', () => authModal.classList.remove('open'));

document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
}));

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { token, user } = await API.req('/auth/login', {
      method: 'POST',
      body: { phone: document.getElementById('loginPhone').value, password: document.getElementById('loginPass').value },
    });
    API.setSession(token, user);
    authModal.classList.remove('open');
    showToast(user.role === 'admin' ? `⚙️ مرحباً أيها المدير! لوحة التحكم: admin.html` : `👋 أهلاً ${user.name}`);
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { token, user } = await API.req('/auth/register', {
      method: 'POST',
      body: {
        name: document.getElementById('regName').value,
        phone: document.getElementById('regPhone').value,
        password: document.getElementById('regPass').value,
      },
    });
    API.setSession(token, user);
    authModal.classList.remove('open');
    showToast(`🎉 أهلاً بك ${user.name} — تم إنشاء حسابك`);
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- Toast ---------------- */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ---------------- عدّادات Hero + متفرقات ---------------- */
const counters = document.querySelectorAll('[data-count]');
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target, target = +el.dataset.count;
    let cur = 0; const step = Math.max(1, Math.ceil(target / 60));
    const tick = () => { cur += step; if (cur >= target) { el.textContent = target + '+'; return; } el.textContent = cur; requestAnimationFrame(tick); };
    tick(); counterObserver.unobserve(el);
  });
}, { threshold: .5 });
counters.forEach(c => counterObserver.observe(c));

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

/* ---------------- التشغيل ---------------- */
loadStore();
