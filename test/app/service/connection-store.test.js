'use strict';

const assert = require('assert');
const ConnectionStoreService = require('../../../app/service/connection-store');

describe('service.connectionStore', () => {
  it('stores all required timestamps for an authenticated connection', async () => {
    const calls = [];
    const app = {
      config: { keys: 'test-key' },
      database: {
        run(sql, params, callback) {
          calls.push({ sql, params });
          callback(null);
        },
      },
    };
    const service = new ConnectionStoreService({ app });
    const result = await service.saveAuthenticated({
      session: {
        mobile: '13800138000',
        token: 'target-token',
        userId: 42,
        nickName: 'demo',
        isVerified: true,
      },
    });

    assert.equal(result.status, 'authenticated');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].params.length, 10);
    assert(calls[0].params[7]);
    assert(calls[0].params[8]);
    assert(calls[0].params[9]);
    assert.equal(calls[0].params[7], calls[0].params[8]);
    assert.equal(calls[0].params[8], calls[0].params[9]);
  });
});
