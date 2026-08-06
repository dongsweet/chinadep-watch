'use strict';

const { Controller } = require('egg');

class PlatformAuthController extends Controller {
  async login() {
    const { ctx } = this;
    const body = ctx.request.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password || username.length > 64 || password.length > 128) {
      ctx.status = 400;
      ctx.body = { success: false, message: '请输入用户名和密码' };
      return;
    }

    const user = await ctx.service.platformAuth.findUser(username, password);
    if (!user) {
      ctx.status = 401;
      ctx.body = { success: false, message: '用户名或密码错误' };
      return;
    }

    ctx.session.platformUser = user;
    ctx.body = { success: true, user };
  }

  async logout() {
    this.ctx.session = null;
    this.ctx.body = { success: true };
  }

  async me() {
    const user = this.ctx.session.platformUser;
    if (!user) {
      this.ctx.status = 401;
      this.ctx.body = { success: false, message: '未登录' };
      return;
    }
    this.ctx.body = { success: true, user };
  }
}

module.exports = PlatformAuthController;
