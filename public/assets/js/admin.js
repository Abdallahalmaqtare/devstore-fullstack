/* ============================================================
   DevStore Admin — تسجيل دخول داخلي + لوحة تحكم كاملة
   ============================================================ */

const CAT_LABELS = { games: '🎮 ألعاب', numbers: '📱 أرقام', tools: '🛠️ صيانة', courses: '🎓 دورات/خدمات' };
const STATUS_FLOW = ['قيد المراجعة', 'مكتمل', 'ملغي'];
const STATUS_CLASS = { 'قيد المراجعة': 'status-review', 'مكتمل': 'status-done', 'ملغي': 'status-cancel' };

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ---------------- شاشة تسجيل الدخول للأدمن ---------------- */
const loginScreen = document.getElementById('adminLoginScreen');
const app = document.getElementById('adminApp');

function showLogin() { loginScreen.classList.remove('hidden'); app.classList.add('hidden'); }
function showApp() {
  loginScreen.classList.add('hidden'); app.classList.remove('hidden');
  const u = API.user();
  document.getElementById('adminNameChip').textContent = '👑 ' + (u?.name || 'المدير');
  bootAdmin();
}

/* التحقق من التوكن الحالي: هل هو أدمن فعلاً؟ */
async function verifyAdmin() {
  const u = API.user();
  if (!API.token() || !u || u.role !== 'admin') return showLogin();
  try {
    const { user } = await API.req('/auth/me');
    if (user.role !== 'admin') { API.clearSession(); return showLogin(); }
    API.setSession(API.token(), user);
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
        phone: document.getElementById('adLoginPhone').value,
        password: document.getElementById('adLoginPass').value,
      },
    });
    API.setSession(token, user);
    showToast(`👑 أهلاً ${user.name}`);
    showApp();
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- تشغيل باقي عناصر اللوحة بعد نجاح الدخول ---------------- */
function bootAdmin() {
  document.getElementById('adminLogout').addEventListener('click', () => {
    API.clearSession(); showLogin();
  }, { once: true });

  document.getElementById('adminThemeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('tg-theme', next);
  });

  /* التنقل بين الصفحات */
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const pageTitles = {
    dashboard: '📊 الرئيسية', products: '🛍️ إدارة المنتجات والخدمات',
    orders: '📦 إدارة الطلبات', users: '👥 إدارة المستخدمين', settings: '⚙️ الإعدادات',
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

  renderDashboard(); renderProducts(); renderOrders(); renderUsers(); renderPayMethods(); loadSiteSettings();
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

/* ---------------- المنتجات/الخدمات ---------------- */
async function renderProducts() {
  try {
    const products = await API.req('/products/all');
    document.querySelector('#productsTable tbody').innerHTML = products.length ? products.map(p => `
      <tr>
        <td>${p.icon || '📦'} <b>${p.name}</b></td>
        <td>${p.type === 'service' ? '💬 خدمة' : '🛒 منتج'}</td>
        <td>${CAT_LABELS[p.cat] || p.cat}</td>
        <td>${p.type === 'service' ? '—' : '$' + (+p.price).toFixed(2)}</td>
        <td class="row-actions">
          <button class="row-btn row-edit" data-edit='${JSON.stringify(p).replace(/'/g, "&#39;")}'>✏️ تعديل</button>
          <button class="row-btn row-del" data-del="${p._id}">🗑️ حذف</button>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="5" class="empty-row">لا توجد عناصر — أضف من الأعلى</td></tr>';
  } catch (e) { showToast('❌ ' + e.message); }
}

document.getElementById('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const type = document.getElementById('pType').value;
  const cat = document.getElementById('pCat').value;
  const body = {
    name: document.getElementById('pName').value.trim(),
    type, cat,
    price: type === 'service' ? 0 : parseFloat(document.getElementById('pPrice').value || 0),
    icon: document.getElementById('pIcon').value.trim() || '📦',
    unit: document.getElementById('pUnit').value.trim(),
    meta: document.getElementById('pUnit').value.trim(),
    desc: document.getElementById('pDesc').value.trim(),
    countrySelect: cat === 'numbers',
    modes: cat === 'courses' ? ['online', 'onsite'] : [],
  };
  try {
    if (id) await API.req('/products/' + id, { method: 'PUT', body });
    else await API.req('/products', { method: 'POST', body });
    e.target.reset(); document.getElementById('pId').value = '';
    renderProducts(); renderDashboard();
    showToast(id ? '✅ تم التحديث' : '✅ تمت الإضافة');
  } catch (err) { showToast('❌ ' + err.message); }
});

document.getElementById('pReset').addEventListener('click', () => {
  document.getElementById('productForm').reset();
  document.getElementById('pId').value = '';
});

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
    document.getElementById('pUnit').value = p.unit || p.meta || '';
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pName').focus();
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
        <td>${o.items.map(i => `${i.name} ×${i.qty}${i.extra ? ` (${i.extra})` : ''}`).join('، ')}</td>
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
        <td>${u.phone}</td><td>${u.date || ''}</td><td>${u.orders}</td>
        <td>${u.role === 'admin' ? '—' : `<button class="status-badge ${u.active ? 'status-done' : 'status-cancel'}" data-user="${u.id}">${u.active ? 'نشط' : 'موقوف'}</button>`}</td>
      </tr>`).join('');
  } catch (e) { showToast('❌ ' + e.message); }
}
document.getElementById('usersTable').addEventListener('click', async e => {
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
  } catch { /* المستخدم يمكنه تعبئتها من جديد */ }
}
document.getElementById('siteForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await API.req('/settings/site', {
      method: 'PUT',
      body: {
        whatsapp: document.getElementById('setWhatsapp').value,
        telegram: document.getElementById('setTelegram').value,
        email: document.getElementById('setEmail').value,
      },
    });
    showToast('✅ تم حفظ روابط التواصل');
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
