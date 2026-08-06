'use strict';

const assert = require('assert');
const { app } = require('egg-mock/bootstrap');

describe('platform authentication', () => {
  it('logs in with the seeded platform account', async () => {
    const response = await app.httpRequest()
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    assert.equal(response.body.success, true);
    assert.equal(response.body.user.username, 'admin');
    assert(response.headers['set-cookie']);
  });

  it('rejects invalid credentials', async () => {
    const response = await app.httpRequest()
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: '用户名或密码错误',
    });
  });
});
