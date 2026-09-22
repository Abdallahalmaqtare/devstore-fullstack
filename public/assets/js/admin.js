/* ============================================================
   DevStore Admin — v6 (مجموعات وباقات + قنوات منسق الخدمة)
   ============================================================ */

let CAT_LABELS = {}; /* تُملأ ديناميكياً من مجموعة categories */
const STATUS_FLOW = ['قيد المراجعة', 'مكتمل', 'ملغي'];
const STATUS_CLASS = { 'قيد المراجعة': 'status-review', 'مكتمل': 'status-done', 'ملغي': 'status-cancel' };

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ---------------- شاشة دخول الأدمن ---------------- */
const loginScreen = document.getElementById('adminLoginScreen');
const app = document.getElementById('adminApp');

function showLogin() { loginScreen.classList.remove('hidden'); app.classList.add('hidden'); }
function showApp() {
  loginScreen.classList.add('hidden'); app.classList.remove('hidden');
  const u = API.user();
  document.getElementById('adminNameChip').textContent = '👑 ' + (u?.name || 'المدير');
  bootAdmin();
}

async function verifyAdmin() {
  const u = API.user();
  if (!API.token() || !u || u.role !== 'admin') return showLogin();
  try {
    const { user } = await API.req('/auth/me');
    if (user.role !== 'admin') { API.clearSession(); return showLogin(); }
    API.setSession(API.token(), user, true);
    showApp();
  } catch { showLogin(); }
}
verifyAdmin();

document.getElementById('adminLoginForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { token, user } = await API.req('/auth/admin-login', {
      method: 'POST',
      body: {
        phone: normalizePhone(document.getElementById('adLoginPhone').value),
        password: document.getElementById('adLoginPass').value,
      },
    });
    API.setSession(token, user, true);
    showToast(`👑 أهلاً ${user.name}`);
    showApp();
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- تشغيل اللوحة ---------------- */
function bootAdmin() {
  document.getElementById('adminLogout').addEventListener('click', () => {
    API.clearSession(); showLogin();
  }, { once: true });

  document.getElementById('adminThemeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('tg-theme', next);
  });

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const pageTitles = {
    dashboard: '📊 الرئيسية', products: '🛍️ المنتجات والخدمات', categories: '🗂️ إدارة الأقسام',
    orders: '📦 إدارة الطلبات', users: '👥 إدارة المستخدمين', admins: '🛡️ إدارة المسؤولين', settings: '⚙️ الإعدادات',
  };
  document.querySelectorAll('.side-link').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.side-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    link.classList.add('active');
    document.getElementById('page-' + link.dataset.page).classList.add('active');
    document.getElementById('pageTitle').textContent = pageTitles[link.dataset.page];
    sidebar.classList.remove('open'); sidebarOverlay.classList.remove('open');
  }));
  document.getElementById('sideMenuBtn').addEventListener('click', () => { sidebar.classList.add('open'); sidebarOverlay.classList.add('open'); });
  sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('open'); });

  renderDashboard(); renderProducts(); renderOrders(); renderUsers(); renderPayMethods(); loadSiteSettings(); loadCategories(); renderCurrencies(); loadAdmins();
}

/* ---------------- الإحصائيات ---------------- */
async function renderDashboard() {
  try {
    const [orders, users, products] = await Promise.all([
      API.req('/orders'), API.req('/auth/users'), API.req('/products/all'),
    ]);
    const revenue = orders.filter(o => o.status !== 'ملغي').reduce((s, o) => s + o.total, 0);
    document.getElementById('statRevenue').textContent = '$' + revenue.toFixed(2);
    document.getElementById('statOrders').textContent = orders.filter(o => o.status === 'قيد المراجعة').length;
    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statProducts').textContent = products.length;
    document.querySelector('#recentOrdersTable tbody').innerHTML = orders.slice(0, 5).map(o => `
      <tr><td><b>${o.code}</b></td><td>${new Date(o.createdAt).toLocaleString('ar')}</td>
      <td>$${o.total.toFixed(2)}</td>
      <td><span class="status-badge ${STATUS_CLASS[o.status]}">${o.status}</span></td></tr>`).join('')
      || '<tr><td colspan="4" class="empty-row">لا توجد طلبات بعد</td></tr>';
  } catch (e) { showToast('❌ ' + e.message); }
}

/* ---------------- محرر الباقات ديناميكياً ---------------- */
const variantRows = document.getElementById('variantRows');

function addVariantRow(v = {}) {
  const row = document.createElement('div');
  row.className = 'variant-edit-row';
  row.innerHTML = `
    <input type="text" class="v-name" placeholder="اسم الباقة — مثال: 100 جوهرة" value="${v.name || ''}" />
    <input type="number" class="v-price" step="0.01" min="0" placeholder="السعر $" value="${v.price ?? ''}" />
    <input type="text" class="v-icon" placeholder="🎁" value="${v.icon || ''}" style="max-width:64px" />
    <button type="button" class="row-btn row-del v-remove">✕</button>`;
  row.querySelector('.v-remove').addEventListener('click', () => row.remove());
  variantRows.appendChild(row);
}
document.getElementById('addVariantBtn').addEventListener('click', () => addVariantRow());

function getVariants() {
  return [...variantRows.querySelectorAll('.variant-edit-row')].map(r => ({
    name: r.querySelector('.v-name').value.trim(),
    price: parseFloat(r.querySelector('.v-price').value),
    icon: r.querySelector('.v-icon').value.trim(),
  })).filter(v => v.name && !isNaN(v.price));
}

/* إظهار/إخفاء الحقول حسب النوع */
const pTypeSel = document.getElementById('pType');
function syncTypeFields() {
  const isService = pTypeSel.value === 'service';
  document.getElementById('productFields').classList.toggle('hidden', isService);
  document.getElementById('serviceFields').classList.toggle('hidden', !isService);
}
pTypeSel.addEventListener('change', syncTypeFields);
syncTypeFields();

/* ---------------- المنتجات/الخدمات ---------------- */
async function renderProducts() {
  try {
    const products = await API.req('/products/all');
    document.querySelector('#productsTable tbody').innerHTML = products.length ? products.map(p => {
      const isGroup = (p.variants || []).length > 0;
      const contact = p.type === 'service'
        ? (p.contactWhatsapp || p.contactTelegram ? '✅ منسق خاص' : '🌐 الدعم العام')
        : '—';
      return `
      <tr>
        <td>${p.image ? '<img class="table-thumb" src="' + p.image + '" alt="" />' : (p.icon || '📦')} <b>${p.name}</b></td>
        <td>${p.type === 'service' ? '💬 خدمة' : isGroup ? '📦 مجموعة' : '🛒 سلعة'}</td>
        <td>${CAT_LABELS[p.cat] || p.cat}</td>
        <td>${p.type === 'service' ? '—' : isGroup ? `${p.variants.length} باقة (من $${Math.min(...p.variants.map(v => v.price)).toFixed(2)})` : '$' + (+p.price).toFixed(2)}</td>
        <td>${contact}</td>
        <td class="row-actions">
          <button class="row-btn row-edit" data-edit='${JSON.stringify(p).replace(/'/g, "&#39;")}'>✏️ تعديل</button>
          <button class="row-btn row-del" data-del="${p._id}">🗑️ حذف</button>
        </td>
      </tr>`;
    }).join('')
      : '<tr><td colspan="6" class="empty-row">لا توجد عناصر — أضف من الأعلى</td></tr>';
  } catch (e) { showToast('❌ ' + e.message); }
}

document.getElementById('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const type = pTypeSel.value;
  const cat = document.getElementById('pCat').value;
  const variants = getVariants();
  const body = {
    name: document.getElementById('pName').value.trim(),
    type, cat,
    price: type === 'service' ? 0 : parseFloat(document.getElementById('pPrice').value || 0),
    variants: type === 'service' ? [] : variants,
    icon: document.getElementById('pIcon').value.trim() || '📦',
    unit: document.getElementById('pUnit').value.trim(),
    desc: document.getElementById('pDesc').value.trim(),
    countrySelect: type === 'product' && cat === 'numbers',
    requiresAccountId: type === 'product' && document.getElementById('pReqId').checked,
    isOnSale: document.getElementById('pOnSale').checked,
    discountPercent: parseFloat(document.getElementById('pDisc').value || 0),
    modes: type === 'service' ? ['online', 'onsite'] : [],
    meta: type === 'service' ? document.getElementById('pMeta').value.trim() : document.getElementById('pUnit').value.trim(),
    contactWhatsapp: type === 'service' ? normalizePhone(document.getElementById('pContactWa').value) : '',
    contactTelegram: type === 'service' ? document.getElementById('pContactTg').value.replace(/^@/, '').trim() : '',
  };
  if (type === 'product' && !variants.length && !body.price)
    return showToast('⚠️ أدخل سعراً للسلعة أو أضف باقات للمجموعة');
  try {
    const imgFile = document.getElementById('pImageFile').files[0];
    if (imgFile) {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => fd.append(k, Array.isArray(v) ? JSON.stringify(v) : v));
      fd.append('image', imgFile);
      if (id) await API.req('/products/' + id, { method: 'PUT', form: fd });
      else await API.req('/products', { method: 'POST', form: fd });
    } else {
      if (id) await API.req('/products/' + id, { method: 'PUT', body });
      else await API.req('/products', { method: 'POST', body });
    }
    resetProductForm();
    renderProducts(); renderDashboard();
    showToast(id ? '✅ تم التحديث' : '✅ تمت الإضافة');
  } catch (err) { showToast('❌ ' + err.message); }
});

function resetProductForm() {
  document.getElementById('productForm').reset();
  document.getElementById('pId').value = '';
  document.getElementById('pReqId').checked = false;
  variantRows.innerHTML = '';
  document.getElementById('pImageFile').value = '';
  const _prev = document.getElementById('pImagePreview');
  _prev.classList.add('hidden'); _prev.innerHTML = '';
  syncTypeFields();
}

/* معاينة فورية للصورة المختارة من الجهاز */
document.getElementById('pImageFile').addEventListener('change', e => {
  const f = e.target.files[0];
  const prev = document.getElementById('pImagePreview');
  if (!f) { prev.classList.add('hidden'); prev.innerHTML = ''; return; }
  const rd = new FileReader();
  rd.onload = () => {
    prev.innerHTML = '<img src="' + rd.result + '" alt="" /><small>معاينة — ستُرفع إلى السحابة عند الحفظ</small>';
    prev.classList.remove('hidden');
  };
  rd.readAsDataURL(f);
});
document.getElementById('pReset').addEventListener('click', resetProductForm);

document.getElementById('productsTable').addEventListener('click', async e => {
  const editBtn = e.target.closest('[data-edit]');
  const delBtn = e.target.closest('[data-del]');
  if (editBtn) {
    const p = JSON.parse(editBtn.dataset.edit);
    document.getElementById('pId').value = p._id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pType').value = p.type || 'product';
    document.getElementById('pCat').value = p.cat;
    document.getElementById('pPrice').value = p.price || '';
    document.getElementById('pIcon').value = p.icon || '';
    document.getElementById('pUnit').value = p.unit || '';
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pReqId').checked = !!p.requiresAccountId;
    document.getElementById('pOnSale').checked = !!p.isOnSale;
    document.getElementById('pDisc').value = p.discountPercent || '';
    document.getElementById('pImageFile').value = '';
    const _pv = document.getElementById('pImagePreview');
    if (p.image) {
      _pv.innerHTML = '<img src="' + p.image + '" alt="" /><small>الصورة الحالية — اختر ملفاً جديداً للاستبدال</small>';
      _pv.classList.remove('hidden');
    } else { _pv.classList.add('hidden'); _pv.innerHTML = ''; }
    document.getElementById('pMeta').value = p.meta || '';
    document.getElementById('pContactWa').value = p.contactWhatsapp || '';
    document.getElementById('pContactTg').value = p.contactTelegram || '';
    variantRows.innerHTML = '';
    (p.variants || []).forEach(v => addVariantRow(v));
    syncTypeFields();
    document.getElementById('pName').focus();
    showToast('✏️ وضع التعديل — عدّل ثم اضغط حفظ');
  }
  if (delBtn && confirm('حذف هذا العنصر نهائياً؟')) {
    try {
      await API.req('/products/' + delBtn.dataset.del, { method: 'DELETE' });
      renderProducts(); renderDashboard(); showToast('🗑️ تم الحذف');
    } catch (err) { showToast('❌ ' + err.message); }
  }
});

/* ---------------- الطلبات ---------------- */
async function renderOrders() {
  try {
    const orders = await API.req('/orders');
    document.querySelector('#ordersTable tbody').innerHTML = orders.length ? orders.map(o => `
      <tr>
        <td><b>${o.code}</b><br><small>${o.customerName} — ${o.customerPhone}</small></td>
        <td>${o.items.map(i =>
          `${i.name} ×${i.qty}${i.extra ? ` (${i.extra})` : ''}${i.accountId ? `<br>🆔 <b dir="ltr">${i.accountId}</b>` : ''}`
        ).join('<hr style="border-color:var(--border);margin:4px 0">')}</td>
        <td>$${o.total.toFixed(2)}</td>
        <td>${o.paymentMethod?.name || '—'}</td>
        <td>${new Date(o.createdAt).toLocaleString('ar')}</td>
        <td>${o.receiptUrl ? `<a href="${o.receiptUrl}" target="_blank" rel="noopener">🧾 السند</a>` : '—'}</td>
        <td><button class="status-badge ${STATUS_CLASS[o.status]}" data-order="${o._id}" data-status="${o.status}">${o.status}</button></td>
      </tr>`).join('')
      : '<tr><td colspan="7" class="empty-row">لا توجد طلبات بعد</td></tr>';
  } catch (e) { showToast('❌ ' + e.message); }
}
document.getElementById('ordersTable').addEventListener('click', async e => {
  const btn = e.target.closest('[data-order]');
  if (!btn) return;
  const next = STATUS_FLOW[(STATUS_FLOW.indexOf(btn.dataset.status) + 1) % STATUS_FLOW.length];
  try {
    await API.req(`/orders/${btn.dataset.order}/status`, { method: 'PUT', body: { status: next } });
    renderOrders(); renderDashboard();
    showToast(`🔄 الحالة: ${next}`);
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- المستخدمون ---------------- */
async function renderUsers() {
  try {
    const users = await API.req('/auth/users');
    document.querySelector('#usersTable tbody').innerHTML = users.map(u => `
      <tr>
        <td><b>${u.name}</b>${u.role === 'admin' ? ' 👑' : ''}</td>
        <td dir="ltr">${u.phone}</td><td>${u.date || ''}</td><td>${u.orders}</td>
        <td>${u.role === 'admin' ? '—' : `<button class="status-badge ${u.active ? 'status-done' : 'status-cancel'}" data-user="${u.id}">${u.active ? 'نشط' : 'موقوف'}</button>`}</td>
        <td>${u.role === 'admin' ? '—' : `<button class="row-btn row-del" data-userdel="${u.id}" title="حذف نهائي">🗑️</button>`}</td>
      </tr>`).join('');
  } catch (e) { showToast('❌ ' + e.message); }
}
document.getElementById('usersTable').addEventListener('click', async e => {
  const udel = e.target.closest('[data-userdel]');
  if (udel) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً من قاعدة البيانات؟')) return;
    try {
      await API.req('/admin/users/' + udel.dataset.userdel, { method: 'DELETE' });
      renderUsers(); renderDashboard();
      showToast('🗑️ تم حذف المستخدم نهائياً');
    } catch (err) { showToast('❌ ' + err.message); }
    return;
  }
  const btn = e.target.closest('[data-user]');
  if (!btn) return;
  try {
    const r = await API.req(`/auth/users/${btn.dataset.user}/toggle`, { method: 'PUT' });
    renderUsers(); showToast(r.active ? '✅ تفعيل' : '⛔ إيقاف');
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- طرق الدفع ---------------- */
async function renderPayMethods() {
  try {
    const pms = await API.req('/settings/payment-methods/all');
    document.querySelector('#pmTable tbody').innerHTML = pms.length ? pms.map(pm => `
      <tr>
        <td><b>${pm.name}</b></td><td>${pm.account}</td><td>${pm.instructions || '—'}</td>
        <td><button class="status-badge ${pm.active ? 'status-done' : 'status-cancel'}" data-pmtoggle="${pm._id}" data-active="${pm.active}">${pm.active ? 'مفعّلة' : 'معطّلة'}</button></td>
        <td><button class="row-btn row-del" data-pmdel="${pm._id}">🗑️</button></td>
      </tr>`).join('')
      : '<tr><td colspan="5" class="empty-row">أضف أول طريقة دفع</td></tr>';
  } catch (e) { showToast('❌ ' + e.message); }
}
document.getElementById('pmForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await API.req('/settings/payment-methods', {
      method: 'POST',
      body: {
        name: document.getElementById('pmName').value.trim(),
        account: document.getElementById('pmAccount').value.trim(),
        instructions: document.getElementById('pmInstructions').value.trim(),
      },
    });
    e.target.reset(); renderPayMethods();
    showToast('✅ تمت الإضافة');
  } catch (err) { showToast('❌ ' + err.message); }
});
document.getElementById('pmTable').addEventListener('click', async e => {
  const toggle = e.target.closest('[data-pmtoggle]');
  const del = e.target.closest('[data-pmdel]');
  try {
    if (toggle) {
      await API.req('/settings/payment-methods/' + toggle.dataset.pmtoggle, {
        method: 'PUT', body: { active: toggle.dataset.active !== 'true' },
      });
      renderPayMethods(); showToast('🔄 تم التحديث');
    }
    if (del && confirm('حذف؟')) {
      await API.req('/settings/payment-methods/' + del.dataset.pmdel, { method: 'DELETE' });
      renderPayMethods(); showToast('🗑️ تم الحذف');
    }
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- إعدادات الموقع ---------------- */
async function loadSiteSettings() {
  try {
    const s = await API.req('/settings/site');
    document.getElementById('setWhatsapp').value = s.whatsapp || '';
    document.getElementById('setTelegram').value = s.telegram || '';
    document.getElementById('setEmail').value = s.email || '';
  } catch { }
}
document.getElementById('siteForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await API.req('/settings/site', {
      method: 'PUT',
      body: {
        whatsapp: normalizePhone(document.getElementById('setWhatsapp').value),
        telegram: document.getElementById('setTelegram').value.replace(/^@/, ''),
        email: document.getElementById('setEmail').value,
      },
    });
    showToast('✅ تم حفظ قنوات الدعم العامة');
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ============================================================
   إدارة الأقسام الديناميكية
   ============================================================ */
let CATS = [];
async function loadCategories() {
  try {
    CATS = await API.req('/categories/all');
    CAT_LABELS = {};
    CATS.forEach(c => { CAT_LABELS[c.slug] = (c.icon || '🗂️') + ' ' + c.nameAr; });
    fillProductCats();
    renderCategories();
  } catch (e) { showToast('❌ ' + e.message); }
}
function fillProductCats() {
  const sel = document.getElementById('pCat');
  if (!CATS.length || !sel) return;
  const cur = sel.value;
  sel.innerHTML = CATS.filter(c => c.active).map(c =>
    '<option value="' + c.slug + '">' + (c.icon || '') + ' ' + c.nameAr + '</option>').join('');
  if (cur) sel.value = cur;
}
async function renderCategories() {
  document.querySelector('#catTable tbody').innerHTML = CATS.length ? CATS.map(c => `
    <tr>
      <td>${c.icon || '🗂️'} <b>${c.nameAr}</b>${c.nameEn ? ' <small>(' + c.nameEn + ')</small>' : ''}</td>
      <td dir="ltr">${c.slug}</td>
      <td>${c.kind === 'services' ? '🎓 خدمات' : '🛍️ متجر'}</td>
      <td>${c.order}</td>
      <td><button class="status-badge ${c.active ? 'status-done' : 'status-cancel'}" data-cattoggle="${c._id}" data-active="${c.active}">${c.active ? 'ظاهر' : 'مخفي'}</button></td>
      <td class="row-actions">
        <button class="row-btn row-edit" data-catedit='${JSON.stringify(c).replace(/'/g, "&#39;")}'>✏️</button>
        <button class="row-btn row-del" data-catdel="${c._id}">🗑️</button>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="empty-row">أضف أول قسم — مثال: شحن ألعاب / كورسات</td></tr>';
}
document.getElementById('catForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('cId').value;
  const body = {
    nameAr: document.getElementById('cNameAr').value.trim(),
    nameEn: document.getElementById('cNameEn').value.trim(),
    slug: document.getElementById('cSlug').value.trim().toLowerCase(),
    icon: document.getElementById('cIcon').value.trim() || '🗂️',
    kind: document.getElementById('cKind').value,
    order: parseInt(document.getElementById('cOrder').value || '0', 10),
  };
  try {
    if (id) await API.req('/categories/' + id, { method: 'PUT', body });
    else await API.req('/categories', { method: 'POST', body });
    e.target.reset(); document.getElementById('cId').value = '';
    loadCategories(); renderProducts();
    showToast(id ? '✅ تم تحديث القسم' : '✅ تمت إضافة القسم — ظهر فوراً في المتجر');
  } catch (err) { showToast('❌ ' + err.message); }
});
document.getElementById('cReset').addEventListener('click', () => {
  document.getElementById('catForm').reset();
  document.getElementById('cId').value = '';
  document.getElementById('cSlug').disabled = false;
});
document.getElementById('catTable').addEventListener('click', async e => {
  const edit = e.target.closest('[data-catedit]');
  const del = e.target.closest('[data-catdel]');
  const tog = e.target.closest('[data-cattoggle]');
  try {
    if (edit) {
      const c = JSON.parse(edit.dataset.catedit);
      document.getElementById('cId').value = c._id;
      document.getElementById('cNameAr').value = c.nameAr;
      document.getElementById('cNameEn').value = c.nameEn || '';
      document.getElementById('cSlug').value = c.slug;
      document.getElementById('cSlug').disabled = true; // المعرف ثابت بعد الإنشاء
      document.getElementById('cIcon').value = c.icon || '';
      document.getElementById('cKind').value = c.kind;
      document.getElementById('cOrder').value = c.order;
    }
    if (tog) {
      await API.req('/categories/' + tog.dataset.cattoggle, { method: 'PUT', body: { active: tog.dataset.active !== 'true' } });
      loadCategories(); showToast('🔄 تم تحديث القسم');
    }
    if (del && confirm('حذف هذا القسم؟ (المنتجات المرتبطة به تبقى لكن بلا فلتر)')) {
      await API.req('/categories/' + del.dataset.catdel, { method: 'DELETE' });
      loadCategories(); showToast('🗑️ تم الحذف');
    }
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ============================================================
   إدارة العملات وأسعار الصرف
   ============================================================ */
async function renderCurrencies() {
  try {
    const curs = await API.req('/currencies/all');
    document.querySelector('#curTable tbody').innerHTML = curs.length ? curs.map(c => `
      <tr>
        <td>${c.flag || '💱'} <b dir="ltr">${c.code}</b></td>
        <td>${c.name}</td>
        <td><b>${c.rate}</b></td>
        <td><button class="status-badge ${c.active ? 'status-done' : 'status-cancel'}" data-curtoggle="${c._id}" data-active="${c.active}">${c.active ? 'مفعّلة' : 'معطّلة'}</button></td>
        <td class="row-actions">
          <button class="row-btn row-edit" data-curedit='${JSON.stringify(c).replace(/'/g, "&#39;")}'>✏️</button>
          <button class="row-btn row-del" data-curdel="${c._id}">🗑️</button>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="5" class="empty-row">أضف أول عملة (مثال: YER بسعر 540)</td></tr>';
  } catch (e) { showToast('❌ ' + e.message); }
}
document.getElementById('curForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('curId').value;
  const body = {
    code: document.getElementById('curCode').value.trim().toUpperCase(),
    name: document.getElementById('curName').value.trim(),
    flag: document.getElementById('curFlag').value.trim() || '💱',
    rate: parseFloat(document.getElementById('curRate').value),
    active: document.getElementById('curActive').checked,
  };
  try {
    if (id) await API.req('/currencies/' + id, { method: 'PUT', body });
    else await API.req('/currencies', { method: 'POST', body });
    e.target.reset(); document.getElementById('curId').value = '';
    document.getElementById('curCode').disabled = false;
    document.getElementById('curActive').checked = true;
    renderCurrencies();
    showToast('✅ تم حفظ العملة — الأسعار في المتجر تتحول فوراً');
  } catch (err) { showToast('❌ ' + err.message); }
});
document.getElementById('curReset').addEventListener('click', () => {
  document.getElementById('curForm').reset();
  document.getElementById('curId').value = '';
  document.getElementById('curCode').disabled = false;
});
document.getElementById('curTable').addEventListener('click', async e => {
  const edit = e.target.closest('[data-curedit]');
  const del = e.target.closest('[data-curdel]');
  const tog = e.target.closest('[data-curtoggle]');
  try {
    if (edit) {
      const c = JSON.parse(edit.dataset.curedit);
      document.getElementById('curId').value = c._id;
      document.getElementById('curCode').value = c.code;
      document.getElementById('curCode').disabled = true;
      document.getElementById('curName').value = c.name;
      document.getElementById('curFlag').value = c.flag || '';
      document.getElementById('curRate').value = c.rate;
      document.getElementById('curActive').checked = !!c.active;
    }
    if (tog) {
      await API.req('/currencies/' + tog.dataset.curtoggle, { method: 'PUT', body: { active: tog.dataset.active !== 'true' } });
      renderCurrencies(); showToast('🔄 تم التحديث');
    }
    if (del && confirm('حذف هذه العملة؟')) {
      await API.req('/currencies/' + del.dataset.curdel, { method: 'DELETE' });
      renderCurrencies(); showToast('🗑️ تم الحذف');
    }
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ============================================================
   إدارة المسؤولين والأدمن (للمدير العام)
   ============================================================ */
async function loadAdmins() {
  try {
    const admins = await API.req('/admin/admins');
    document.querySelector('#adminsTable tbody').innerHTML = admins.length ? admins.map(a => `
      <tr>
        <td><b>${a.name}</b></td>
        <td dir="ltr">${a.phone}</td>
        <td>${a.date || ''}</td>
        <td>${a.isSuper ? '👑 مدير عام' : '🛡️ أدمن'}</td>
        <td>${a.isSuper ? '—' : `<button class="row-btn row-del" data-admdel="${a.id}">⬇️ سحب الصلاحية</button>`}</td>
      </tr>`).join('')
      : '<tr><td colspan="5" class="empty-row">لا يوجد مسؤولون</td></tr>';
  } catch (e) { showToast('❌ ' + e.message); }
}
document.getElementById('adminCreateForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await API.req('/admin/create-admin', {
      method: 'POST',
      body: {
        name: document.getElementById('aName').value.trim(),
        phone: normalizePhone(document.getElementById('aPhone').value),
        password: document.getElementById('aPass').value,
      },
    });
    e.target.reset(); loadAdmins();
    showToast('👑 تم إنشاء حساب الأدمن — يدخل من admin.html مباشرة');
  } catch (err) { showToast('❌ ' + err.message); }
});
document.getElementById('adminsTable').addEventListener('click', async e => {
  const del = e.target.closest('[data-admdel]');
  if (!del) return;
  if (!confirm('سحب صلاحية الأدمن من هذا الحساب وتحويله لمستخدم عادي؟')) return;
  try {
    await API.req('/admin/admins/' + del.dataset.admdel, { method: 'DELETE' });
    loadAdmins(); renderUsers();
    showToast('⬇️ تم سحب صلاحية الأدمن');
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- تغيير كلمة مرور المدير ---------------- */
document.getElementById('adminPassForm').addEventListener('submit', async e => {
  e.preventDefault();
  const n1 = document.getElementById('adNew').value;
  const n2 = document.getElementById('adNew2').value;
  if (n1 !== n2) return showToast('⚠️ كلمتا المرور غير متطابقتين');
  try {
    await API.req('/users/change-password', {
      method: 'PUT',
      body: { current: document.getElementById('adCur').value, next: n1 },
    });
    e.target.reset();
    showToast('🔒 تم تحديث كلمة مرور المدير');
  } catch (err) { showToast('❌ ' + err.message); }
});


/* v12: احتساب لحظي للسعر بعد الخصم أثناء الإدخال */
(function () {
  var sale = document.getElementById('pOnSale'), pct = document.getElementById('pDisc'),
      price = document.getElementById('pPrice'), out = document.getElementById('pFinalPrice');
  if (!sale || !pct || !price) return;
  function calc() {
    var p = parseFloat(price.value) || 0, d = Math.min(100, Math.max(0, parseFloat(pct.value) || 0));
    var on = sale.checked && d > 0;
    var f = on ? +(p - p * d / 100).toFixed(2) : p;
    if (out) out.innerHTML = on ? ('السعر بعد الخصم: <b>$' + f + '</b> بدلاً من <s>$' + p + '</s>') : '—';
  }
  ['input', 'change'].forEach(function (ev) { sale.addEventListener(ev, calc); pct.addEventListener(ev, calc); price.addEventListener(ev, calc); });
  calc();
})();