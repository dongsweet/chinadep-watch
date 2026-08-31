'use strict';

const { Service } = require('egg');
const crypto = require('crypto');

class ConnectionStoreService extends Service {
  getKey() {
    return crypto.createHash('sha256').update(this.app.config.keys).digest();
  }

  encrypt(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(item => item.toString('base64')).join(':');
  }

  decrypt(value) {
    const [ivText, tagText, encryptedText] = String(value || '').split(':');
    if (!ivText || !tagText || !encryptedText) throw new Error('invalid encrypted value');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(ivText, 'base64'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  async saveAuthenticated({ session, deviceToken }) {
    const now = new Date().toISOString();
    const params = [
      session.mobile,
      this.encrypt(session.token),
      deviceToken ? this.encrypt(deviceToken) : null,
      session.userId || null,
      session.nickName || null,
      session.isVerified ? 1 : 0,
      'authenticated',
      now,
      now,
      now,
    ];
    await new Promise((resolve, reject) => {
      this.app.database.run(`INSERT INTO target_connections
        (mobile, token_ciphertext, device_token_ciphertext, target_user_id, nick_name,
         is_verified, status, last_login_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(mobile) DO UPDATE SET token_ciphertext = excluded.token_ciphertext,
          device_token_ciphertext = excluded.device_token_ciphertext,
          target_user_id = excluded.target_user_id, nick_name = excluded.nick_name,
          is_verified = excluded.is_verified, status = excluded.status,
          last_login_at = excluded.last_login_at, last_error = NULL,
          updated_at = excluded.updated_at`, params, error => error ? reject(error) : resolve());
    });
    return {
      mobile: session.mobile,
      targetUserId: session.userId || null,
      nickName: session.nickName || null,
      isVerified: Boolean(session.isVerified),
      status: 'authenticated',
      lastLoginAt: now,
    };
  }

  async list() {
    return new Promise((resolve, reject) => {
      this.app.database.all(`SELECT id, mobile, target_user_id AS targetUserId, nick_name AS nickName,
        is_verified AS isVerified, status, last_login_at AS lastLoginAt, updated_at AS updatedAt
        FROM target_connections ORDER BY updated_at DESC`, (error, rows) => {
        if (error) return reject(error);
        resolve(rows.map(row => ({ ...row, isVerified: Boolean(row.isVerified) })));
      });
    });
  }

  async getCredentials(mobile) {
    const row = await new Promise((resolve, reject) => {
      const query = mobile
        ? 'SELECT id, mobile, token_ciphertext, device_token_ciphertext, status FROM target_connections WHERE mobile = ?'
        : `SELECT id, mobile, token_ciphertext, device_token_ciphertext, status
          FROM target_connections WHERE status = 'authenticated' ORDER BY updated_at DESC LIMIT 1`;
      const params = mobile ? [mobile] : [];
      this.app.database.get(query, params, (error, result) => error ? reject(error) : resolve(result));
    });
    if (!row || row.status !== 'authenticated') return null;
    return {
      id: row.id,
      mobile: row.mobile,
      token: this.decrypt(row.token_ciphertext),
      deviceToken: row.device_token_ciphertext ? this.decrypt(row.device_token_ciphertext) : null,
    };
  }
}

module.exports = ConnectionStoreService;
