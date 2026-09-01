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
    await run(database, `CREATE TABLE IF NOT EXISTS target_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL UNIQUE,
      token_ciphertext TEXT NOT NULL,
      device_token_ciphertext TEXT,
      target_user_id INTEGER,
      nick_name TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      last_login_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await run(database, `CREATE TABLE IF NOT EXISTS target_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_connection_id INTEGER NOT NULL,
      target_asset_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      issuer_name TEXT,
      issuer_id INTEGER,
      assets_type_id INTEGER,
      assets_type_name TEXT,
      assets_file_type_name TEXT,
      cover_url TEXT,
      issue_price REAL,
      max_price REAL,
      listed_count INTEGER,
      issue_count INTEGER,
      issue_time TEXT,
      trade_start_time TEXT,
      trade_end_time TEXT,
      trade_board INTEGER,
      show_status INTEGER,
      raw_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      first_seen_at TEXT NOT NULL,
      last_synced_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(target_connection_id, target_asset_id)
    )`);
    await run(database, `CREATE TABLE IF NOT EXISTS target_asset_sales_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      page_count INTEGER NOT NULL,
      page_size INTEGER NOT NULL,
      total_count INTEGER NOT NULL DEFAULT 0,
      rows_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(asset_id, page_count, page_size)
    )`);
    await run(database, `CREATE TABLE IF NOT EXISTS asset_monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL UNIQUE,
      threshold_price REAL NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      current_price REAL,
      last_checked_at TEXT,
      alert_active INTEGER NOT NULL DEFAULT 0,
      last_alert_at TEXT,
      created_at TEXT NOT NULL,
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
