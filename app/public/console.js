'use strict';

(function() {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : escapeHtml(date.toLocaleString('zh-CN', { hour12: false }));
  }

  function formatNumber(value) {
    return value === null || value === undefined || value === '' ? '-' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }

  async function fetchJson(url, options, timeoutMs = 20000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      let data;
      try { data = await response.json(); } catch (error) { throw new Error(`服务返回了无法解析的响应（HTTP ${response.status}）`); }
      return { response, data };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function requireAuth() {
    const response = await fetch('/api/auth/me');
    if (!response.ok) { location.href = '/login'; return null; }
    const data = await response.json();
    const userName = document.getElementById('userName');
    if (userName) userName.textContent = data.user.displayName || data.user.username;
    return data.user;
  }

  function initShell(activePage) {
    document.querySelectorAll('[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === activePage));
    const logout = document.getElementById('logout');
    if (logout) logout.addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/login'; });
  }

  window.ConsoleApp = { escapeHtml, formatDate, formatNumber, fetchJson, requireAuth, initShell };
})();
