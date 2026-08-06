'use strict';

const path = require('path');

module.exports = appInfo => {
  const config = exports = {};

  config.keys = process.env.APP_KEYS || `${appInfo.name}_local_key`;

  config.security = {
    csrf: {
      enable: false,
    },
  };

  config.bodyParser = {
    jsonLimit: '100kb',
    formLimit: '100kb',
  };

  config.logger = {
    dir: process.env.LOG_DIR || '/tmp/chinadep-watch-logs',
  };

  config.session = {
    key: 'chinadep.sid',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
  };

  config.sqlite = {
    path: process.env.SQLITE_PATH || path.join(appInfo.baseDir, 'run', 'chinadep-watch.sqlite3'),
  };

  config.platformAuth = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  };

  config.chinadep = {
    baseUrl: process.env.CHINADEP_BASE_URL || 'https://m-math.chinadep.com',
    requestTimeout: Number(process.env.CHINADEP_REQUEST_TIMEOUT || 15000),
    userAgent: process.env.CHINADEP_USER_AGENT || 'chinadep-watch/0.1',
  };

  return config;
};
