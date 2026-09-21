/* ============================================================
   DevStore — طبقة الاتصال بالـ API (مشتركة بين المتجر واللوحة)
   ============================================================ */
const API = {
  base: '/api',
  token: () => localStorage.getItem('ds-token'),
  user: () => JSON.parse(localStorage.getItem('ds-user') || 'null'),
  setSession(token, user) {
    localStorage.setItem('ds-token', token);
    localStorage.setItem('ds-user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('ds-token');
    localStorage.removeItem('ds-user');
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
