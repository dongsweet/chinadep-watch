'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/health', controller.health.index);
  router.get('/', controller.dashboard.index);
  router.get('/login', controller.dashboard.loginPage);
  router.post('/api/auth/login', controller.platformAuth.login);
  router.post('/api/auth/logout', controller.platformAuth.logout);
  router.get('/api/auth/me', controller.platformAuth.me);
  router.get('/api/settings', controller.settings.index);
  router.put('/api/settings', controller.settings.update);
  router.get('/api/connections', controller.connection.list);
  router.post('/api/connections/login', controller.connection.login);
};
