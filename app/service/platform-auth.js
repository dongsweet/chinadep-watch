'use strict';

const { Service } = require('egg');
const crypto = require('crypto');

function verifyPassword(password, encoded) {
  const [saltText, hashText] = String(encoded).split(':');
  if (!saltText || !hashText) return false;
  const salt = Buffer.from(saltText, 'base64');
  const expected = Buffer.from(hashText, 'base64');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

class PlatformAuthService extends Service {
  async findUser(username, password) {
    const user = await new Promise((resolve, reject) => {
      this.app.database.get('SELECT id, username, password_hash, display_name FROM platform_users WHERE username = ?', [username], (error, row) => error ? reject(error) : resolve(row));
    });
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    return { id: user.id, username: user.username, displayName: user.display_name };
  }
}

module.exports = PlatformAuthService;
