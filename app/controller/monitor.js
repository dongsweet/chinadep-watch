'use strict';

const { Controller } = require('egg');

function unauthorized(ctx) {
  ctx.status = 401;
  ctx.body = { success: false, message: '请先登录监控平台' };
}

function validPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 999999999;
}

class MonitorController extends Controller {
  async list() {
    if (!this.ctx.session.platformUser) return unauthorized(this.ctx);
    this.ctx.body = { success: true, monitors: await this.ctx.service.monitor.list() };
  }

  async create() {
    if (!this.ctx.session.platformUser) return unauthorized(this.ctx);
    const body = this.ctx.request.body || {};
    const assetId = Number.parseInt(body.assetId, 10);
    const thresholdPrice = Number(body.thresholdPrice);
    if (!Number.isInteger(assetId) || assetId < 1 || !validPrice(thresholdPrice)) {
      this.ctx.status = 400;
      this.ctx.body = { success: false, status: 'invalid_request', message: '请选择资产并填写有效的提醒价格' };
      return;
    }
    const result = await this.ctx.service.monitor.create({ assetId, thresholdPrice });
    this.ctx.status = result.httpStatus;
    this.ctx.body = result.body;
  }

  async update() {
    if (!this.ctx.session.platformUser) return unauthorized(this.ctx);
    const id = Number.parseInt(this.ctx.params.id, 10);
    const body = this.ctx.request.body || {};
    const thresholdPrice = body.thresholdPrice === undefined ? undefined : Number(body.thresholdPrice);
    if (!Number.isInteger(id) || id < 1 || (thresholdPrice !== undefined && !validPrice(thresholdPrice))) {
      this.ctx.status = 400;
      this.ctx.body = { success: false, status: 'invalid_request', message: '监控参数不正确' };
      return;
    }
    const result = await this.ctx.service.monitor.update(id, {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      thresholdPrice,
    });
    this.ctx.status = result.httpStatus;
    this.ctx.body = result.body;
  }

  async remove() {
    if (!this.ctx.session.platformUser) return unauthorized(this.ctx);
    const id = Number.parseInt(this.ctx.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      this.ctx.status = 400;
      this.ctx.body = { success: false, status: 'invalid_request', message: '监控 ID 不正确' };
      return;
    }
    const result = await this.ctx.service.monitor.remove(id);
    this.ctx.status = result.httpStatus;
    this.ctx.body = result.body;
  }

  async status() {
    if (!this.ctx.session.platformUser) return unauthorized(this.ctx);
    const result = await this.ctx.service.monitor.check();
    this.ctx.body = { success: true, status: 'checked', ...result };
  }
}

module.exports = MonitorController;
