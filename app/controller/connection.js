'use strict';

const { Controller } = require('egg');

const MOBILE_PATTERN = /^1[3-9]\d{9}$/;

class ConnectionController extends Controller {
  async list() {
    if (!this.ctx.session.platformUser) return this.unauthorized();
    this.ctx.body = {
      success: true,
      connections: await this.ctx.service.connectionStore.list(),
    };
  }

  async login() {
    const { ctx } = this;
    if (!ctx.session.platformUser) return this.unauthorized();
    const body = ctx.request.body || {};
    const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken.trim() : '';

    if (!MOBILE_PATTERN.test(mobile)) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        status: 'invalid_request',
        message: 'mobile must be a valid mainland China mobile number',
      };
      return;
    }

    if (password.length < 1 || password.length > 128) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        status: 'invalid_request',
        message: 'password must contain 1 to 128 characters',
      };
      return;
    }

    if (deviceToken.length > 2048) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        status: 'invalid_request',
        message: 'deviceToken is too long',
      };
      return;
    }

    const result = await ctx.service.chinadepAuth.loginByPassword({
      mobile,
      password,
      deviceToken: deviceToken || undefined,
    });

    if (result.body.status === 'authenticated') {
      let connection;
      try {
        connection = await ctx.service.connectionStore.saveAuthenticated({
          session: result.body.session,
          deviceToken: deviceToken || undefined,
        });
      } catch (error) {
        ctx.app.logger.error('[connection] failed to persist password login: %s', error.message);
        ctx.status = 500;
        ctx.body = { success: false, status: 'connection_store_failed', message: '监控平台已登录，但连接信息保存失败，请重试' };
        return;
      }
      result.body = { success: true, status: 'authenticated', connection };
    }

    ctx.status = result.httpStatus;
    ctx.body = result.body;
  }

  async sendSms() {
    const { ctx } = this;
    if (!ctx.session.platformUser) return this.unauthorized();
    const body = ctx.request.body || {};
    const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
    const validate = typeof body.validate === 'string' ? body.validate.trim() : '';
    const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken.trim() : '';

    if (!MOBILE_PATTERN.test(mobile)) {
      ctx.status = 400;
      ctx.body = { success: false, status: 'invalid_request', message: 'mobile must be a valid mainland China mobile number' };
      return;
    }
    if (!validate || validate.length > 4096) {
      ctx.status = 400;
      ctx.body = { success: false, status: 'invalid_request', message: '请先完成图形验证' };
      return;
    }
    if (deviceToken.length > 2048) {
      ctx.status = 400;
      ctx.body = { success: false, status: 'invalid_request', message: 'deviceToken is too long' };
      return;
    }

    const result = await ctx.service.chinadepAuth.sendLoginSms({
      mobile,
      validate,
      deviceToken: deviceToken || undefined,
    });
    ctx.status = result.httpStatus;
    ctx.body = result.body;
  }

  async loginBySms() {
    const { ctx } = this;
    if (!ctx.session.platformUser) return this.unauthorized();
    const body = ctx.request.body || {};
    const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const livingCheckReturnUrl = typeof body.livingCheckReturnUrl === 'string' ? body.livingCheckReturnUrl.trim() : '';
    const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken.trim() : '';

    if (!MOBILE_PATTERN.test(mobile)) {
      ctx.status = 400;
      ctx.body = { success: false, status: 'invalid_request', message: 'mobile must be a valid mainland China mobile number' };
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      ctx.status = 400;
      ctx.body = { success: false, status: 'invalid_request', message: '验证码格式不正确' };
      return;
    }
    if (livingCheckReturnUrl.length > 2048 || deviceToken.length > 2048) {
      ctx.status = 400;
      ctx.body = { success: false, status: 'invalid_request', message: '请求参数过长' };
      return;
    }

    const result = await ctx.service.chinadepAuth.loginBySms({
      mobile,
      code,
      livingCheckReturnUrl: livingCheckReturnUrl || undefined,
      deviceToken: deviceToken || undefined,
    });
    if (result.body.status === 'authenticated') {
      let connection;
      try {
        connection = await ctx.service.connectionStore.saveAuthenticated({
          session: result.body.session,
          deviceToken: deviceToken || undefined,
        });
      } catch (error) {
        ctx.app.logger.error('[connection] failed to persist SMS login: %s', error.message);
        ctx.status = 500;
        ctx.body = { success: false, status: 'connection_store_failed', message: '监控平台已登录，但连接信息保存失败，请重试' };
        return;
      }
      result.body = { success: true, status: 'authenticated', connection };
    }
    ctx.status = result.httpStatus;
    ctx.body = result.body;
  }

  unauthorized() {
    this.ctx.status = 401;
    this.ctx.body = { success: false, message: '请先登录监控平台' };
  }
}

module.exports = ConnectionController;
