'use strict';

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

  config.chinadep = {
    baseUrl: process.env.CHINADEP_BASE_URL || 'https://m-math.chinadep.com',
    requestTimeout: Number(process.env.CHINADEP_REQUEST_TIMEOUT || 15000),
    userAgent: process.env.CHINADEP_USER_AGENT || 'chinadep-watch/0.1',
  };

  return config;
};
