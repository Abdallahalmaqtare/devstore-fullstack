/* ============================================================
   لوحة إدارة DevStore — متصلة بالـ API (تتطلب دور admin)
   ============================================================ */

/* ---------------- حماية اللوحة: أدمن فقط ---------------- */
(function guard() {
  const u = API.user();
  if (!API.token() || !u || u.role !== 'admin') {
    alert('⛔ هذه الصفحة مخصصة للمدير فقط — سجّل الدخول بحساب الأدمن');
    location.href = 'index.html';
  }
})();

document.getElementById('adminLogout').addEventListener('click', () => {
  API.clearSession(); location.href = 'index.html';
});
document.getElementById('adminThemeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('tg-theme', next);
});

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ---------------- التنقل بين الصفحات ---------------- */
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const pageTitles = {
  dashboard: '📊 الرئيسية', products: '🛍️ إدارة المنتجات',
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

const CAT_LABELS = { games: '🎮 ألعاب', numbers: '📱 أرقام', tools: '🛠️ صيانة', courses: '🎓 دورات' };
const STATUS_FLOW = ['قيد المراجعة', 'مكتمل', 'ملغي'];
const STATUS_CLASS = { 'قيد المراجعة': 'status-review', 'مكتمل': 'status-done', 'ملغي': 'status-cancel' };

/* ---------------- الرئيسية: الإحصائيات ---------------- */
async function renderDashboard() {
  const [orders, users, products] = await Promise.all([
    API.req('/orders'), API.req('/auth/users'), API.req('/products/all'),
  ]);
  const revenue = orders.filter(o => o.status !== 'ملغي').reduce((s, o) => s + o.total, 0);
  document.getElementById('statRevenue').textContent = '$' + revenue.toFixed(2);
  document.getElementById('statOrders').textContent = orders.filter(o => o.status === 'قيد المراجعة').length;
  document.getElementById('statUsers').textContent = users.length;
  document.getElementById('statProducts').textContent = products.length;

  const tbody = document.querySelector('#recentOrdersTable tbody');
  tbody.innerHTML = orders.slice(0, 5).map(o => `
    <tr><td><b>${o.code}</b></td><td>${new Date(o.createdAt).toLocaleString('ar')}</td>
    <td>$${o.total.toFixed(2)}</td>
    <td><span class="status-badge ${STATUS_CLASS[o.status]}">${o.status}</span></td></tr>`).join('')
    || '<tr><td colspan="4" class="empty-row">لا توجد طلبات بعد</td></tr>';
}

/* ---------------- إدارة المنتجات (CRUD حقيقي) ---------------- */
async function renderProducts() {
  const products = await API.req('/products/all');
  document.querySelector('#productsTable tbody').innerHTML = products.length ? products.map(p => `
    <tr>
      <td>${p.icon || '📦'} <b>${p.name}</b></td>
      <td>${CAT_LABELS[p.cat] || p.cat}</td>
      <td>$${(+p.price).toFixed(2)}</td>
      <td class="row-actions">
        <button class="row-btn row-edit" data-edit='${JSON.stringify(p).replace(/'/g, "&#39;")}'>✏️ تعديل</button>
        <button class="row-btn row-del" data-del="${p._id}">🗑️ حذف</button>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="4" class="empty-row">لا توجد منتجات — أضف أول منتج من النموذج أعلاه</td></tr>';
}

document.getElementById('productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const body = {
    name: document.getElementById('pName').value.trim(),
    price: parseFloat(document.getElementById('pPrice').value),
    cat: document.getElementById('pCat').value,
    icon: document.getElementById('pIcon').value.trim() || '📦',
    desc: document.getElementById('pDesc').value.trim(),
    countrySelect: document.getElementById('pCat').value === 'numbers',
  };
  try {
    if (id) await API.req('/products/' + id, { method: 'PUT', body });
    else await API.req('/products', { method: 'POST', body });
    e.target.reset(); document.getElementById('pId').value = '';
    renderProducts(); renderDashboard();
    showToast(id ? '✅ تم تحديث المنتج (انعكس فوراً في المتجر)' : '✅ تمت إضافة المنتج');
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
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pCat').value = p.cat;
    document.getElementById('pIcon').value = p.icon || '';
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pName').focus();
    showToast('✏️ وضع التعديل — عدّل ثم اضغط حفظ');
  }
  if (delBtn && confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) {
    try {
      await API.req('/products/' + delBtn.dataset.del, { method: 'DELETE' });
      renderProducts(); renderDashboard();
      showToast('🗑️ تم حذف المنتج');
    } catch (err) { showToast('❌ ' + err.message); }
  }
});

/* ---------------- إدارة الطلبات ---------------- */
async function renderOrders() {
  const orders = await API.req('/orders');
  document.querySelector('#ordersTable tbody').innerHTML = orders.length ? orders.map(o => `
    <tr>
      <td><b>${o.code}</b><br><small>${o.customerName} — ${o.customerPhone}</small></td>
      <td>${o.items.map(i => `${i.name} ×${i.qty}${i.extra ? ` (${i.extra})` : ''}`).join('، ')}</td>
      <td>$${o.total.toFixed(2)}</td>
      <td>${o.paymentMethod?.name || '—'}</td>
      <td>${new Date(o.createdAt).toLocaleString('ar')}</td>
      <td>${o.receiptUrl ? `<a href="${o.receiptUrl}" target="_blank" rel="noopener">🧾 عرض السند</a>` : '—'}</td>
      <td><button class="status-badge ${STATUS_CLASS[o.status]}" data-order="${o._id}" data-status="${o.status}" title="اضغط لتغيير الحالة">${o.status}</button></td>
    </tr>`).join('')
    : '<tr><td colspan="7" class="empty-row">لا توجد طلبات واردة بعد</td></tr>';
}

document.getElementById('ordersTable').addEventListener('click', async e => {
  const btn = e.target.closest('[data-order]');
  if (!btn) return;
  const next = STATUS_FLOW[(STATUS_FLOW.indexOf(btn.dataset.status) + 1) % STATUS_FLOW.length];
  try {
    await API.req(`/orders/${btn.dataset.order}/status`, { method: 'PUT', body: { status: next } });
    renderOrders(); renderDashboard();
    showToast(`🔄 حالة الطلب أصبحت: ${next}`);
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- إدارة المستخدمين ---------------- */
async function renderUsers() {
  const users = await API.req('/auth/users');
  document.querySelector('#usersTable tbody').innerHTML = users.map(u => `
    <tr>
      <td><b>${u.name}</b>${u.role === 'admin' ? ' 👑' : ''}</td>
      <td>${u.phone}</td><td>${u.date || ''}</td><td>${u.orders}</td>
      <td>${u.role === 'admin' ? '—' : `<button class="status-badge ${u.active ? 'status-done' : 'status-cancel'}" data-user="${u.id}">${u.active ? 'نشط' : 'موقوف'}</button>`}</td>
    </tr>`).join('');
}
document.getElementById('usersTable').addEventListener('click', async e => {
  const btn = e.target.closest('[data-user]');
  if (!btn) return;
  try {
    const r = await API.req(`/auth/users/${btn.dataset.user}/toggle`, { method: 'PUT' });
    renderUsers();
    showToast(r.active ? '✅ تم تفعيل الحساب' : '⛔ تم إيقاف الحساب');
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- طرق الدفع اليدوية (ديناميكية بالكامل) ---------------- */
async function renderPayMethods() {
  const pms = await API.req('/settings/payment-methods/all');
  document.querySelector('#pmTable tbody').innerHTML = pms.length ? pms.map(pm => `
    <tr>
      <td><b>${pm.name}</b></td><td>${pm.account}</td><td>${pm.instructions || '—'}</td>
      <td><button class="status-badge ${pm.active ? 'status-done' : 'status-cancel'}" data-pmtoggle="${pm._id}" data-active="${pm.active}">${pm.active ? 'مفعّلة' : 'معطّلة'}</button></td>
      <td><button class="row-btn row-del" data-pmdel="${pm._id}">🗑️ حذف</button></td>
    </tr>`).join('')
    : '<tr><td colspan="5" class="empty-row">أضف أول طريقة دفع من النموذج أعلاه</td></tr>';
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
    showToast('✅ تمت إضافة طريقة الدفع (ستظهر للعملاء فوراً)');
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
      renderPayMethods(); showToast('🔄 تم تحديث حالة طريقة الدفع');
    }
    if (del && confirm('حذف طريقة الدفع هذه؟')) {
      await API.req('/settings/payment-methods/' + del.dataset.pmdel, { method: 'DELETE' });
      renderPayMethods(); showToast('🗑️ تم الحذف');
    }
  } catch (err) { showToast('❌ ' + err.message); }
});

/* ---------------- التشغيل الأول ---------------- */
renderDashboard();
renderProducts();
renderOrders();
renderUsers();
renderPayMethods();
