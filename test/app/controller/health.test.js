'use strict';

const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('GET /health', () => {
  it('returns a healthy response', async () => {
    const response = await app.httpRequest().get('/health').expect(200);

    assert.deepStrictEqual(response.body, {
      ok: true,
      service: 'chinadep-watch',
    });
  });
});
