'use strict';

const { Service } = require('egg');

const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 100;

function asNumber(value) {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

function asInteger(value) {
  const number = asNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function isSuccess(payload) {
  return payload && (payload.code === 1 || payload.status === 1 || payload.status === '0000' || payload.success === true);
}

class ChinadepAssetsService extends Service {
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

  async fetchPage(credentials, pageCount, pageSize) {
    const { app } = this;
    const { chinadep } = app.config;
    const url = `${chinadep.baseUrl}/sm/api/assets/anonymous/assetsPage`;
    let response;
    try {
      response = await app.curl(url, {
        method: 'GET',
        dataType: 'json',
        data: { pageCount, pageSize, searchText: '' },
        headers: this.headers(credentials),
        timeout: chinadep.requestTimeout,
        followRedirect: false,
      });
    } catch (error) {
      app.logger.warn('[chinadep-assets] upstream request failed: %s', error.message);
      return { ok: false, httpStatus: 502, status: 'upstream_unavailable', message: '目标平台资产服务不可用' };
    }

    const payload = response && response.data ? response.data : {};
    const targetCode = String(payload.code || payload.status || '');
    if (targetCode === '401' || targetCode === '600') {
      return { ok: false, httpStatus: 401, status: 'target_auth_expired', message: '目标平台登录已过期，请重新连接账号' };
    }
    if (!response || response.status !== 200) {
      return { ok: false, httpStatus: 502, status: 'upstream_error', message: '目标平台资产服务返回异常状态' };
    }
    if (!isSuccess(payload)) {
      return {
        ok: false,
        httpStatus: 422,
        status: 'target_request_failed',
        message: payload.msg || payload.message || '目标平台拒绝了资产列表请求',
      };
    }

    const container = Array.isArray(payload.data) ? { data: payload.data } : (payload.data || {});
    const rows = Array.isArray(container.data) ? container.data : [];
    const available = asInteger(container.dataCount) || rows.length;
    const returnedPageSize = asInteger(container.pageSize) || pageSize;
    return { ok: true, rows, available, pageSize: returnedPageSize };
  }

  normalize(row, connectionId, now) {
    const assetsType = row.assetsType || {};
    const assetsFileType = row.assetsFileType || {};
    return {
      targetConnectionId: connectionId,
      targetAssetId: asInteger(row.id),
      name: String(row.name || '').trim() || `未命名资产 ${row.id || ''}`.trim(),
      issuerName: row.issuerName || row.creationName || null,
      issuerId: asInteger(row.issuerId),
      assetsTypeId: asInteger(assetsType.id || row.assetsTypeId),
      assetsTypeName: assetsType.name || row.assetsTypeName || null,
      assetsFileTypeName: assetsFileType.name || row.assetsFileTypeName || null,
      coverUrl: row.coverUrl || null,
      issuePrice: asNumber(row.issuePrice),
      maxPrice: asNumber(row.maxPrice),
      listedCount: asInteger(row.listedCount),
      issueCount: asInteger(row.issueCount || row.tradeCount),
      issueTime: row.issueTime || null,
      tradeStartTime: row.tradeStartTime || null,
      tradeEndTime: row.tradeEndTime || null,
      tradeBoard: asInteger(row.tradeBoard),
      showStatus: asInteger(row.showStatus),
      rawJson: JSON.stringify(row),
      now,
    };
  }

  async sync({ mobile, pageSize = 50 }) {
    const credentials = await this.ctx.service.connectionStore.getCredentials(mobile);
    if (!credentials) {
      return { httpStatus: 400, body: { success: false, status: 'connection_required', message: '请先连接一个已登录的监控平台账号' } };
    }

    pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(pageSize) || 50));
    const now = new Date().toISOString();
    let pageCount = 1;
    let synced = 0;
    let totalAvailable = 0;
    while (pageCount <= MAX_PAGES) {
      const result = await this.fetchPage(credentials, pageCount, pageSize);
      if (!result.ok) return { httpStatus: result.httpStatus, body: { success: false, status: result.status, message: result.message } };
      totalAvailable = result.available;
      for (const row of result.rows) {
        const asset = this.normalize(row, credentials.id, now);
        if (!asset.targetAssetId) continue;
        await this.upsert(asset);
        synced += 1;
      }
      const pageSizeFromResponse = result.pageSize || pageSize;
      if (!result.rows.length || pageCount * pageSizeFromResponse >= result.available || result.rows.length < pageSizeFromResponse) break;
      pageCount += 1;
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        status: 'synced',
        connection: { id: credentials.id, mobile: credentials.mobile },
        synced,
        totalAvailable,
        pages: pageCount,
        lastSyncedAt: now,
      },
    };
  }

  async upsert(asset) {
    const params = [
      asset.targetConnectionId, asset.targetAssetId, asset.name, asset.issuerName, asset.issuerId,
      asset.assetsTypeId, asset.assetsTypeName, asset.assetsFileTypeName, asset.coverUrl,
      asset.issuePrice, asset.maxPrice, asset.listedCount, asset.issueCount, asset.issueTime,
      asset.tradeStartTime, asset.tradeEndTime, asset.tradeBoard, asset.showStatus, asset.rawJson,
      asset.now, asset.now, asset.now,
    ];
    await new Promise((resolve, reject) => {
      this.app.database.run(`INSERT INTO target_assets
        (target_connection_id, target_asset_id, name, issuer_name, issuer_id,
         assets_type_id, assets_type_name, assets_file_type_name, cover_url,
         issue_price, max_price, listed_count, issue_count, issue_time,
         trade_start_time, trade_end_time, trade_board, show_status, raw_json,
         first_seen_at, last_synced_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(target_connection_id, target_asset_id) DO UPDATE SET
          name = excluded.name, issuer_name = excluded.issuer_name, issuer_id = excluded.issuer_id,
          assets_type_id = excluded.assets_type_id, assets_type_name = excluded.assets_type_name,
          assets_file_type_name = excluded.assets_file_type_name, cover_url = excluded.cover_url,
          issue_price = excluded.issue_price, max_price = excluded.max_price,
          listed_count = excluded.listed_count, issue_count = excluded.issue_count,
          issue_time = excluded.issue_time, trade_start_time = excluded.trade_start_time,
          trade_end_time = excluded.trade_end_time, trade_board = excluded.trade_board,
          show_status = excluded.show_status, raw_json = excluded.raw_json,
          last_synced_at = excluded.last_synced_at, updated_at = excluded.updated_at`, params,
      error => error ? reject(error) : resolve());
    });
  }

  async list({ query = '', enabled } = {}) {
    const params = [];
    const where = [];
    if (query) {
      where.push('(a.name LIKE ? OR a.issuer_name LIKE ? OR a.assets_type_name LIKE ?)');
      const pattern = `%${query}%`;
      params.push(pattern, pattern, pattern);
    }
    if (enabled === true || enabled === false) {
      where.push('a.enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    const sql = `SELECT a.id, a.target_asset_id AS targetAssetId, a.name, a.issuer_name AS issuerName,
      a.issuer_id AS issuerId, a.assets_type_id AS assetsTypeId, a.assets_type_name AS assetsTypeName,
      a.assets_file_type_name AS assetsFileTypeName, a.cover_url AS coverUrl, a.issue_price AS issuePrice,
      a.max_price AS maxPrice, a.listed_count AS listedCount, a.issue_count AS issueCount,
      a.issue_time AS issueTime, a.trade_start_time AS tradeStartTime, a.trade_end_time AS tradeEndTime,
      a.trade_board AS tradeBoard, a.show_status AS showStatus, a.enabled, a.note,
      a.first_seen_at AS firstSeenAt, a.last_synced_at AS lastSyncedAt,
      c.id AS connectionId, c.mobile AS connectionMobile
      FROM target_assets a JOIN target_connections c ON c.id = a.target_connection_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.enabled DESC, a.updated_at DESC, a.id DESC`;
    return new Promise((resolve, reject) => {
      this.app.database.all(sql, params, (error, rows) => {
        if (error) return reject(error);
        resolve(rows.map(row => ({ ...row, enabled: Boolean(row.enabled) })));
      });
    });
  }

  async update(id, { enabled, note }) {
    const changes = [];
    const params = [];
    if (typeof enabled === 'boolean') {
      changes.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    if (typeof note === 'string') {
      changes.push('note = ?');
      params.push(note.trim().slice(0, 500));
    }
    if (!changes.length) return { httpStatus: 400, body: { success: false, status: 'invalid_request', message: '请提供 enabled 或 note' } };
    changes.push('updated_at = ?');
    params.push(new Date().toISOString(), id);
    const result = await new Promise((resolve, reject) => {
      this.app.database.run(`UPDATE target_assets SET ${changes.join(', ')} WHERE id = ?`, params, function(error) {
        if (error) return reject(error);
        resolve({ changes: this.changes });
      });
    });
    if (!result.changes) return { httpStatus: 404, body: { success: false, status: 'not_found', message: '资产不存在' } };
    const rows = await this.list({});
    return { httpStatus: 200, body: { success: true, status: 'updated', asset: rows.find(row => row.id === id) || null } };
  }
}

module.exports = ChinadepAssetsService;
