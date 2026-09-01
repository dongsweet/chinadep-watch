'use strict';

const { Service } = require('egg');

class MonitorService extends Service {
  async list({ includeDisabled = true } = {}) {
    const params = [];
    const where = includeDisabled ? '' : 'WHERE m.enabled = 1';
    return new Promise((resolve, reject) => {
      this.app.database.all(`SELECT m.id, m.asset_id AS assetId, m.threshold_price AS thresholdPrice,
        m.enabled, m.current_price AS currentPrice, m.last_checked_at AS lastCheckedAt,
        m.alert_active AS alertActive, m.last_alert_at AS lastAlertAt,
        m.created_at AS createdAt, m.updated_at AS updatedAt,
        a.target_asset_id AS targetAssetId, a.name AS assetName, a.cover_url AS coverUrl,
        c.mobile AS connectionMobile
        FROM asset_monitors m JOIN target_assets a ON a.id = m.asset_id
        JOIN target_connections c ON c.id = a.target_connection_id
        ${where} ORDER BY m.enabled DESC, m.updated_at DESC, m.id DESC`, params, (error, rows) => {
        if (error) return reject(error);
        resolve(rows.map(row => ({ ...row, enabled: Boolean(row.enabled), alertActive: Boolean(row.alertActive) })));
      });
    });
  }

  async findAsset(assetId) {
    return new Promise((resolve, reject) => {
      this.app.database.get('SELECT id, name FROM target_assets WHERE id = ?', [assetId], (error, row) => error ? reject(error) : resolve(row));
    });
  }

  async create({ assetId, thresholdPrice }) {
    const asset = await this.findAsset(assetId);
    if (!asset) return { httpStatus: 404, body: { success: false, status: 'not_found', message: '资产不存在' } };
    const now = new Date().toISOString();
    try {
      await new Promise((resolve, reject) => {
        this.app.database.run(`INSERT INTO asset_monitors
          (asset_id, threshold_price, enabled, current_price, alert_active, created_at, updated_at)
          VALUES (?, ?, 1, NULL, 0, ?, ?)`, [assetId, thresholdPrice, now, now], error => error ? reject(error) : resolve());
      });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        return { httpStatus: 409, body: { success: false, status: 'already_exists', message: '该资产已经添加监控' } };
      }
      throw error;
    }
    const monitors = await this.list();
    return { httpStatus: 201, body: { success: true, status: 'created', monitor: monitors.find(item => item.assetId === assetId) } };
  }

  async update(id, { enabled, thresholdPrice }) {
    const changes = [];
    const params = [];
    if (typeof enabled === 'boolean') { changes.push('enabled = ?'); params.push(enabled ? 1 : 0); }
    if (typeof thresholdPrice === 'number') { changes.push('threshold_price = ?'); params.push(thresholdPrice); }
    if (!changes.length) return { httpStatus: 400, body: { success: false, status: 'invalid_request', message: '请提供 enabled 或 thresholdPrice' } };
    changes.push('updated_at = ?'); params.push(new Date().toISOString(), id);
    const result = await new Promise((resolve, reject) => {
      this.app.database.run(`UPDATE asset_monitors SET ${changes.join(', ')} WHERE id = ?`, params, function(error) {
        if (error) return reject(error);
        resolve({ changes: this.changes });
      });
    });
    if (!result.changes) return { httpStatus: 404, body: { success: false, status: 'not_found', message: '监控不存在' } };
    const monitors = await this.list();
    return { httpStatus: 200, body: { success: true, status: 'updated', monitor: monitors.find(item => item.id === id) || null } };
  }

  async remove(id) {
    const result = await new Promise((resolve, reject) => {
      this.app.database.run('DELETE FROM asset_monitors WHERE id = ?', [id], function(error) {
        if (error) return reject(error);
        resolve({ changes: this.changes });
      });
    });
    if (!result.changes) return { httpStatus: 404, body: { success: false, status: 'not_found', message: '监控不存在' } };
    return { httpStatus: 200, body: { success: true, status: 'deleted' } };
  }

  async updateCheck(id, currentPrice, checkedAt, isBelow, lastAlertAt) {
    await new Promise((resolve, reject) => {
      this.app.database.run(`UPDATE asset_monitors SET current_price = ?, last_checked_at = ?,
        alert_active = ?, last_alert_at = ?, updated_at = ? WHERE id = ?`,
      [currentPrice, checkedAt, isBelow ? 1 : 0, lastAlertAt, checkedAt, id], error => error ? reject(error) : resolve());
    });
  }

  async check() {
    const monitors = await this.list({ includeDisabled: false });
    const checkedAt = new Date().toISOString();
    for (const monitor of monitors) {
      const price = await this.ctx.service.chinadepSales.currentPrice(monitor.assetId);
      if (!price.ok) continue;
      const isBelow = price.currentPrice !== null && price.currentPrice < monitor.thresholdPrice;
      const lastAlertAt = isBelow && !monitor.alertActive ? checkedAt : monitor.lastAlertAt;
      await this.updateCheck(monitor.id, price.currentPrice, checkedAt, isBelow, lastAlertAt);
    }
    const all = await this.list();
    return {
      monitors: all,
      alerts: all.filter(item => item.enabled && item.alertActive).map(item => ({
        id: item.id, assetId: item.assetId, assetName: item.assetName,
        currentPrice: item.currentPrice, thresholdPrice: item.thresholdPrice,
        lastAlertAt: item.lastAlertAt,
      })),
      checkedAt,
    };
  }
}

module.exports = MonitorService;
