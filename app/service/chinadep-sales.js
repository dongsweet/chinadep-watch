'use strict';

const { Service } = require('egg');

const MAX_PAGE_SIZE = 100;
const MAX_PAGE_COUNT = 1000;

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asInteger(value) {
  const number = asNumber(value);
  return number === null ? null : Math.trunc(number);
}

function isSuccess(payload) {
  return payload && (payload.code === 1 || payload.status === 1 || payload.status === '0000' || payload.success === true);
}

class ChinadepSalesService extends Service {
  headers(credentials) {
    const { chinadep } = this.app.config;
    const headers = {
      accept: 'application/json, text/plain, */*',
      'user-agent': chinadep.userAgent,
      referer: `${chinadep.baseUrl}/`,
      Authorization: credentials.token,
    };
    if (credentials.deviceToken) headers['Tencent-DeviceToken'] = credentials.deviceToken;
    return headers;
  }

  async findAsset(assetId) {
    return new Promise((resolve, reject) => {
      this.app.database.get(`SELECT a.id, a.target_asset_id AS targetAssetId,
        a.target_connection_id AS connectionId, c.mobile AS connectionMobile, c.status AS connectionStatus
        FROM target_assets a JOIN target_connections c ON c.id = a.target_connection_id
        WHERE a.id = ?`, [assetId], (error, row) => error ? reject(error) : resolve(row));
    });
  }

  async fetchPage(credentials, targetAssetId, pageCount, pageSize) {
    const { app } = this;
    const { chinadep } = app.config;
    const url = `${chinadep.baseUrl}/sm/api/trade/anonymous/onSelfListedPage`;
    let response;
    try {
      response = await app.curl(url, {
        method: 'GET',
        dataType: 'json',
        data: { pageCount, pageSize, isListed: 2, orderType: 4, assetsId: targetAssetId },
        headers: this.headers(credentials),
        timeout: chinadep.requestTimeout,
        followRedirect: false,
      });
    } catch (error) {
      app.logger.warn('[chinadep-sales] upstream request failed: %s', error.message);
      return { ok: false, httpStatus: 502, status: 'upstream_unavailable', message: '目标平台销售记录服务不可用' };
    }

    const payload = response && response.data ? response.data : {};
    const targetCode = String(payload.code || payload.status || '');
    if (targetCode === '401' || targetCode === '600') {
      return { ok: false, httpStatus: 401, status: 'target_auth_expired', message: '目标平台登录已过期，请重新连接账号' };
    }
    if (!response || response.status !== 200) {
      return { ok: false, httpStatus: 502, status: 'upstream_error', message: '目标平台销售记录服务返回异常状态' };
    }
    if (!isSuccess(payload)) {
      return {
        ok: false,
        httpStatus: 422,
        status: 'target_request_failed',
        message: payload.msg || payload.message || '目标平台拒绝了销售记录请求',
      };
    }

    const container = payload.data || {};
    const rows = Array.isArray(container.data) ? container.data : [];
    return {
      ok: true,
      rows,
      total: asInteger(container.dataCount) || 0,
      pageCount: asInteger(container.pageCount) || pageCount,
      pageSize: asInteger(container.pageSize) || pageSize,
    };
  }

  normalize(row) {
    return {
      id: asInteger(row.id),
      customerName: row.customerName || null,
      buyerName: row.buyerName || null,
      assetsName: row.assetsName || null,
      goodsName: row.goodsName || null,
      tokenId: row.tokenId || null,
      goodsChainId: asInteger(row.goodsChainId),
      listedPrice: asNumber(row.listedPrice),
      issuePrice: asNumber(row.issuePrice),
      listedTime: row.listedTime || null,
      modifyTime: row.modifyTime || null,
      removeTime: row.removeTime || null,
      listedStatus: asInteger(row.listedStatus),
      rightsStatus: asInteger(row.rightsStatus),
      availableCount: asInteger(row.availableCount),
      coverUrl: row.coverUrl || null,
      platformName: row.platformName || (row.issuePlatform && row.issuePlatform.name) || null,
      tradeBoard: asInteger(row.tradeBoard),
    };
  }

  async readCache(assetId, pageCount, pageSize) {
    return new Promise((resolve, reject) => {
      this.app.database.get(`SELECT total_count AS total, page_count AS pageCount,
        page_size AS pageSize, rows_json AS rowsJson, fetched_at AS fetchedAt
        FROM target_asset_sales_pages
        WHERE asset_id = ? AND page_count = ? AND page_size = ?`, [assetId, pageCount, pageSize], (error, row) => {
        if (error) return reject(error);
        if (!row) return resolve(null);
        let rows = [];
        try { rows = JSON.parse(row.rowsJson); } catch (parseError) { return resolve(null); }
        resolve({ ...row, rows });
      });
    });
  }

  async writeCache(assetId, result, now) {
    await new Promise((resolve, reject) => {
      this.app.database.run(`INSERT INTO target_asset_sales_pages
        (asset_id, page_count, page_size, total_count, rows_json, fetched_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id, page_count, page_size) DO UPDATE SET
          total_count = excluded.total_count, rows_json = excluded.rows_json,
          fetched_at = excluded.fetched_at, updated_at = excluded.updated_at`,
      [assetId, result.pageCount, result.pageSize, result.total, JSON.stringify(result.rows), now, now],
      error => error ? reject(error) : resolve());
    });
  }

  async list({ assetId, pageCount = 1, pageSize = 10, refresh = false }) {
    const normalizedAssetId = Number(assetId);
    if (!Number.isInteger(normalizedAssetId) || normalizedAssetId < 1) {
      return { httpStatus: 400, body: { success: false, status: 'invalid_request', message: '资产 ID 不正确' } };
    }
    pageCount = Math.max(1, Math.min(MAX_PAGE_COUNT, Number(pageCount) || 1));
    pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(pageSize) || 10));

    const asset = await this.findAsset(normalizedAssetId);
    if (!asset) return { httpStatus: 404, body: { success: false, status: 'not_found', message: '资产不存在' } };
    if (!refresh) {
      const cached = await this.readCache(normalizedAssetId, pageCount, pageSize);
      if (cached) {
        return {
          httpStatus: 200,
          body: {
            success: true, status: 'ok', cached: true, assetId: normalizedAssetId,
            pageCount: cached.pageCount, pageSize: cached.pageSize, total: cached.total,
            fetchedAt: cached.fetchedAt, rows: cached.rows,
          },
        };
      }
    }

    const credentials = await this.ctx.service.connectionStore.getCredentials(asset.connectionMobile);
    if (!credentials) {
      return { httpStatus: 401, body: { success: false, status: 'target_auth_expired', message: '目标平台登录已过期，请重新连接账号' } };
    }
    const result = await this.fetchPage(credentials, asset.targetAssetId, pageCount, pageSize);
    if (!result.ok) return { httpStatus: result.httpStatus, body: { success: false, status: result.status, message: result.message } };
    const now = new Date().toISOString();
    const normalized = { ...result, rows: result.rows.map(row => this.normalize(row)) };
    await this.writeCache(normalizedAssetId, normalized, now);
    return {
      httpStatus: 200,
      body: {
        success: true, status: 'ok', cached: false, assetId: normalizedAssetId,
        pageCount: normalized.pageCount, pageSize: normalized.pageSize, total: normalized.total,
        fetchedAt: now, rows: normalized.rows,
      },
    };
  }

  async currentPrice(assetId) {
    const result = await this.list({ assetId, pageCount: 1, pageSize: 10, refresh: true });
    if (result.httpStatus !== 200) return { ok: false, httpStatus: result.httpStatus, message: result.body.message };
    const prices = result.body.rows.map(row => row.listedPrice).filter(value => typeof value === 'number' && Number.isFinite(value));
    return {
      ok: true,
      currentPrice: prices.length ? Math.min(...prices) : null,
      fetchedAt: result.body.fetchedAt,
    };
  }
}

module.exports = ChinadepSalesService;
