'use strict';

const { Controller } = require('egg');

class HealthController extends Controller {
  async index() {
    this.ctx.body = {
      ok: true,
      service: 'chinadep-watch',
    };
  }
}

module.exports = HealthController;
