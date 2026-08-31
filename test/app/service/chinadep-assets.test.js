'use strict';

const assert = require('assert');
const ChinadepAssetsService = require('../../../app/service/chinadep-assets');

describe('service.chinadepAssets', () => {
  it('fetches and normalizes the target asset page', async () => {
    const app = {
      config: {
        chinadep: {
          baseUrl: 'https://m-math.chinadep.com',
          requestTimeout: 1000,
          userAgent: 'test-agent',
        },
      },
      async curl(url, options) {
        app.lastRequest = { url, options };
        return {
          status: 200,
          data: {
            code: 1,
            data: {
              pageSize: 10,
              dataCount: 1,
              data: [{
                id: 71,
                name: '测试资产',
                issuerName: '测试发行方',
                issuerId: 16,
                assetsType: { id: 2, name: '品牌营销' },
                assetsFileType: { id: 3, name: '图片' },
                issuePrice: 199,
                maxPrice: 9999,
                issueCount: 2026,
                tradeStartTime: '2026-03-16 12:00:00',
              }],
            },
          },
        };
      },
    };
    const service = new ChinadepAssetsService({ app });
    const result = await service.fetchPage({ token: 'target-token', deviceToken: 'device-token' }, 1, 10);

    assert.equal(result.ok, true);
    assert.equal(result.rows[0].id, 71);
    assert.equal(app.lastRequest.options.method, 'GET');
    assert.deepStrictEqual(app.lastRequest.options.data, { pageCount: 1, pageSize: 10 });
    assert.equal(app.lastRequest.options.headers.Authorization, 'target-token');
  });

  it('returns an explicit status when the target token expired', async () => {
    const app = {
      config: { chinadep: { baseUrl: 'https://m-math.chinadep.com', requestTimeout: 1000, userAgent: 'test-agent' } },
      async curl() { return { status: 200, data: { code: 401, status: '401', msg: '登录已超时请重新登录' } }; },
    };
    const service = new ChinadepAssetsService({ app });
    const result = await service.fetchPage({ token: 'expired' }, 1, 10);
    assert.equal(result.httpStatus, 401);
    assert.equal(result.status, 'target_auth_expired');
  });
});
