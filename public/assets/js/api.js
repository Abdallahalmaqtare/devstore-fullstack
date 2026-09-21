/* DevStore — طبقة الاتصال بالـ API + إدارة الجلسة (تذكرني) */
const API = {
  base: '/api',

  /* localStorage أولاً (تذكرني)، ثم sessionStorage (جلسة مؤقتة) */
  token: function () { return localStorage.getItem('ds-token') || sessionStorage.getItem('ds-token'); },
  user: function () { return JSON.parse(localStorage.getItem('ds-user') || sessionStorage.getItem('ds-user') || 'null'); },

  /* remember=true → localStorage (دائم) | false → sessionStorage (تُنهى بإغلاق المتصفح) */
  setSession: function (token, user, remember) {
    this.clearSession();
    var store = (remember === false) ? sessionStorage : localStorage;
    store.setItem('ds-token', token);
    store.setItem('ds-user', JSON.stringify(user));
  },
  clearSession: function () {
    localStorage.removeItem('ds-token');
    localStorage.removeItem('ds-user');
    sessionStorage.removeItem('ds-token');
    sessionStorage.removeItem('ds-user');
  },

  req: async function (path, opts) {
    opts = opts || {};
    var headers = {};
    var token = this.token();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body && !opts.form) headers['Content-Type'] = 'application/json';
    var res = await fetch(this.base + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.form ? opts.form : (opts.body ? JSON.stringify(opts.body) : undefined),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      if (res.status === 401) this.clearSession();
      throw new Error(data.message || 'حدث خطأ في الاتصال');
    }
    return data;
  },
};

/* توحيد أرقام الهاتف: حذف كل ما ليس رقماً */
function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '');
}
