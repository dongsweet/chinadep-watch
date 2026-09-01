'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/health', controller.health.index);
  router.get('/', controller.dashboard.index);
  router.get('/login', controller.dashboard.loginPage);
  router.get('/accounts', controller.dashboard.accountsPage);
  router.get('/products', controller.dashboard.productsPage);
  router.get('/monitoring', controller.dashboard.monitoringPage);
  router.post('/api/auth/login', controller.platformAuth.login);
  router.post('/api/auth/logout', controller.platformAuth.logout);
  router.get('/api/auth/me', controller.platformAuth.me);
  router.get('/api/settings', controller.settings.index);
  router.put('/api/settings', controller.settings.update);
  router.get('/api/connections', controller.connection.list);
  router.post('/api/connections/sms/send', controller.connection.sendSms);
  router.post('/api/connections/sms/login', controller.connection.loginBySms);
  router.post('/api/connections/login', controller.connection.login);
  router.get('/api/assets', controller.asset.list);
  router.post('/api/assets/sync', controller.asset.sync);
  router.get('/api/assets/:id/sales', controller.asset.sales);
  router.patch('/api/assets/:id', controller.asset.update);
  router.get('/api/monitors', controller.monitor.list);
  router.post('/api/monitors', controller.monitor.create);
  router.get('/api/monitors/status', controller.monitor.status);
  router.patch('/api/monitors/:id', controller.monitor.update);
  router.delete('/api/monitors/:id', controller.monitor.remove);
};
