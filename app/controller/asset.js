'use strict';

const { Controller } = require('egg');

class AssetController extends Controller {
  async list() {
    if (!this.ctx.session.platformUser) return this.unauthorized();
    const query = typeof this.ctx.query.q === 'string' ? this.ctx.query.q.trim().slice(0, 100) : '';
    const enabledParam = this.ctx.query.enabled;
    const enabled = enabledParam === 'true' ? true : enabledParam === 'false' ? false : undefined;
    this.ctx.body = { success: true, assets: await this.ctx.service.chinadepAssets.list({ query, enabled }) };
  }

  async sync() {
    if (!this.ctx.session.platformUser) return this.unauthorized();
    const body = this.ctx.request.body || {};
    const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : undefined;
    const pageSize = body.pageSize;
    const result = await this.ctx.service.chinadepAssets.sync({ mobile: mobile || undefined, pageSize });
    this.ctx.status = result.httpStatus;
    this.ctx.body = result.body;
  }

  async update() {
    if (!this.ctx.session.platformUser) return this.unauthorized();
    const id = Number.parseInt(this.ctx.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      this.ctx.status = 400;
      this.ctx.body = { success: false, status: 'invalid_request', message: '资产 ID 不正确' };
      return;
    }
    const body = this.ctx.request.body || {};
    if (typeof body.note === 'string' && body.note.length > 500) {
      this.ctx.status = 400;
      this.ctx.body = { success: false, status: 'invalid_request', message: '备注不能超过 500 个字符' };
      return;
    }
    const result = await this.ctx.service.chinadepAssets.update(id, {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      note: body.note,
    });
    this.ctx.status = result.httpStatus;
    this.ctx.body = result.body;
  }

  async sales() {
    if (!this.ctx.session.platformUser) return this.unauthorized();
    const assetId = Number.parseInt(this.ctx.params.id, 10);
    const pageCount = Number.parseInt(this.ctx.query.pageCount, 10) || 1;
    const pageSize = Number.parseInt(this.ctx.query.pageSize, 10) || 10;
    const refresh = this.ctx.query.refresh === 'true';
    const result = await this.ctx.service.chinadepSales.list({ assetId, pageCount, pageSize, refresh });
    this.ctx.status = result.httpStatus;
    this.ctx.body = result.body;
  }

  unauthorized() {
    this.ctx.status = 401;
    this.ctx.body = { success: false, message: '请先登录监控平台' };
  }
}

module.exports = AssetController;
