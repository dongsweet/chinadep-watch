'use strict';

const { Controller } = require('egg');

class SettingsController extends Controller {
  async index() {
    if (!this.ctx.session.platformUser) return this.unauthorized();
    const rows = await new Promise((resolve, reject) => {
      this.app.database.all('SELECT key, value, updated_at AS updatedAt FROM app_settings ORDER BY key', (error, result) => error ? reject(error) : resolve(result));
    });
    this.ctx.body = { success: true, settings: rows };
  }

  async update() {
    if (!this.ctx.session.platformUser) return this.unauthorized();
    const input = this.ctx.request.body || {};
    const entries = Object.entries(input).filter(([key, value]) => /^[a-zA-Z0-9_.-]{1,64}$/.test(key) && typeof value === 'string' && value.length <= 500);
    const now = new Date().toISOString();
    for (const [key, value] of entries) {
      await new Promise((resolve, reject) => {
        this.app.database.run(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [key, value, now], error => error ? reject(error) : resolve());
      });
    }
    this.ctx.body = { success: true, updated: entries.map(([key]) => key) };
  }

  unauthorized() {
    this.ctx.status = 401;
    this.ctx.body = { success: false, message: '未登录' };
  }
}

module.exports = SettingsController;
