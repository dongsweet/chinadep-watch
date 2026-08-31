'use strict';

const assert = require('assert');
const ChinadepAuthService = require('../../../app/service/chinadep-auth');

function createService(response) {
  const app = {
    config: {
      chinadep: {
        baseUrl: 'https://m-math.chinadep.com',
        captchaId: '2b9f754fbd9c48628e3b834c4fb519d2',
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
  it('sends an SMS login code with the captcha validation', async () => {
    const { service, app } = createService({
      status: 200,
      data: { code: 1, success: true, msg: '验证码已发送', requestId: 'request-1' },
    });

    const result = await service.sendLoginSms({
      mobile: '13800138000',
      validate: 'captcha-validate',
      deviceToken: 'device-token',
    });

    assert.equal(result.httpStatus, 200);
    assert.equal(result.body.status, 'sms_sent');
    assert.equal(app.lastRequest.url, 'https://m-math.chinadep.com/sm/api/customer/anonymous/sendLoginSms');
    assert.equal(app.lastRequest.options.method, 'GET');
    assert.deepStrictEqual(app.lastRequest.options.data, {
      captchaId: '2b9f754fbd9c48628e3b834c4fb519d2',
      mobile: '13800138000',
      validate: 'captcha-validate',
    });
  });

  it('logs in with an SMS code and normalizes the session', async () => {
    const { service, app } = createService({
      status: 200,
      data: {
        code: 1,
        data: {
          token: 'sms-token',
          userId: 43,
          mobile: '13800138000',
          nickname: 'sms-user',
        },
      },
    });

    const result = await service.loginBySms({
      mobile: '13800138000',
      code: '123456',
      livingCheckReturnUrl: 'https://watch.example/return',
    });

    assert.equal(result.httpStatus, 200);
    assert.equal(result.body.session.token, 'sms-token');
    assert.equal(app.lastRequest.url, 'https://m-math.chinadep.com/sm/api/customer/anonymous/registerOrLoginByMobile');
    assert.deepStrictEqual(app.lastRequest.options.data, {
      mobile: '13800138000',
      code: '123456',
      livingCheckReturnUrl: 'https://watch.example/return',
    });
  });

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
