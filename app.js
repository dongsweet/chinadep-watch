'use strict';

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

module.exports = app => {
  app.beforeStart(async () => {
    fs.mkdirSync(path.dirname(app.config.sqlite.path), { recursive: true });
    const database = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(app.config.sqlite.path, error => error ? reject(error) : resolve(db));
    });

    await run(database, 'PRAGMA journal_mode = WAL');
    await run(database, `CREATE TABLE IF NOT EXISTS platform_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await run(database, `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    const auth = app.config.platformAuth;
    const existing = await new Promise((resolve, reject) => {
      database.get('SELECT id FROM platform_users WHERE username = ?', [auth.username], (error, row) => error ? reject(error) : resolve(row));
    });
    if (!existing) {
      const now = new Date().toISOString();
      await run(database, `INSERT INTO platform_users
        (username, password_hash, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`, [auth.username, hashPassword(auth.password), auth.username, now, now]);
    }

    app.database = database;
  });
};

module.exports.run = run;
