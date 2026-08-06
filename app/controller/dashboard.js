'use strict';

const { Controller } = require('egg');

class DashboardController extends Controller {
  async index() {
    this.ctx.redirect('/dashboard.html');
  }

  async loginPage() {
    this.ctx.redirect('/login.html');
  }
}

module.exports = DashboardController;
