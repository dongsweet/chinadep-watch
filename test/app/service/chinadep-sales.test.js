'use strict';

const assert = require('assert');
const ChinadepSalesService = require('../../../app/service/chinadep-sales');

describe('service.chinadepSales', () => {
  it('fetches and normalizes the target sales page', async () => {
    const app = {
      config: { chinadep: { baseUrl: 'https://m-math.chinadep.com', requestTimeout: 1000, userAgent: 'test-agent' } },
      async curl(url, options) {
        app.lastRequest = { url, options };
        return { status: 200, data: { code: 1, data: { pageSize: 10, pageCount: 1, dataCount: 1, data: [{ id: 123, assetsName: '测试商品', goodsName: '测试商品-001', listedPrice: '88.50', customerName: 'ab*****z', listedTime: '2026-09-01 10:00:00' }] } } };
      },
    };
    const service = new ChinadepSalesService({ app });
    const result = await service.fetchPage({ token: 'target-token' }, 65, 1, 10);
    assert.equal(result.ok, true);
    assert.equal(result.total, 1);
    assert.equal(result.rows[0].listedPrice, '88.50');
    assert.deepStrictEqual(app.lastRequest.options.data, { pageCount: 1, pageSize: 10, isListed: 2, orderType: 4, assetsId: 65 });
    assert.equal(app.lastRequest.options.headers.Authorization, 'target-token');
  });

  it('returns an explicit status when the target token expired', async () => {
    const app = {
      config: { chinadep: { baseUrl: 'https://m-math.chinadep.com', requestTimeout: 1000, userAgent: 'test-agent' } },
      async curl() { return { status: 200, data: { code: 401, status: '401', msg: '登录已超时请重新登录' } }; },
    };
    const service = new ChinadepSalesService({ app });
    const result = await service.fetchPage({ token: 'expired' }, 65, 1, 10);
    assert.equal(result.httpStatus, 401);
    assert.equal(result.status, 'target_auth_expired');
  });
});
