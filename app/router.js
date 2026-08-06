'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/health', controller.health.index);
  router.post('/api/connections/login', controller.connection.login);
};
