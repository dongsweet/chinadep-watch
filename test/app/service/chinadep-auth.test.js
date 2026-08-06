'use strict';

const assert = require('assert');
const ChinadepAuthService = require('../../../app/service/chinadep-auth');

function createService(response) {
  const app = {
    config: {
      chinadep: {
        baseUrl: 'https://m-math.chinadep.com',
        requestTimeout: 1000,
        userAgent: 'test-agent',
      },
    },
    logger: {
      warn() {},
    },
    async curl(url, options) {
      app.lastRequest = { url, options };
      return response;
    },
  };
  return { service: new ChinadepAuthService({ app }), app };
}

describe('service.chinadepAuth', () => {
  it('logs in and returns a normalized session', async () => {
    const { service, app } = createService({
      status: 200,
      data: {
        code: 1,
        data: {
          token: 'secret-token',
          id: 42,
          mobile: '13800138000',
          nickName: 'demo',
          isVerified: true,
          isBindWallet: false,
        },
      },
    });

    const result = await service.loginByPassword({
      mobile: '13800138000',
      password: 'password',
      deviceToken: 'device-token',
    });

    assert.equal(result.httpStatus, 200);
    assert.equal(result.body.status, 'authenticated');
    assert.equal(result.body.session.token, 'secret-token');
    assert.equal(app.lastRequest.url, 'https://m-math.chinadep.com/sm/api/api/auth/customerUser/loginByPassword');
    assert.deepStrictEqual(app.lastRequest.options.data, {
      mobile: '13800138000',
      password: 'password',
    });
    assert.equal(app.lastRequest.options.headers['Tencent-DeviceToken'], 'device-token');
  });

  it('returns a challenge when the target requires living verification', async () => {
    const { service } = createService({
      status: 200,
      data: {
        code: 1,
        data: {
          livingCheckUrl: 'https://example.test/living-check',
        },
      },
    });

    const result = await service.loginByPassword({
      mobile: '13800138000',
      password: 'password',
    });

    assert.equal(result.httpStatus, 202);
    assert.equal(result.body.status, 'challenge_required');
    assert.equal(result.body.challengeUrl, 'https://example.test/living-check');
  });
});
