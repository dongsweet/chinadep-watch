'use strict';

const { app } = require('egg-mock/bootstrap');

describe('target platform connection', () => {
  it('requires platform authentication before listing connections', async () => {
    await app.httpRequest().get('/api/connections').expect(401);
  });

  it('requires platform authentication before target login', async () => {
    await app.httpRequest()
      .post('/api/connections/login')
      .send({ mobile: '13800138000', password: 'not-used' })
      .expect(401);
  });
});
