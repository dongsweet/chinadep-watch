'use strict';

const { Controller } = require('egg');

const MOBILE_PATTERN = /^1[3-9]\d{9}$/;

class ConnectionController extends Controller {
  async login() {
    const { ctx } = this;
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

    ctx.status = result.httpStatus;
    ctx.body = result.body;
  }
}

module.exports = ConnectionController;
