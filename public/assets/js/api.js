/* DevStore — طبقة الاتصال بالـ API + إدارة الجلسة (تذكرني) */
const API = {
  base: '/api',

  /* القراءة: localStorage أولاً (تذكرني)، ثم sessionStorage (جلسة مؤقتة) */
  token: () => localStorage.getItem('ds-token') || sessionStorage.getItem('ds-token'),
  user: () => JSON.parse(localStorage.getItem('ds-user') || sessionStorage.getItem('ds-user') || 'null'),

  /* remember=true → localStorage (دائم) | false → sessionStorage (تُنهى بإغلاق المتصفح) */
  setSession(token, user, remember = true) {
    this.clearSession();
    const store = remember ? localStorage : sessionStorage;
    store.setItem('ds-token', token);
    store.setItem('ds-user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('ds-token');
    localStorage.removeItem('ds-user');
    sessionStorage.removeItem('ds-token');
    sessionStorage.removeItem('ds-user');
  },

  async req(path, { method = 'GET', body, form } = {}) {
    const headers = {};
    if (this.token()) headers.Authorization = 'Bearer ' + this.token();
    if (body && !form) headers['Content-Type'] = 'application/json';
    const res = await fetch(this.base + path, {
      method, headers,
      body: form ? form : (body ? JSON.stringify(body) : undefined),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) this.clearSession();
      throw new Error(data.message || 'حدث خطأ في الاتصال');
    }
    return data;
  },
};

/* توحيد أرقام الهاتف: حذف كل ما ليس رقماً (+، مسافات، شرطات، أقواس) */
function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '');
}
