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

  it('requires platform authentication before sending an SMS', async () => {
    await app.httpRequest()
      .post('/api/connections/sms/send')
      .send({ mobile: '13800138000', validate: 'not-used' })
      .expect(401);
  });

  it('requires platform authentication before SMS login', async () => {
    await app.httpRequest()
      .post('/api/connections/sms/login')
      .send({ mobile: '13800138000', code: '123456' })
      .expect(401);
  });

  it('requires platform authentication before listing assets', async () => {
    await app.httpRequest().get('/api/assets').expect(401);
  });

  it('requires platform authentication before syncing assets', async () => {
    await app.httpRequest().post('/api/assets/sync').send({}).expect(401);
  });
});
