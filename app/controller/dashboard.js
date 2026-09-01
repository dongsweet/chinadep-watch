'use strict';

const { Controller } = require('egg');

class DashboardController extends Controller {
  async index() {
    this.ctx.redirect('/accounts');
  }

  async loginPage() {
    this.ctx.redirect('/login.html');
  }

  async accountsPage() {
    this.ctx.redirect('/accounts.html');
  }

  async productsPage() {
    this.ctx.redirect('/products.html');
  }

  async monitoringPage() {
    this.ctx.redirect('/monitoring.html');
  }
}

module.exports = DashboardController;
